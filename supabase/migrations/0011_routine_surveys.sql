-- ============================================================
-- 0011_routine_surveys.sql
-- Post-workout survey submitted by the client.
-- PK = FK to routines (strict 1:1). Clients insert once; trainers can edit.
-- ============================================================

create table if not exists public.routine_surveys (
  routine_id       uuid        not null,
  overall_feeling  text,
  weights_feeling  text,
  notes            text,
  extra_answers    jsonb,
  evidence_path    text,
  submitted_at     timestamptz not null default now(),

  constraint routine_surveys_pkey primary key (routine_id),
  constraint routine_surveys_routine_id_fkey
    foreign key (routine_id) references public.routines(id) on delete cascade,
  constraint routine_surveys_overall_feeling_check
    check (overall_feeling is null or overall_feeling in
      ('great', 'good', 'ok', 'tired', 'bad')),
  constraint routine_surveys_weights_feeling_check
    check (weights_feeling is null or weights_feeling in
      ('too_light', 'ok', 'too_heavy'))
);

comment on table public.routine_surveys is
  'Post-workout survey: one row per routine, created by the client when completing the session. '
  'IMMUTABILITY: once inserted, only the trainer may update or delete (see trigger below). '
  'The client cannot modify their own survey — it is a snapshot of how they felt that day.';

comment on column public.routine_surveys.extra_answers is
  'JSONB bag for experimental/future questions that Ruby wants to add without a migration. '
  'Validated by the application layer using a versioned schema.';

comment on column public.routine_surveys.evidence_path is
  'Relative path to an object in the routine-evidence Supabase Storage bucket. '
  'Format: {client_id}/{routine_id}/{filename}. NULL if no photo was uploaded.';

-- ------------------------------------------------------------
-- Trigger: fn_routine_surveys_immutable  (§8.A.3 in schema.md)
-- BEFORE UPDATE OR DELETE.
-- Client: always blocked.
-- Trainer: allowed (exceptional corrections).
-- ------------------------------------------------------------

create or replace function public.fn_routine_surveys_immutable()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_role() = 'client' then
    raise exception 'survey_immutable: clients cannot modify or delete their own survey'
      using errcode = 'insufficient_privilege';
  end if;

  -- Trainer is allowed
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.fn_routine_surveys_immutable() is
  'BEFORE UPDATE OR DELETE on routine_surveys. '
  'Blocks all client modifications. Trainer edits/deletes are allowed (use sparingly).';

create trigger trg_routine_surveys_immutable
  before update or delete on public.routine_surveys
  for each row execute function public.fn_routine_surveys_immutable();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.routine_surveys enable row level security;
alter table public.routine_surveys force row level security;

-- Trainer sees all; client sees only surveys for their own routines
drop policy if exists routine_surveys_select on public.routine_surveys;
create policy routine_surveys_select
  on public.routine_surveys
  for select
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routines r
      where r.id = routine_surveys.routine_id
        and r.client_id = auth.uid()
    )
  );

-- Client can insert for their own completed routine; trainer can also insert
drop policy if exists routine_surveys_insert on public.routine_surveys;
create policy routine_surveys_insert
  on public.routine_surveys
  for insert
  with check (
    public.is_trainer()
    or exists (
      select 1
      from public.routines r
      where r.id = routine_surveys.routine_id
        and r.client_id = auth.uid()
    )
  );

-- Only trainer can update (trigger also enforces this)
drop policy if exists routine_surveys_update on public.routine_surveys;
create policy routine_surveys_update
  on public.routine_surveys
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

-- Only trainer can delete (trigger also enforces this)
drop policy if exists routine_surveys_delete on public.routine_surveys;
create policy routine_surveys_delete
  on public.routine_surveys
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop trigger if exists trg_routine_surveys_immutable on public.routine_surveys;
-- drop function if exists public.fn_routine_surveys_immutable();
-- drop policy if exists routine_surveys_delete on public.routine_surveys;
-- drop policy if exists routine_surveys_update on public.routine_surveys;
-- drop policy if exists routine_surveys_insert on public.routine_surveys;
-- drop policy if exists routine_surveys_select on public.routine_surveys;
-- drop table if exists public.routine_surveys;
-- ============================================================
