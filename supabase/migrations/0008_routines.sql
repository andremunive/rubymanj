-- ============================================================
-- 0008_routines.sql
-- Training session assigned to a client for a specific date.
-- Includes status lifecycle, immutability rules, and column guards.
-- ============================================================

create table if not exists public.routines (
  id                uuid        not null default gen_random_uuid(),
  client_id         uuid        not null,
  trainer_id        uuid        not null,
  name              text        not null,
  scheduled_date    date        not null,
  status            text        not null default 'pending',
  started_at        timestamptz,
  completed_at      timestamptz,
  trainer_notes     text,
  source_routine_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,

  constraint routines_pkey primary key (id),
  constraint routines_client_id_fkey
    foreign key (client_id) references public.profiles(id) on delete restrict,
  constraint routines_trainer_id_fkey
    foreign key (trainer_id) references public.profiles(id),
  constraint routines_source_routine_id_fkey
    foreign key (source_routine_id) references public.routines(id) on delete set null,

  constraint routines_status_check
    check (status in ('pending', 'in_progress', 'completed', 'skipped')),

  -- started_at must not be present on a pending routine
  constraint routines_started_at_coherence
    check (started_at is null or status <> 'pending'),

  -- completed_at requires started_at
  constraint routines_completed_at_requires_started
    check (completed_at is null or started_at is not null),

  -- completed_at must be >= started_at
  constraint routines_completed_at_order
    check (completed_at is null or completed_at >= started_at)
);

comment on table public.routines is
  'A training session assigned to ONE client for ONE date. '
  'Once status leaves pending, the exercise list is frozen (enforced by trigger on routine_exercises). '
  'Use fn_duplicate_routine to create an editable copy of any routine.';

comment on column public.routines.source_routine_id is
  'If this routine was created by fn_duplicate_routine, points to the original. '
  'SET NULL on delete so history is not broken if the source is ever removed.';

-- Indexes
create index if not exists routines_client_scheduled_idx
  on public.routines(client_id, scheduled_date desc);

create index if not exists routines_scheduled_date_idx
  on public.routines(scheduled_date);

create index if not exists routines_client_status_pending_idx
  on public.routines(client_id, status)
  where status in ('pending', 'in_progress');

create index if not exists routines_client_completed_at_idx
  on public.routines(client_id, completed_at)
  where status = 'completed';

-- ------------------------------------------------------------
-- Trigger: set_updated_at
-- ------------------------------------------------------------

create trigger trg_routines_set_updated_at
  before update on public.routines
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- Trigger: enforce_routine_status_transitions
-- Valid transitions:
--   pending      → in_progress
--   pending      → skipped
--   in_progress  → completed
-- No other transitions allowed (no going backwards, no skipped→anything, etc.)
-- EXCEPTION: trainer can force any transition (needed for corrections).
-- Clients are restricted to the transitions above.
-- ------------------------------------------------------------

create or replace function public.fn_enforce_routine_status_transitions()
returns trigger
language plpgsql
as $$
begin
  -- Only enforce when status actually changes
  if old.status = new.status then
    return new;
  end if;

  -- Trainers can make any status change (they need to correct mistakes)
  if public.is_trainer() then
    return new;
  end if;

  -- For clients: only allow valid forward transitions
  if not (
    (old.status = 'pending'     and new.status = 'in_progress') or
    (old.status = 'pending'     and new.status = 'skipped')     or
    (old.status = 'in_progress' and new.status = 'completed')
  ) then
    raise exception 'invalid_transition: status cannot move from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.fn_enforce_routine_status_transitions() is
  'BEFORE UPDATE on routines. Restricts clients to valid forward-only status transitions. '
  'Trainers are allowed any transition for correction purposes.';

create trigger trg_routines_status_transitions
  before update on public.routines
  for each row
  when (old.status is distinct from new.status)
  execute function public.fn_enforce_routine_status_transitions();

-- ------------------------------------------------------------
-- Trigger: enforce_client_update_routines
-- When the caller is a client, they may only change:
--   status, started_at, completed_at
-- All trainer fields are reverted to their old values.
-- ------------------------------------------------------------

create or replace function public.fn_enforce_client_update_routines()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_role() = 'client' then
    -- Revert all trainer-owned columns
    new.client_id         := old.client_id;
    new.trainer_id        := old.trainer_id;
    new.name              := old.name;
    new.scheduled_date    := old.scheduled_date;
    new.trainer_notes     := old.trainer_notes;
    new.source_routine_id := old.source_routine_id;
    new.created_at        := old.created_at;
  end if;
  return new;
end;
$$;

comment on function public.fn_enforce_client_update_routines() is
  'BEFORE UPDATE on routines. When caller is a client, reverts all columns except '
  'status, started_at, completed_at (the only fields a client may touch).';

create trigger trg_routines_enforce_client_update
  before update on public.routines
  for each row execute function public.fn_enforce_client_update_routines();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.routines enable row level security;
alter table public.routines force row level security;

-- Trainer sees all; client sees only their own routines
drop policy if exists routines_select on public.routines;
create policy routines_select
  on public.routines
  for select
  using (
    public.is_trainer()
    or client_id = auth.uid()
  );

-- Only trainer can create routines
drop policy if exists routines_insert on public.routines;
create policy routines_insert
  on public.routines
  for insert
  with check (public.is_trainer());

-- Trainer can update any routine; client can update only their own
drop policy if exists routines_update on public.routines;
create policy routines_update
  on public.routines
  for update
  using (
    public.is_trainer()
    or client_id = auth.uid()
  )
  with check (
    public.is_trainer()
    or client_id = auth.uid()
  );

-- Only trainer can delete
drop policy if exists routines_delete on public.routines;
create policy routines_delete
  on public.routines
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop trigger if exists trg_routines_enforce_client_update on public.routines;
-- drop trigger if exists trg_routines_status_transitions on public.routines;
-- drop trigger if exists trg_routines_set_updated_at on public.routines;
-- drop function if exists public.fn_enforce_client_update_routines();
-- drop function if exists public.fn_enforce_routine_status_transitions();
-- drop policy if exists routines_delete on public.routines;
-- drop policy if exists routines_update on public.routines;
-- drop policy if exists routines_insert on public.routines;
-- drop policy if exists routines_select on public.routines;
-- drop table if exists public.routines;
-- ============================================================
