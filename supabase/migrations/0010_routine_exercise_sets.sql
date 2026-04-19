-- ============================================================
-- 0010_routine_exercise_sets.sql
-- Per-set execution records (performed reps).
-- No performed_weight: deviations go in routine_exercises.client_notes.
-- Immutability enforced by trigger (§8.A.2 in schema.md).
-- ============================================================

create table if not exists public.routine_exercise_sets (
  id                   uuid        not null default gen_random_uuid(),
  routine_exercise_id  uuid        not null,
  set_number           integer     not null,
  performed_reps       integer,
  created_at           timestamptz not null default now(),

  constraint routine_exercise_sets_pkey primary key (id),
  constraint routine_exercise_sets_routine_exercise_id_fkey
    foreign key (routine_exercise_id)
    references public.routine_exercises(id) on delete cascade,
  constraint routine_exercise_sets_set_number_check
    check (set_number >= 1),
  constraint routine_exercise_sets_performed_reps_check
    check (performed_reps is null or performed_reps >= 0),

  -- One set_number per routine_exercise
  constraint routine_exercise_sets_re_set_key
    unique (routine_exercise_id, set_number)
);

comment on table public.routine_exercise_sets is
  'Actual reps performed per set, per exercise, per routine. '
  'No performed_weight column: weight deviations are recorded as free text in '
  'routine_exercises.client_notes. '
  'IMMUTABILITY (§8.A.2): '
  '  pending     → trainer may pre-initialize empty sets; '
  '  in_progress → trainer and client owner may insert/update/delete; '
  '  completed/skipped → immutable for everyone.';

comment on column public.routine_exercise_sets.performed_reps is
  'NULL means the set was pre-initialized by the trainer but not yet executed. '
  '0 is valid (set attempted, zero reps performed).';

-- ------------------------------------------------------------
-- Trigger: fn_routine_exercise_sets_immutable  (§8.A.2 in schema.md)
-- Resolves routine status via: sets → routine_exercises → routines.
-- ------------------------------------------------------------

create or replace function public.fn_routine_exercise_sets_immutable()
returns trigger
language plpgsql
as $$
declare
  v_routine_id   uuid;
  v_status       text;
  v_client_id    uuid;
  v_re_id        uuid;
begin
  -- Determine the routine_exercise_id for the affected row
  if tg_op = 'DELETE' then
    v_re_id := old.routine_exercise_id;
  else
    v_re_id := new.routine_exercise_id;
  end if;

  -- Walk up to routines to get status and client_id
  select r.id, r.status, r.client_id
  into v_routine_id, v_status, v_client_id
  from public.routine_exercises re
  join public.routines r on r.id = re.routine_id
  where re.id = v_re_id;

  if v_status is null then
    raise exception 'internal: could not resolve routine for routine_exercise_id=%', v_re_id
      using errcode = 'foreign_key_violation';
  end if;

  -- completed or skipped: frozen for EVERYONE
  if v_status in ('completed', 'skipped') then
    raise exception 'routine_closed: sets are immutable when routine status=%', v_status
      using errcode = 'check_violation';
  end if;

  -- pending: only the trainer may write (pre-initialization of empty sets)
  if v_status = 'pending' then
    if not public.is_trainer() then
      raise exception 'routine_not_started: only the trainer can write sets when routine is pending'
        using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- in_progress: trainer OR the client who owns the routine
  if v_status = 'in_progress' then
    if public.is_trainer() or auth.uid() = v_client_id then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    else
      raise exception 'not_authorized: you do not own this routine'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Fallthrough (should not reach here)
  raise exception 'internal: unexpected routine status=%', v_status
    using errcode = 'internal_error';
end;
$$;

comment on function public.fn_routine_exercise_sets_immutable() is
  'CRITICAL IMMUTABILITY TRIGGER for routine_exercise_sets. '
  'pending: trainer-only writes. '
  'in_progress: trainer and owning client. '
  'completed/skipped: no writes from anyone.';

create trigger trg_routine_exercise_sets_immutable
  before insert or update or delete on public.routine_exercise_sets
  for each row execute function public.fn_routine_exercise_sets_immutable();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.routine_exercise_sets enable row level security;
alter table public.routine_exercise_sets force row level security;

-- Trainer sees all.
-- Client sees sets belonging to their own routines (via routine_exercises → routines).
drop policy if exists routine_exercise_sets_select on public.routine_exercise_sets;
create policy routine_exercise_sets_select
  on public.routine_exercise_sets
  for select
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.id = routine_exercise_sets.routine_exercise_id
        and r.client_id = auth.uid()
    )
  );

-- Trainer inserts (pending pre-init).
-- Client inserts their own (in_progress). Trigger enforces status guard.
drop policy if exists routine_exercise_sets_insert on public.routine_exercise_sets;
create policy routine_exercise_sets_insert
  on public.routine_exercise_sets
  for insert
  with check (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.id = routine_exercise_sets.routine_exercise_id
        and r.client_id = auth.uid()
    )
  );

-- Same logic for update and delete — trigger enforces the status-based rules
drop policy if exists routine_exercise_sets_update on public.routine_exercise_sets;
create policy routine_exercise_sets_update
  on public.routine_exercise_sets
  for update
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.id = routine_exercise_sets.routine_exercise_id
        and r.client_id = auth.uid()
    )
  )
  with check (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.id = routine_exercise_sets.routine_exercise_id
        and r.client_id = auth.uid()
    )
  );

drop policy if exists routine_exercise_sets_delete on public.routine_exercise_sets;
create policy routine_exercise_sets_delete
  on public.routine_exercise_sets
  for delete
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.id = routine_exercise_sets.routine_exercise_id
        and r.client_id = auth.uid()
    )
  );

-- ============================================================
-- DOWN
-- drop trigger if exists trg_routine_exercise_sets_immutable on public.routine_exercise_sets;
-- drop function if exists public.fn_routine_exercise_sets_immutable();
-- drop policy if exists routine_exercise_sets_delete on public.routine_exercise_sets;
-- drop policy if exists routine_exercise_sets_update on public.routine_exercise_sets;
-- drop policy if exists routine_exercise_sets_insert on public.routine_exercise_sets;
-- drop policy if exists routine_exercise_sets_select on public.routine_exercise_sets;
-- drop table if exists public.routine_exercise_sets;
-- ============================================================
