-- ============================================================
-- 0003_plans.sql
-- Catalogue of subscription plans.  Seed: one "trimestral" row.
-- ============================================================

create table if not exists public.plans (
  id           uuid           not null default gen_random_uuid(),
  code         text           not null,
  name         text           not null,
  duration_days integer       not null,
  price        numeric(12,2),
  description  text,
  is_active    boolean        not null default true,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz,

  constraint plans_pkey primary key (id),
  constraint plans_code_key unique (code),
  constraint plans_duration_days_check check (duration_days > 0)
);

comment on table public.plans is
  'Catalogue of subscription plans. duration_days is the basis for computing payment due_date. '
  'price is a reference; the actual charged amount lives in payments.amount.';

-- Trigger: updated_at
create trigger trg_plans_set_updated_at
  before update on public.plans
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plans force row level security;

-- Any authenticated user can read plans (needed for client billing view)
drop policy if exists plans_select on public.plans;
create policy plans_select
  on public.plans
  for select
  using (auth.role() = 'authenticated');

-- Only trainer can write
drop policy if exists plans_insert on public.plans;
create policy plans_insert
  on public.plans
  for insert
  with check (public.is_trainer());

drop policy if exists plans_update on public.plans;
create policy plans_update
  on public.plans
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

drop policy if exists plans_delete on public.plans;
create policy plans_delete
  on public.plans
  for delete
  using (public.is_trainer());

-- ------------------------------------------------------------
-- Seed: initial plan (trimestral)
-- Using ON CONFLICT DO NOTHING so re-running is safe.
-- ------------------------------------------------------------

insert into public.plans (code, name, duration_days, price, description)
values (
  'trimestral',
  'Trimestral',
  90,
  null,
  'Plan trimestral (90 días). Precio a definir por Ruby.'
)
on conflict (code) do nothing;

-- ============================================================
-- DOWN
-- drop trigger if exists trg_plans_set_updated_at on public.plans;
-- drop policy if exists plans_delete on public.plans;
-- drop policy if exists plans_update on public.plans;
-- drop policy if exists plans_insert on public.plans;
-- drop policy if exists plans_select on public.plans;
-- drop table if exists public.plans;
-- ============================================================
