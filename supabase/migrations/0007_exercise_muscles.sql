-- ============================================================
-- 0007_exercise_muscles.sql
-- Pivot table: exercise ↔ muscle (with is_primary flag).
-- ============================================================

create table if not exists public.exercise_muscles (
  exercise_id uuid    not null,
  muscle_id   uuid    not null,
  is_primary  boolean not null default false,

  constraint exercise_muscles_pkey primary key (exercise_id, muscle_id),
  constraint exercise_muscles_exercise_id_fkey
    foreign key (exercise_id) references public.exercises(id) on delete cascade,
  constraint exercise_muscles_muscle_id_fkey
    foreign key (muscle_id) references public.muscles(id) on delete restrict
);

comment on table public.exercise_muscles is
  'Tags each exercise with one or more muscles. '
  'is_primary=true means it is the target muscle; false means it is a secondary/synergist. '
  'muscle_id FK is RESTRICT: do not delete a muscle that is still tagged on an exercise.';

-- Index to support "exercises that target muscle X" lookup
create index if not exists exercise_muscles_muscle_id_idx
  on public.exercise_muscles(muscle_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.exercise_muscles enable row level security;
alter table public.exercise_muscles force row level security;

-- Any authenticated user can read (needed for analytics and exercise detail views)
drop policy if exists exercise_muscles_select on public.exercise_muscles;
create policy exercise_muscles_select
  on public.exercise_muscles
  for select
  using (auth.role() = 'authenticated');

-- Only trainer can write
drop policy if exists exercise_muscles_insert on public.exercise_muscles;
create policy exercise_muscles_insert
  on public.exercise_muscles
  for insert
  with check (public.is_trainer());

drop policy if exists exercise_muscles_update on public.exercise_muscles;
create policy exercise_muscles_update
  on public.exercise_muscles
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

drop policy if exists exercise_muscles_delete on public.exercise_muscles;
create policy exercise_muscles_delete
  on public.exercise_muscles
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop policy if exists exercise_muscles_delete on public.exercise_muscles;
-- drop policy if exists exercise_muscles_update on public.exercise_muscles;
-- drop policy if exists exercise_muscles_insert on public.exercise_muscles;
-- drop policy if exists exercise_muscles_select on public.exercise_muscles;
-- drop table if exists public.exercise_muscles;
-- ============================================================
