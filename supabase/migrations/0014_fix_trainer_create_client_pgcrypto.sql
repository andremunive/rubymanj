-- ============================================================
-- 0014_fix_trainer_create_client_pgcrypto.sql
-- Fix: trainer_create_client failed with
--   "function gen_salt(unknown) does not exist"
-- because pgcrypto is installed in the `extensions` schema but the
-- function ran with `set search_path = public`. Qualify crypt() and
-- gen_salt() explicitly so they resolve regardless of search_path.
-- ============================================================

create or replace function public.trainer_create_client(
  p_email      text,
  p_password   text,
  p_full_name  text,
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
      'must_change_password', true
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

grant execute on function public.trainer_create_client(text, text, text, text, date, text)
  to authenticated;
