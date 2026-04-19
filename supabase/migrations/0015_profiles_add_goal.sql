-- ============================================================
-- 0015_profiles_add_goal.sql
-- Adds the `goal` training objective to profiles (required for clients).
-- Allowed codes: muscle_gain | fat_loss | body_recomp | conditioning | maintenance
-- Also updates the auth-user trigger and trainer_create_client RPC
-- so the goal can be persisted atomically during client creation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Column
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists goal text;

comment on column public.profiles.goal is
  'Training objective for the client. Required when role = client. '
  'Codes: muscle_gain, fat_loss, body_recomp, conditioning, maintenance.';

-- Backfill existing clients with a safe default (the trainer can edit later).
update public.profiles
   set goal = 'maintenance'
 where role = 'client'
   and goal is null;

-- ------------------------------------------------------------
-- 2. Constraints
-- ------------------------------------------------------------

-- Allowed values
alter table public.profiles
  drop constraint if exists profiles_goal_check;
alter table public.profiles
  add  constraint profiles_goal_check
  check (
    goal is null
    or goal in ('muscle_gain', 'fat_loss', 'body_recomp', 'conditioning', 'maintenance')
  );

-- Required for clients; NULL allowed for trainers.
alter table public.profiles
  drop constraint if exists profiles_goal_required_for_clients;
alter table public.profiles
  add  constraint profiles_goal_required_for_clients
  check (role <> 'client' or goal is not null);

-- ------------------------------------------------------------
-- 3. Trigger: pick up `goal` from raw_user_meta_data
-- ------------------------------------------------------------
create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, must_change_password, goal)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false),
    new.raw_user_meta_data->>'goal'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.fn_handle_new_auth_user() is
  'Creates a profiles row when a new auth.users record is inserted. '
  'Reads role, full_name, must_change_password, and goal from raw_user_meta_data.';

-- ------------------------------------------------------------
-- 4. RPC: trainer_create_client — now accepts p_goal (required)
-- Drop the old 6-arg signature and create the new 7-arg one.
-- ------------------------------------------------------------
drop function if exists public.trainer_create_client(text, text, text, text, date, text);

create or replace function public.trainer_create_client(
  p_email      text,
  p_password   text,
  p_full_name  text,
  p_goal       text,
  p_phone      text      default null,
  p_birth_date date      default null,
  p_notes      text      default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_trainer() then
    raise exception 'not_authorized: only a trainer can create clients'
      using errcode = 'insufficient_privilege';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'bad_input: email is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'bad_input: full_name is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_goal is null
     or p_goal not in ('muscle_gain', 'fat_loss', 'body_recomp', 'conditioning', 'maintenance') then
    raise exception 'bad_input: goal must be one of muscle_gain|fat_loss|body_recomp|conditioning|maintenance'
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is not null then
    raise exception 'conflict: a user with this email already exists'
      using errcode = 'unique_violation';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object(
      'role', 'client',
      'full_name', p_full_name,
      'must_change_password', true,
      'goal', p_goal
    ),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  update public.profiles
  set
    phone                = p_phone,
    birth_date           = p_birth_date,
    notes                = p_notes,
    must_change_password = true
  where id = v_user_id;

  return v_user_id;
end;
$$;

grant execute on function public.trainer_create_client(text, text, text, text, text, date, text)
  to authenticated;
