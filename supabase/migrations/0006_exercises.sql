-- ============================================================
-- 0006_exercises.sql
-- Reusable exercise bank created by the trainer.
-- Clients can only see exercises that appear in their own routines.
-- ============================================================

create table if not exists public.exercises (
  id                   uuid        not null default gen_random_uuid(),
  name                 text        not null,
  description          text,
  media_url            text,
  media_platform       text,
  default_weight_unit  text        not null default 'kg',
  is_active            boolean     not null default true,
  created_by           uuid        not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,

  constraint exercises_pkey primary key (id),
  constraint exercises_created_by_fkey
    foreign key (created_by) references public.profiles(id),
  constraint exercises_media_platform_check
    check (media_platform is null or media_platform in
      ('youtube', 'tiktok', 'instagram', 'facebook', 'drive', 'other')),
  constraint exercises_default_weight_unit_check
    check (default_weight_unit in ('kg', 'lb'))
);

comment on table public.exercises is
  'Reusable exercise bank. Each exercise is created by the trainer and can be assigned '
  'to multiple routines. Clients can only see exercises present in their own routines (RLS).';

comment on column public.exercises.media_url is
  'Single URL to a video or resource. If multiple videos are needed in the future, '
  'add table exercise_media(id, exercise_id, url, platform, position) without touching this table.';

-- Index for name search (partial for active only)
create index if not exists exercises_name_search_idx
  on public.exercises using btree (name text_pattern_ops)
  where is_active;

-- Trigger: updated_at
create trigger trg_exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.exercises force row level security;

-- Trainer sees all. Client sees only exercises that appear in one of her routines.
drop policy if exists exercises_select on public.exercises;
create policy exercises_select
  on public.exercises
  for select
  using (
    public.is_trainer()
    or exists (
      select 1
      from public.routine_exercises re
      join public.routines r on r.id = re.routine_id
      where re.exercise_id = exercises.id
        and r.client_id = auth.uid()
    )
  );

-- Only trainer can write
drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert
  on public.exercises
  for insert
  with check (public.is_trainer());

drop policy if exists exercises_update on public.exercises;
create policy exercises_update
  on public.exercises
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete
  on public.exercises
  for delete
  using (public.is_trainer());

-- ============================================================
-- DOWN
-- drop trigger if exists trg_exercises_set_updated_at on public.exercises;
-- drop policy if exists exercises_delete on public.exercises;
-- drop policy if exists exercises_update on public.exercises;
-- drop policy if exists exercises_insert on public.exercises;
-- drop policy if exists exercises_select on public.exercises;
-- drop table if exists public.exercises;
-- ============================================================
