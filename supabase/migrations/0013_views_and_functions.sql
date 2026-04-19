-- ============================================================
-- 0013_views_and_functions.sql
-- Analytical view, adherence function, muscle functions,
-- and the fn_duplicate_routine RPC.
-- All timezone-sensitive operations use America/Bogota.
-- ============================================================

-- ------------------------------------------------------------
-- View: v_client_adherence
-- Weekly adherence per client, bucketed in America/Bogota local time.
-- "Week" = Monday 00:00 Bogota time (ISO week truncation).
-- ------------------------------------------------------------

create or replace view public.v_client_adherence as
select
  client_id,
  date_trunc(
    'week',
    (scheduled_date::timestamp) at time zone 'America/Bogota'
  )::date as period_start,
  count(*) filter (where status <> 'skipped')       as assigned,
  count(*) filter (where status = 'completed')       as completed,
  round(
    100.0
    * count(*) filter (where status = 'completed')
    / nullif(count(*) filter (where status <> 'skipped'), 0),
    1
  ) as adherence_pct
from public.routines
group by client_id, period_start;

comment on view public.v_client_adherence is
  'Aggregated weekly adherence per client. Week boundaries are in America/Bogota timezone. '
  'adherence_pct = completed / (assigned - skipped). NULL when no non-skipped routines.';

-- Trainer can select from the view; clients can see only their own row.
-- (Views inherit the RLS of the underlying table, so this is redundant but explicit.)
grant select on public.v_client_adherence to authenticated;

-- ------------------------------------------------------------
-- Function: fn_client_adherence
-- Returns adherence metrics for a single client over an arbitrary date range.
-- p_from / p_to are dates interpreted as calendar days (no TZ conversion needed
-- since scheduled_date is already a date).
-- ------------------------------------------------------------

create or replace function public.fn_client_adherence(
  p_client_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  assigned       bigint,
  completed      bigint,
  adherence_pct  numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where status <> 'skipped')    as assigned,
    count(*) filter (where status = 'completed')   as completed,
    round(
      100.0
      * count(*) filter (where status = 'completed')
      / nullif(count(*) filter (where status <> 'skipped'), 0),
      1
    ) as adherence_pct
  from public.routines
  where client_id     = p_client_id
    and scheduled_date between p_from and p_to;
$$;

comment on function public.fn_client_adherence(uuid, date, date) is
  'Returns aggregated adherence for p_client_id in [p_from, p_to]. '
  'Trainers can call for any client; RLS on routines limits clients to their own data. '
  'SECURITY DEFINER so the trainer can pass any client_id without RLS blocking the subquery.';

grant execute on function public.fn_client_adherence(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- Function: fn_muscles_worked
-- Muscles exercised in COMPLETED routines within [p_from, p_to],
-- where p_from / p_to are compared against completed_at in America/Bogota.
-- "Worked" = the client actually executed the session.
-- ------------------------------------------------------------

create or replace function public.fn_muscles_worked(
  p_client_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  muscle_id      uuid,
  muscle_code    text,
  muscle_name    text,
  muscle_group   text,
  exercise_count bigint,
  session_count  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id                        as muscle_id,
    m.code                      as muscle_code,
    m.name                      as muscle_name,
    m.muscle_group,
    count(*)                    as exercise_count,
    count(distinct r.id)        as session_count
  from public.routines r
  join public.routine_exercises re on re.routine_id  = r.id
  join public.exercise_muscles  em on em.exercise_id = re.exercise_id
  join public.muscles           m  on m.id           = em.muscle_id
  where r.client_id = p_client_id
    and r.status    = 'completed'
    and (r.completed_at at time zone 'America/Bogota')::date
          between p_from and p_to
  group by m.id, m.code, m.name, m.muscle_group
  order by session_count desc, exercise_count desc;
$$;

comment on function public.fn_muscles_worked(uuid, date, date) is
  'Returns muscles trained in completed routines for p_client_id, '
  'filtered by completed_at (in America/Bogota) within [p_from, p_to]. '
  '"Worked" answers: what did the client actually exercise in this range? '
  'Returns 0 rows (not an error) if no completed routines exist in the range.';

grant execute on function public.fn_muscles_worked(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- Function: fn_muscles_planned
-- Muscles in ALL routines (any status) whose scheduled_date falls in [p_from, p_to].
-- "Planned" answers: what muscles did Ruby schedule for this range?
-- Same shape as fn_muscles_worked for easy frontend diff.
-- ------------------------------------------------------------

create or replace function public.fn_muscles_planned(
  p_client_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  muscle_id      uuid,
  muscle_code    text,
  muscle_name    text,
  muscle_group   text,
  exercise_count bigint,
  session_count  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id                        as muscle_id,
    m.code                      as muscle_code,
    m.name                      as muscle_name,
    m.muscle_group,
    count(*)                    as exercise_count,
    count(distinct r.id)        as session_count
  from public.routines r
  join public.routine_exercises re on re.routine_id  = r.id
  join public.exercise_muscles  em on em.exercise_id = re.exercise_id
  join public.muscles           m  on m.id           = em.muscle_id
  where r.client_id      = p_client_id
    and r.scheduled_date between p_from and p_to
  group by m.id, m.code, m.name, m.muscle_group
  order by session_count desc, exercise_count desc;
$$;

comment on function public.fn_muscles_planned(uuid, date, date) is
  'Returns muscles scheduled for p_client_id in routines with scheduled_date in [p_from, p_to]. '
  'Status-agnostic: counts all routines, including pending/skipped. '
  '"Planned" answers: what muscles did Ruby intend to work in this range? '
  'Use alongside fn_muscles_worked to show planned vs. executed diff in the UI.';

grant execute on function public.fn_muscles_planned(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- Function: fn_duplicate_routine
-- Copies a routine's trainer-owned fields to a new routine for
-- p_target_client_id on p_target_date. Returns the new routine id.
-- SECURITY DEFINER — the only authorized copy path.
-- Validates that the caller is a trainer before executing.
-- Client fields (client_notes, sets, survey) are NOT copied.
-- ------------------------------------------------------------

create or replace function public.fn_duplicate_routine(
  p_source_routine_id uuid,
  p_target_client_id  uuid,
  p_target_date       date,
  p_new_name          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_routine_id  uuid;
  v_source_routine  public.routines%rowtype;
begin
  -- Authorization: only a trainer may duplicate routines
  if not public.is_trainer() then
    raise exception 'not_authorized: only a trainer can duplicate routines'
      using errcode = 'insufficient_privilege';
  end if;

  -- Load source routine
  select * into v_source_routine
  from public.routines
  where id = p_source_routine_id;

  if not found then
    raise exception 'not_found: source routine % does not exist', p_source_routine_id
      using errcode = 'no_data_found';
  end if;

  -- Validate target client exists and is active
  if not exists (
    select 1 from public.profiles
    where id = p_target_client_id
      and role = 'client'
      and is_active = true
  ) then
    raise exception 'not_found: target client % does not exist or is inactive', p_target_client_id
      using errcode = 'no_data_found';
  end if;

  -- Create the new routine (status = 'pending', no execution fields)
  insert into public.routines (
    client_id,
    trainer_id,
    name,
    scheduled_date,
    status,
    trainer_notes,
    source_routine_id
  )
  values (
    p_target_client_id,
    auth.uid(),
    coalesce(p_new_name, v_source_routine.name),
    p_target_date,
    'pending',
    v_source_routine.trainer_notes,
    p_source_routine_id
  )
  returning id into v_new_routine_id;

  -- Copy routine_exercises (trainer fields only — no client_notes)
  insert into public.routine_exercises (
    routine_id,
    exercise_id,
    position,
    recommended_sets,
    recommended_reps,
    recommended_weight,
    recommended_weight_unit,
    rest_seconds,
    trainer_notes
    -- client_notes is intentionally omitted (defaults to NULL)
  )
  select
    v_new_routine_id,
    exercise_id,
    position,
    recommended_sets,
    recommended_reps,
    recommended_weight,
    recommended_weight_unit,
    rest_seconds,
    trainer_notes
  from public.routine_exercises
  where routine_id = p_source_routine_id;

  -- routine_exercise_sets and routine_surveys are NOT copied

  return v_new_routine_id;
end;
$$;

comment on function public.fn_duplicate_routine(uuid, uuid, date, text) is
  'Creates a copy of a routine for a given client and date. '
  'SECURITY DEFINER — the sole authorized path for copying routines. '
  'Validates is_trainer() before executing. '
  'Copies only trainer fields; client_notes, sets, and surveys are not copied. '
  'New routine starts in status=pending, making it fully editable. '
  'source_routine_id on the new routine points to the original for traceability.';

grant execute on function public.fn_duplicate_routine(uuid, uuid, date, text) to authenticated;

-- ============================================================
-- DOWN
-- revoke execute on function public.fn_duplicate_routine(uuid,uuid,date,text) from authenticated;
-- revoke execute on function public.fn_muscles_planned(uuid,date,date) from authenticated;
-- revoke execute on function public.fn_muscles_worked(uuid,date,date) from authenticated;
-- revoke execute on function public.fn_client_adherence(uuid,date,date) from authenticated;
-- drop function if exists public.fn_duplicate_routine(uuid,uuid,date,text);
-- drop function if exists public.fn_muscles_planned(uuid,date,date);
-- drop function if exists public.fn_muscles_worked(uuid,date,date);
-- drop function if exists public.fn_client_adherence(uuid,date,date);
-- drop view if exists public.v_client_adherence;
-- ============================================================
