-- ============================================================
-- 0005_muscles.sql
-- Muscle catalogue with ~28 entries organized by muscle_group.
-- ============================================================

create table if not exists public.muscles (
  id           uuid    not null default gen_random_uuid(),
  code         text    not null,
  name         text    not null,
  muscle_group text    not null,
  is_active    boolean not null default true,

  constraint muscles_pkey primary key (id),
  constraint muscles_code_key unique (code),
  constraint muscles_group_check check (
    muscle_group in ('upper_body', 'lower_body', 'core', 'cardio')
  )
);

comment on table public.muscles is
  'Catalogue of muscles / muscle groups used to tag exercises and drive analytics. '
  'code is stable (English, snake_case) and used as identifier in queries. '
  'name is the Spanish display label shown to Ruby and clients.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.muscles enable row level security;
alter table public.muscles force row level security;

-- Any authenticated user can read (needed for exercise creation UI and analytics)
drop policy if exists muscles_select on public.muscles;
create policy muscles_select
  on public.muscles
  for select
  using (auth.role() = 'authenticated');

drop policy if exists muscles_insert on public.muscles;
create policy muscles_insert
  on public.muscles
  for insert
  with check (public.is_trainer());

drop policy if exists muscles_update on public.muscles;
create policy muscles_update
  on public.muscles
  for update
  using (public.is_trainer())
  with check (public.is_trainer());

drop policy if exists muscles_delete on public.muscles;
create policy muscles_delete
  on public.muscles
  for delete
  using (public.is_trainer());

-- ------------------------------------------------------------
-- Seed: ~28 muscles
-- ON CONFLICT DO NOTHING so re-applying this migration is safe.
-- ------------------------------------------------------------

insert into public.muscles (code, name, muscle_group) values
  -- upper_body
  ('chest',          'Pecho (pectoral)',          'upper_body'),
  ('upper_chest',    'Pecho superior',             'upper_body'),
  ('lats',           'Espalda (dorsales)',         'upper_body'),
  ('upper_back',     'Espalda alta (trapecios)',   'upper_body'),
  ('rhomboids',      'Romboides',                  'upper_body'),
  ('rear_delts',     'Deltoides posterior',        'upper_body'),
  ('front_delts',    'Deltoides anterior',         'upper_body'),
  ('side_delts',     'Deltoides lateral',          'upper_body'),
  ('biceps',         'Bíceps',                     'upper_body'),
  ('triceps',        'Tríceps',                    'upper_body'),
  ('forearms',       'Antebrazos',                 'upper_body'),
  ('neck',           'Cuello',                     'upper_body'),
  -- lower_body
  ('quads',          'Cuádriceps',                 'lower_body'),
  ('hamstrings',     'Isquiotibiales',             'lower_body'),
  ('glutes',         'Glúteos',                    'lower_body'),
  ('glute_med',      'Glúteo medio',               'lower_body'),
  ('adductors',      'Aductores',                  'lower_body'),
  ('abductors',      'Abductores',                 'lower_body'),
  ('calves',         'Gemelos / pantorrillas',     'lower_body'),
  ('soleus',         'Sóleo',                      'lower_body'),
  ('hip_flexors',    'Flexores de cadera',         'lower_body'),
  ('it_band',        'Banda iliotibial',           'lower_body'),
  -- core
  ('abs',            'Abdominales',                'core'),
  ('obliques',       'Oblicuos',                   'core'),
  ('lower_back',     'Espalda baja (lumbares)',    'core'),
  ('transverse_abs', 'Transverso abdominal',       'core'),
  -- cardio / full-body
  ('full_body',      'Cuerpo completo',            'cardio'),
  ('cardio',         'Cardio',                     'cardio')
on conflict (code) do nothing;

-- ============================================================
-- DOWN
-- drop policy if exists muscles_delete on public.muscles;
-- drop policy if exists muscles_update on public.muscles;
-- drop policy if exists muscles_insert on public.muscles;
-- drop policy if exists muscles_select on public.muscles;
-- drop table if exists public.muscles;
-- ============================================================
