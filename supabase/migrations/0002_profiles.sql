-- ============================================================
-- 0002_profiles.sql
-- profiles table: 1:1 extension of auth.users, roles, helpers,
-- RLS policies, and the trainer_create_client RPC.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions (needed by policies below and everywhere)
-- ------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_user_role() is
  'Returns the role column of the currently authenticated profile. SECURITY DEFINER so it cannot be bypassed via search_path.';

create or replace function public.is_trainer()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.current_user_role() = 'trainer';
$$;

comment on function public.is_trainer() is
  'Returns true if the current user has role=trainer. Used in all RLS policies.';

-- ------------------------------------------------------------
-- Table: profiles
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id                   uuid        not null,
  role                 text        not null,
  full_name            text        not null,
  email                text        not null,
  phone                text,
  birth_date           date,
  notes                text,
  must_change_password boolean     not null default false,
  is_active            boolean     not null default true,
  deactivated_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,

  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete restrict,
  constraint profiles_role_check
    check (role in ('trainer', 'client'))
);

comment on table public.profiles is
  'One-to-one extension of auth.users. Stores role, contact data, and the must_change_password flag. '
  'INVARIANT: id = auth.users.id (never a self-generated uuid). '
  'To deactivate a user set is_active=false (soft-delete). '
  'Deleting auth.users will fail while this row exists (FK RESTRICT).';

comment on column public.profiles.must_change_password is
  'Set to true by the trainer when creating a client. '
  'Cleared to false by the client after first password change. '
  'Client cannot set it back to true (enforced by BEFORE UPDATE trigger).';

comment on column public.profiles.notes is
  'Internal notes by the trainer about this client. Invisible to the client via RLS.';

-- Indexes
create unique index if not exists profiles_email_key on public.profiles(email);
create index if not exists profiles_role_active_idx on public.profiles(role) where is_active;

-- ------------------------------------------------------------
-- Trigger: set_updated_at
-- ------------------------------------------------------------

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.fn_set_updated_at() is
  'Generic BEFORE UPDATE trigger function that stamps updated_at = now().';

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- Trigger: on_profile_deactivate
-- Sets deactivated_at when is_active flips false → null when it flips back.
-- ------------------------------------------------------------

create or replace function public.fn_on_profile_deactivate()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = false and old.is_active = true then
    new.deactivated_at := now();
  elsif new.is_active = true and old.is_active = false then
    new.deactivated_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_deactivate
  before update on public.profiles
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function public.fn_on_profile_deactivate();

-- ------------------------------------------------------------
-- Trigger: enforce_client_profile_update
-- Clients can only update: phone, must_change_password (false only).
-- They cannot change role, full_name, email, notes, is_active,
-- birth_date, or set must_change_password back to true.
-- ------------------------------------------------------------

create or replace function public.fn_enforce_client_profile_update()
returns trigger
language plpgsql
as $$
begin
  -- Only apply restrictions when the caller is a client
  if public.current_user_role() = 'client' then
    -- Revert columns the client is not allowed to change
    new.role                 := old.role;
    new.full_name            := old.full_name;
    new.email                := old.email;
    new.birth_date           := old.birth_date;
    new.notes                := old.notes;
    new.is_active            := old.is_active;
    new.deactivated_at       := old.deactivated_at;
    new.created_at           := old.created_at;

    -- Client can clear must_change_password but never set it back to true
    if new.must_change_password = true and old.must_change_password = false then
      new.must_change_password := false;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.fn_enforce_client_profile_update() is
  'BEFORE UPDATE on profiles. When caller is a client, reverts all columns '
  'except phone. Also prevents client from setting must_change_password=true.';

create trigger trg_profiles_enforce_client_update
  before update on public.profiles
  for each row execute function public.fn_enforce_client_profile_update();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- SELECT: trainer sees all; client sees only own row
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  using (
    public.is_trainer()
    or id = auth.uid()
  );

-- UPDATE: trainer unrestricted; client own row only (column guard is the trigger above)
drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles
  for update
  using (
    public.is_trainer()
    or id = auth.uid()
  )
  with check (
    public.is_trainer()
    or id = auth.uid()
  );

-- INSERT: blocked at RLS level — inserts happen via trigger on auth.users or RPC
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
  on public.profiles
  for insert
  with check (false);

-- DELETE: blocked for everyone — soft-delete only
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
  on public.profiles
  for delete
  using (false);

-- ------------------------------------------------------------
-- Trigger: auto-create profile when auth.users row is created
-- This handles the trainer's own signup; clients are created via RPC.
-- The profile is created with role='client' by default; the first
-- user (the trainer) should have their role updated manually or via
-- the trainer_create_client RPC which forces role='client'.
-- NOTE: the trigger fires for ANY auth.users insert, so the trainer's
-- first signup also creates a profile. Ruby's role must be set to
-- 'trainer' manually after initial setup (see README).
-- ------------------------------------------------------------

create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.fn_handle_new_auth_user() is
  'Creates a profiles row when a new auth.users record is inserted. '
  'Role defaults to client unless raw_user_meta_data.role is set. '
  'The trainer must have role=trainer — set manually or pass it in raw_user_meta_data at signup.';

-- Attach to auth schema trigger (Supabase specific)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_auth_user();

-- ------------------------------------------------------------
-- RPC: trainer_create_client
-- Creates auth user + profile in one atomic transaction.
-- SECURITY DEFINER so it can write to auth.users via Supabase admin API.
-- NOTE: Supabase Edge Functions / service_role are typically used to
-- create auth users. In pure SQL we use supabase_auth_admin schema.
-- This function validates that the caller is a trainer before proceeding.
-- ------------------------------------------------------------

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
  -- Only a trainer can call this
  if not public.is_trainer() then
    raise exception 'not_authorized: only a trainer can create clients'
      using errcode = 'insufficient_privilege';
  end if;

  -- Validate inputs
  if p_email is null or trim(p_email) = '' then
    raise exception 'bad_input: email is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'bad_input: full_name is required'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Create the auth user via supabase's internal admin function
  -- This inserts into auth.users with the hashed password.
  -- Supabase exposes this via the auth admin API; from SQL we call
  -- the internal function that the dashboard uses.
  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is not null then
    raise exception 'conflict: a user with this email already exists'
      using errcode = 'unique_violation';
  end if;

  -- Insert directly into auth.users (requires SECURITY DEFINER + superuser grant
  -- on auth schema — Supabase grants this to postgres role by default)
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
    crypt(p_password, gen_salt('bf')),
    now(),   -- mark email as confirmed (trainer creates on behalf)
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

  -- The fn_handle_new_auth_user trigger will create the profile row.
  -- We then update it with the extra fields the trigger cannot provide.
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

comment on function public.trainer_create_client(text, text, text, text, date, text) is
  'Creates a new client: inserts into auth.users and populates profiles. '
  'SECURITY DEFINER. Validates is_trainer() before executing. '
  'Sets must_change_password=true so the client is prompted on first login.';

grant execute on function public.trainer_create_client(text, text, text, text, date, text)
  to authenticated;

-- ============================================================
-- DOWN
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop trigger if exists trg_profiles_enforce_client_update on public.profiles;
-- drop trigger if exists trg_profiles_deactivate on public.profiles;
-- drop trigger if exists trg_profiles_set_updated_at on public.profiles;
-- drop policy if exists profiles_delete on public.profiles;
-- drop policy if exists profiles_insert on public.profiles;
-- drop policy if exists profiles_update on public.profiles;
-- drop policy if exists profiles_select on public.profiles;
-- drop table if exists public.profiles;
-- drop function if exists public.trainer_create_client(text,text,text,text,date,text);
-- drop function if exists public.fn_handle_new_auth_user();
-- drop function if exists public.fn_enforce_client_profile_update();
-- drop function if exists public.fn_on_profile_deactivate();
-- drop function if exists public.fn_set_updated_at();
-- drop function if exists public.is_trainer();
-- drop function if exists public.current_user_role();
-- ============================================================
