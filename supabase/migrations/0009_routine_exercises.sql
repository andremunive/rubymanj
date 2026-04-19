-- ============================================================
-- 0009_routine_exercises.sql
-- Line items of a routine. Mixes trainer fields (recommendations)
-- and client fields (client_notes). Immutability enforced by trigger.
-- ============================================================

create table if not exists public.routine_exercises (
  id                       uuid          not null default gen_random_uuid(),
  routine_id               uuid          not null,
  exercise_id              uuid          not null,
  position                 integer       not null,
  recommended_sets         integer       not null,
  recommended_reps         integer,
  recommended_weight       numeric(6,2),
  recommended_weight_unit  text          not null default 'kg',
  rest_seconds             integer,
  trainer_notes            text,
  client_notes             text,

  constraint routine_exercises_pkey primary key (id),
  constraint routine_exercises_routine_id_fkey
    foreign key (routine_id) references public.routines(id) on delete cascade,
  constraint routine_exercises_exercise_id_fkey
    foreign key (exercise_id) references public.exercises(id) on delete restrict,
  constraint routine_exercises_position_check
    check (position >= 0),
  constraint routine_exercises_recommended_sets_check
    check (recommended_sets >= 1),
  constraint routine_exercises_recommended_reps_check
    check (recommended_reps is null or recommended_reps >= 1),
  constraint routine_exercises_recommended_weight_check
    check (recommended_weight is null or recommended_weight >= 0),
  constraint routine_exercises_recommended_weight_unit_check
    check (recommended_weight_unit in ('kg', 'lb')),
  constraint routine_exercises_rest_seconds_check
    check (rest_seconds is null or rest_seconds >= 0),

  -- No two exercises at the same position in the same routine
  constraint routine_exercises_routine_position_key unique (routine_id, position)
);

comment on table public.routine_exercises is
  'Line items of a routine. '
  'IMMUTABILITY: once the parent routine leaves status=pending, no INSERT/UPDATE/DELETE is '
  'allowed on trainer fields. client_notes remains writable until status=completed/skipped. '
  'Enforced by trigger fn_routine_exercises_immutable.';

comment on column public.routine_exercises.client_notes is
  'Written by the client during execution. Includes weight deviations, discomfort notes, '
  'and any feedback for the trainer. This is the only field writable by the client. '
  'Frozen once the routine reaches completed or skipped.';

comment on column public.routine_exercises.recommended_reps is
  'NULL = free / AMRAP (as many reps as possible). Set by trainer.';

-- Index for "where has this exercise been used"
create index if not exists routine_exercises_exercise_id_idx
  on public.routine_exercises(exercise_id);

-- ------------------------------------------------------------
-- Trigger: set_updated_at is not needed here (no updated_at column),
-- but the column guard and immutability triggers are critical.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Trigger: fn_routine_exercises_immutable  (§8.A.1 in schema.md)
-- BEFORE INSERT OR UPDATE OR DELETE on routine_exercises.
--
-- Rules:
--   INSERT: allowed only if parent routine.status = 'pending'.
--   DELETE: allowed only if parent routine.status = 'pending'.
--   UPDATE:
--     - If parent routine.status = 'pending': any update allowed.
--     - If parent routine.status = 'in_progress':
--         * Trainer: blocked (structure is frozen).
--         * Client (current_user_role='client'): allowed ONLY if the
--           sole changed column is client_notes.
--     - If parent routine.status IN ('completed','skipped'): blocked for all.
-- ------------------------------------------------------------

create or replace function public.fn_routine_exercises_immutable()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  -- Determine the routine status for the affected row
  if tg_op = 'DELETE' then
    select status into v_status
    from public.routines
    where id = old.routine_id;
  else
    select status into v_status
    from public.routines
    where id = new.routine_id;
  end if;

  -- INSERT: only allowed when routine is pending
  if tg_op = 'INSERT' then
    if v_status <> 'pending' then
      raise exception 'routine_not_editable: cannot add exercises to a routine that is not pending (status=%)', v_status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- DELETE: only allowed when routine is pending
  if tg_op = 'DELETE' then
    if v_status <> 'pending' then
      raise exception 'routine_not_editable: cannot remove exercises from a routine that is not pending (status=%)', v_status
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE
  if tg_op = 'UPDATE' then
    -- pending: any update is fine
    if v_status = 'pending' then
      return new;
    end if;

    -- completed / skipped: frozen for everyone
    if v_status in ('completed', 'skipped') then
      raise exception 'routine_closed: routine_exercises are immutable when status=%', v_status
        using errcode = 'check_violation';
    end if;

    -- in_progress: client may only touch client_notes
    if v_status = 'in_progress' then
      if public.current_user_role() = 'client' then
        -- Allow only if client_notes changed and nothing else did
        if (
          new.exercise_id              is not distinct from old.exercise_id              and
          new.position                 is not distinct from old.position                 and
          new.recommended_sets         is not distinct from old.recommended_sets         and
          new.recommended_reps         is not distinct from old.recommended_reps         and
          new.recommended_weight       is not distinct from old.recommended_weight       and
          new.recommended_weight_unit  is not distinct from old.recommended_weight_unit  and
          new.rest_seconds             is not distinct from old.rest_seconds             and
          new.trainer_notes            is not distinct from old.trainer_notes
        ) then
          -- Only client_notes changed (or nothing changed at all) — allow
          return new;
        else
          raise exception 'routine_not_editable: client can only update client_notes when routine is in_progress'
            using errcode = 'insufficient_privilege';
        end if;
      else
        -- Trainer trying to update structure while in_progress: blocked
        raise exception 'routine_not_editable: trainer cannot modify routine_exercises structure when routine is in_progress'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.fn_routine_exercises_immutable() is
  'CRITICAL IMMUTABILITY TRIGGER. '
  'Enforces §8.A.1 of schema.md: '
  'INSERT/DELETE only when routine.status=pending; '
  'UPDATE by trainer only when pending; '
  'UPDATE by client only of client_notes when pending or in_progress; '
  'everything blocked when completed/skipped.';

create trigger trg_routine_exercises_immutable
  before insert or update or delete on public.routine_exercises
  for each row execute function public.fn_routine_exercises_immutable();

-- ------------------------------------------------------------
-- Trigger: enforce_client_update_routine_exercises
-- When the caller is a client, revert any column that is not client_notes.
-- This is a safety net complementing the immutability trigger above.
-- ------------------------------------------------------------

create or replace function public.fn_enforce_client_update_routine_exercises()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_role() = 'client' then
    new.routine_id              := old.routine_id;
    new.exercise_id             := old.exercise_id;
    new.position                := old.position;
    new.recommended_sets        := old.recommended_sets;
    new.recommended_reps        := old.recommended_reps;
    new.recommended_weight      := old.recommended_weight;
    new.recommended_weight_unit := old.recommended_weight_unit;
    new.rest_seconds            := old.rest_seconds;
    new.trainer_notes           := old.trainer_notes;
  end if;
  return new;
end;
$$;

comment on function public.fn_enforce_client_update_routine_exercises() is
  'BEFORE UPDATE on routine_exercises. If caller is a client, reverts all columns '
  'except client_notes. Works in concert with fn_routine_exercises_immutable.';

create trigger trg_routine_exercises_enforce_client_update
  before update on public.routine_exercises
  for each row execute function public.fn_enforce_client_update_routine_exercises();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.routine_exercises enable row level security;
alter table public.routine_exercises force row level security;

-- Trainer sees all. Client sees only exercises belonging to their own routines.
drop policy if exists routine_exercises_select on public.routine_exercises;
create policy routine_exercises_select
  on public.routine_exercises
  for select
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.client_id = auth.uid()
    )
  );

-- Trainer can insert (trigger enforces pending-only)
drop policy if exists routine_exercises_insert on public.routine_exercises;
create policy routine_exercises_insert
  on public.routine_exercises
  for insert
  with check (public.is_trainer());

-- Trainer can update (trigger enforces column-level rules).
-- Client can also update their own (trigger enforces client_notes-only restriction).
drop policy if exists routine_exercises_update on public.routine_exercises;
create policy routine_exercises_update
  on public.routine_exercises
  for update
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.client_id = auth.uid()
    )
  )
  with check (
    public.is_trainer()
    or exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.client_id = auth.uid()
    )
  );

-- Only trainer can delete (trigger enforces pending-only)
drop policy if exists routine_exercises_delete on public.routine_exercises;
create policy routine_exercises_delete
  on public.routine_exercises
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop trigger if exists trg_routine_exercises_enforce_client_update on public.routine_exercises;
-- drop trigger if exists trg_routine_exercises_immutable on public.routine_exercises;
-- drop function if exists public.fn_enforce_client_update_routine_exercises();
-- drop function if exists public.fn_routine_exercises_immutable();
-- drop policy if exists routine_exercises_delete on public.routine_exercises;
-- drop policy if exists routine_exercises_update on public.routine_exercises;
-- drop policy if exists routine_exercises_insert on public.routine_exercises;
-- drop policy if exists routine_exercises_select on public.routine_exercises;
-- drop table if exists public.routine_exercises;
-- ============================================================
