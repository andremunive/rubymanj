-- ============================================================
-- 0004_payments.sql
-- Payment history per client with auto-calculated due_date.
-- ============================================================

create table if not exists public.payments (
  id             uuid           not null default gen_random_uuid(),
  client_id      uuid           not null,
  plan_id        uuid           not null,
  paid_on        date           not null,
  amount         numeric(12,2)  not null,
  due_date       date           not null,
  payment_method text,
  notes          text,
  created_by     uuid           not null,
  created_at     timestamptz    not null default now(),

  constraint payments_pkey primary key (id),
  constraint payments_client_id_fkey
    foreign key (client_id) references public.profiles(id) on delete restrict,
  constraint payments_plan_id_fkey
    foreign key (plan_id) references public.plans(id) on delete restrict,
  constraint payments_created_by_fkey
    foreign key (created_by) references public.profiles(id),
  constraint payments_amount_check
    check (amount >= 0),
  constraint payments_payment_method_check
    check (payment_method is null or payment_method in
      ('cash', 'transfer', 'card', 'yape', 'plin', 'other'))
);

comment on table public.payments is
  'Immutable payment records for each client. '
  'due_date is stored (not derived) to preserve history if plan duration_days changes. '
  'Multiple active (non-expired) payments per client are allowed; effective expiry = MAX(due_date).';

comment on column public.payments.due_date is
  'Stored at insert time. If NULL on insert, computed by trigger as paid_on + plan.duration_days. '
  'If provided explicitly, the explicit value is kept (trainer override, e.g. "gifted one extra week").';

-- Indexes
create index if not exists payments_client_paid_on_idx on public.payments(client_id, paid_on desc);
create index if not exists payments_due_date_idx on public.payments(due_date);

-- ------------------------------------------------------------
-- Trigger: calc_payment_due_date
-- Before INSERT: if due_date is NULL, compute it from the plan.
-- If due_date already has a value, leave it untouched.
-- ------------------------------------------------------------

create or replace function public.fn_calc_payment_due_date()
returns trigger
language plpgsql
as $$
declare
  v_duration_days integer;
begin
  if new.due_date is null then
    select duration_days into v_duration_days
    from public.plans
    where id = new.plan_id;

    if v_duration_days is null then
      raise exception 'bad_input: plan not found for id %', new.plan_id
        using errcode = 'foreign_key_violation';
    end if;

    new.due_date := new.paid_on + v_duration_days;
  end if;
  return new;
end;
$$;

comment on function public.fn_calc_payment_due_date() is
  'BEFORE INSERT on payments. Fills due_date = paid_on + plan.duration_days when due_date is NULL. '
  'Explicit due_date values (trainer override) are preserved.';

create trigger trg_payments_calc_due_date
  before insert on public.payments
  for each row execute function public.fn_calc_payment_due_date();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.payments enable row level security;
alter table public.payments force row level security;

-- Trainer sees all; client sees only own payments
drop policy if exists payments_select on public.payments;
create policy payments_select
  on public.payments
  for select
  using (
    public.is_trainer()
    or client_id = auth.uid()
  );

-- Only trainer can write
drop policy if exists payments_insert on public.payments;
create policy payments_insert
  on public.payments
  for insert
  with check (public.is_trainer());

drop policy if exists payments_update on public.payments;
create policy payments_update
  on public.payments
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

drop policy if exists payments_delete on public.payments;
create policy payments_delete
  on public.payments
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop trigger if exists trg_payments_calc_due_date on public.payments;
-- drop function if exists public.fn_calc_payment_due_date();
-- drop policy if exists payments_delete on public.payments;
-- drop policy if exists payments_update on public.payments;
-- drop policy if exists payments_insert on public.payments;
-- drop policy if exists payments_select on public.payments;
-- drop table if exists public.payments;
-- ============================================================
