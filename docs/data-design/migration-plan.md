# Rubymanj — Plan de Migraciones (Fase 1)

> Orden sugerido. El backend-engineer convierte cada paso en un archivo SQL dentro
> de `supabase/migrations/` (o el gestor que se escoja). El plan prioriza:
> dependencias de FK, activar RLS **antes** de cualquier DML, y dejar funciones
> analíticas al final porque dependen del esquema ya estable.

## Regla general por cada archivo

1. Crea objetos (tablas / índices / triggers).
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` inmediatamente después de crear la tabla.
3. `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` en tablas donde queremos que la
   policy aplique incluso a roles owner (defensa en profundidad).
4. Declara las policies en el **mismo** archivo de la tabla, no en otro — mantener
   tabla + policies juntas facilita revertir.

## Orden

### `0001_extensions.sql`
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (para `gen_random_uuid()`).
- `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` (opcional, si se usa).
- Verificar `citext` si se decide usar para `email` (opcional; hoy plan es `text`).

### `0002_profiles.sql`
- Tabla `profiles` + CHECK de `role`.
- **FK `profiles.id → auth.users(id) ON DELETE RESTRICT`** (no CASCADE).
- Índices (role parcial, unique email).
- Triggers: `set_updated_at`, `on_profile_deactivate`.
- Función `public.current_role()`, `public.is_trainer()` (SECURITY DEFINER, STABLE).
- `ENABLE ROW LEVEL SECURITY`.
- Policies SELECT / UPDATE / INSERT / DELETE (DELETE denegada).
- Trigger opcional: `handle_new_auth_user()` que inserta una fila en `profiles`
  cuando Supabase crea un `auth.users` (solo si el backend decide usarlo; puede
  preferirse RPC `trainer_create_client`).
- RPC `trainer_create_client(email, password, full_name, phone, birth_date)` que
  crea el usuario en auth + el profile con `role='client'`, `must_change_password=true`.
  (SECURITY DEFINER, valida `is_trainer()` internamente.)

### `0003_plans.sql`
- Tabla `plans`.
- Seed inicial: `('trimestral', 'Trimestral', 90, null)`.
- RLS + policies (lectura autenticada, escritura trainer).

### `0004_payments.sql`
- Tabla `payments` con FKs a `profiles` y `plans`.
- Índices `(client_id, paid_on DESC)`, `(due_date)`.
- Trigger `calc_payment_due_date` BEFORE INSERT — solo calcula si `due_date IS NULL`;
  si viene con valor, se respeta.
- RLS + policies (trainer full / cliente SELECT propios).

### `0005_muscles.sql`
- Tabla `muscles`.
- Seed con ~25-30 músculos comunes organizados por `muscle_group`.
- RLS + policies (lectura autenticada, escritura trainer).

### `0006_exercises.sql`
- Tabla `exercises`.
- Índice por nombre.
- Trigger `set_updated_at`.
- RLS + policies. Policy de SELECT para clientas restringida a los ejercicios que
  aparecen en alguna de sus rutinas (EXISTS sobre `routine_exercises`+`routines`).

### `0007_exercise_muscles.sql`
- Tabla pivote con PK compuesta.
- Índice `(muscle_id)`.
- RLS + policies.

### `0008_routines.sql`
- Tabla `routines` con todos los CHECK de coherencia de fechas.
- FK auto-referencial `source_routine_id`.
- Índices: `(client_id, scheduled_date DESC)`, `(scheduled_date)`, parcial
  `(client_id, status) WHERE status IN ('pending','in_progress')`, parcial
  `(client_id, completed_at) WHERE status = 'completed'` (apoya `fn_muscles_worked`).
- Triggers:
  - `set_updated_at`
  - `enforce_routine_status_transitions`
  - `enforce_client_update_routines`
- RLS + policies.

### `0009_routine_exercises.sql`
- Tabla `routine_exercises`. Columnas de peso: **`recommended_weight` +
  `recommended_weight_unit`** (el `weight_unit` viejo se renombra/entiende como
  `recommended_weight_unit`, ver schema.md §3.7).
- UNIQUE `(routine_id, position)`.
- Índice `(exercise_id)`.
- Trigger `enforce_client_update_routine_exercises` (columna permitida para clienta:
  `client_notes`).
- **Trigger `fn_routine_exercises_immutable`** (BEFORE INSERT OR UPDATE OR DELETE)
  que bloquea cambios cuando la rutina padre no está en `status='pending'`, con la
  excepción de UPDATE por clienta sobre `client_notes` mientras la rutina esté en
  `pending` o `in_progress` (ver schema.md §8.A.1).
- RLS + policies.

### `0010_routine_exercise_sets.sql`
- Tabla `routine_exercise_sets`. **Solo** columnas: `id`, `routine_exercise_id`,
  `set_number`, `performed_reps`, `created_at`. **No** `performed_weight`, **no**
  `weight_unit` (el peso vive en `routine_exercises.recommended_weight`; las
  desviaciones se anotan en `routine_exercises.client_notes`).
- UNIQUE `(routine_exercise_id, set_number)`.
- **Trigger `fn_routine_exercise_sets_immutable`** (BEFORE INSERT OR UPDATE OR
  DELETE) con las reglas por status + rol descritas en schema.md §8.A.2
  (pending → solo trainer pre-inicializa; in_progress → trainer y clienta dueña;
  completed/skipped → inmutable para todos).
- RLS + policies (clienta puede INSERT/UPDATE/DELETE en filas de rutinas propias
  **solo mientras la rutina esté en `in_progress`**; el trigger refuerza esto).

### `0011_routine_surveys.sql`
- Tabla `routine_surveys` (PK = FK a `routines`). `evidence_path` opcional (NULL
  permitido).
- **Trigger `fn_routine_surveys_immutable`** (BEFORE UPDATE OR DELETE) — clienta no
  puede modificar ni borrar; trainer sí (uso excepcional).
- RLS + policies: INSERT por clienta dueña o trainer; UPDATE/DELETE solo trainer.

### `0012_storage_routine_evidence.sql`
- `INSERT INTO storage.buckets` para `routine-evidence` (privado).
- Policies sobre `storage.objects` para ese bucket:
  - SELECT: trainer o `auth.uid()::text = (storage.foldername(name))[1]`.
  - INSERT: trainer o `auth.uid()::text = (storage.foldername(name))[1]`.
  - DELETE: solo trainer.

### `0013_views_and_functions.sql`
- Vista `v_client_adherence` (agregación semanal con `AT TIME ZONE 'America/Bogota'`).
- Función `fn_client_adherence(client_id, from, to)` — interpreta rango en
  `America/Bogota`.
- **Función `fn_muscles_worked(client_id, from, to)`** — cuenta rutinas con
  `status='completed'` y `completed_at AT TIME ZONE 'America/Bogota'` en rango.
- **Función `fn_muscles_planned(client_id, from, to)`** — cuenta rutinas por
  `scheduled_date` en rango, independiente del status. Mismo shape de salida que
  `fn_muscles_worked`. Ver schema.md §4.2.
- Función `fn_duplicate_routine(source_routine_id, target_client_id, target_date, new_name)`
  — `SECURITY DEFINER`, valida `is_trainer()` al entrar. Como la rutina nueva nace
  en `pending`, los triggers de inmutabilidad de `routine_exercises` la aceptan.
- `GRANT EXECUTE ... TO authenticated` en las funciones que lo necesiten.

### `0014_seed_dev.sql` (opcional, solo dev)
- Usuario trainer de prueba (solo en entornos locales).
- 2 clientas dummy.
- 5-10 ejercicios con músculos asignados.
- Un par de rutinas.
- Marcado con `-- DEV ONLY — do not run in prod`.

## Validaciones post-migración (checklist manual del backend)

- [ ] Crear una clienta vía `trainer_create_client` y verificar que `must_change_password = true`.
- [ ] Login como clienta → intentar SELECT a `profiles` de otra clienta (debe fallar).
- [ ] Login como clienta → intentar SELECT a un `exercise` que NO está en ninguna de
      sus rutinas (debe devolver 0 filas por RLS de `exercises`).
- [ ] Login como clienta → UPDATE sobre `routine_exercises.recommended_sets` (debe
      revertirse por trigger).
- [ ] Login como clienta → UPDATE sobre `routine_exercises.client_notes` en rutina
      propia mientras está en `in_progress` (debe pasar).
- [ ] Login como clienta → INSERT en `routine_exercise_sets` de rutina propia **en
      `in_progress`** (debe pasar); de rutina ajena (debe fallar por RLS); de rutina
      propia en `pending` (debe fallar por trigger de inmutabilidad).
- [ ] Cerrar una rutina (status → `completed`) y luego intentar UPDATE/DELETE sobre
      sus `routine_exercise_sets` — debe fallar con mensaje de inmutabilidad, tanto
      para clienta como para trainer.
- [ ] Insertar `routine_exercises` vía trainer en una rutina en `pending` (debe
      pasar); luego pasar la rutina a `in_progress` e intentar insertar otro
      `routine_exercises` (debe fallar por trigger de inmutabilidad).
- [ ] `fn_duplicate_routine` sobre una rutina en `completed` — debe crear una nueva
      en `pending` con los mismos ejercicios copiados, sin tocar la original.
- [ ] `fn_duplicate_routine` llamada por cliente: debe fallar con "not authorized".
- [ ] `fn_muscles_worked` con rango vacío: devuelve 0 filas, no error.
- [ ] `fn_muscles_worked` y `fn_muscles_planned` devuelven el mismo shape y
      difieren solo en el filtro (status vs rango de `scheduled_date` / `completed_at`).
- [ ] Adherencia semanal: crear 2 rutinas en la misma semana local de Bogota pero
      en días que cruzan medianoche UTC; verificar que `v_client_adherence` las
      agrupa en la misma `period_start`.
- [ ] Clienta intenta UPDATE/DELETE en `routine_surveys` propio — debe fallar.
      Trainer puede editarlo.
- [ ] Desactivar una clienta (`is_active=false`): `deactivated_at` se setea por trigger.
- [ ] Intentar DELETE en `profiles`: policy debe bloquear.
- [ ] Intentar DELETE en `auth.users` de una clienta con profile: debe fallar por
      FK RESTRICT de `profiles.id`.

## Estrategia de rollback

Cada archivo comienza con un bloque `-- DOWN` comentado al final con el SQL inverso
(`DROP POLICY`, `DROP TRIGGER`, `DROP FUNCTION`, `DROP TABLE`). No se ejecuta
automáticamente, pero queda documentado para emergencias.
