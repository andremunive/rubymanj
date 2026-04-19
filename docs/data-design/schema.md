# Rubymanj — Diseño de Esquema (Fase 1)

> Alcance: clientes, planes/pagos, banco de ejercicios, rutinas, encuesta post-rutina,
> copia de rutinas, analítica de músculos y adherencia.
> **Fuera de alcance:** reuniones, calendario, perfil extendido del cliente (próxima fase).

---

## 1. Contexto

Ruby es entrenadora personal online. Gestiona asesoradas (clientas) que consumen las
rutinas que ella arma. Este diseño cubre el núcleo transaccional: identidad con rol,
cobro, catálogo de ejercicios, rutinas con su ejecución, y las dos analíticas que
Ruby necesita (adherencia y músculos trabajados).

Principios que guiaron todas las decisiones:

- **Separar datos del entrenador de datos de la clienta** dentro de las rutinas: es
  lo que permite (a) RLS fina que impide que la clienta modifique lo que no le
  corresponde, y (b) copiar rutinas limpiamente.
- **Soft-delete siempre**: clientas, ejercicios, planes — se desactivan, no se borran.
- **Extensibilidad por CHECK + tabla de catálogo** en vez de `ENUM` nativo. Agregar
  un valor nuevo no requiere `ALTER TYPE`.
- **Identificadores uuid** alineados con `auth.users.id` (el `profiles.id` ES el
  `auth.users.id`, no un id propio). Esto simplifica RLS dramáticamente.
- **Inmutabilidad de la estructura ejecutada.** Una vez que una rutina sale de
  `pending`, sus ejercicios planeados no se tocan más; la ejecución (sets) se congela
  al completar. El mecanismo de edición para "copiar y ajustar" es
  `fn_duplicate_routine`.

---

## 2. Diagrama de entidades

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1"
    profiles ||--o{ payments : "client_id"
    plans ||--o{ payments : "plan_id"
    profiles ||--o{ routines : "client_id (as client)"
    profiles ||--o{ routines : "trainer_id (as trainer)"
    routines ||--o{ routine_exercises : "routine_id"
    exercises ||--o{ routine_exercises : "exercise_id"
    routine_exercises ||--o{ routine_exercise_sets : "routine_exercise_id"
    routines ||--o| routine_surveys : "routine_id (1:1)"
    muscles ||--o{ exercise_muscles : "muscle_id"
    exercises ||--o{ exercise_muscles : "exercise_id"

    profiles {
      uuid id PK "= auth.users.id"
      text role "trainer | client"
      text full_name
      text email
      text phone
      date birth_date
      text notes
      boolean must_change_password
      boolean is_active
      timestamptz deactivated_at
      timestamptz created_at
      timestamptz updated_at
    }
    plans {
      uuid id PK
      text code UK "trimestral, mensual, ..."
      text name
      int duration_days
      numeric price
      boolean is_active
    }
    payments {
      uuid id PK
      uuid client_id FK
      uuid plan_id FK
      date paid_on
      numeric amount
      date due_date
      text payment_method
      text notes
      uuid created_by FK
    }
    muscles {
      uuid id PK
      text code UK
      text name
      text muscle_group
    }
    exercises {
      uuid id PK
      text name
      text description
      text media_url
      text media_platform
      boolean is_active
      uuid created_by FK
    }
    exercise_muscles {
      uuid exercise_id PK_FK
      uuid muscle_id PK_FK
      boolean is_primary
    }
    routines {
      uuid id PK
      uuid client_id FK
      uuid trainer_id FK
      text name
      date scheduled_date
      text status "pending|in_progress|completed|skipped"
      timestamptz started_at
      timestamptz completed_at
      text trainer_notes
      uuid source_routine_id FK "rutina origen si es copia"
    }
    routine_exercises {
      uuid id PK
      uuid routine_id FK
      uuid exercise_id FK
      int position
      int recommended_sets
      int recommended_reps
      numeric recommended_weight
      text recommended_weight_unit "kg|lb"
      int rest_seconds
      text trainer_notes
      text client_notes
    }
    routine_exercise_sets {
      uuid id PK
      uuid routine_exercise_id FK
      int set_number
      int performed_reps
    }
    routine_surveys {
      uuid routine_id PK_FK
      text overall_feeling
      text weights_feeling
      text notes
      jsonb extra_answers
      text evidence_path
      timestamptz submitted_at
    }
```

---

## 3. Tablas

### 3.1 `profiles`

**Propósito.** Extensión 1:1 de `auth.users`. Guarda rol, datos de contacto editables
y el flag de cambio de contraseña obligatorio en el primer login.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id) ON DELETE RESTRICT` | **ES** el id de auth. No genera uno propio. |
| `role` | `text` | NOT NULL, CHECK (`role IN ('trainer','client')`) | |
| `full_name` | `text` | NOT NULL | |
| `email` | `text` | NOT NULL | Espejo de `auth.users.email` para queries fáciles; sincronizado por trigger o al alta. |
| `phone` | `text` | NULL | |
| `birth_date` | `date` | NULL | |
| `notes` | `text` | NULL | Notas internas de Ruby sobre la clienta. |
| `must_change_password` | `boolean` | NOT NULL DEFAULT `false` | `true` al crear clienta, `false` tras cambio. |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` | Soft-delete. |
| `deactivated_at` | `timestamptz` | NULL | Se setea cuando `is_active` pasa a false. |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NULL, trigger de update | |

**Índices:**
- PK implícito.
- `CREATE INDEX ON profiles(role) WHERE is_active;` — listados rápidos de clientas activas.
- `CREATE UNIQUE INDEX ON profiles(email);` — email único entre perfiles.

**Decisión — flag de cambio de contraseña.**
- **Decisión:** columna `must_change_password boolean` en `profiles`.
- **Alternativa considerada:** `raw_user_meta_data` en `auth.users`.
- **Razón:** `user_metadata` es escribible por el propio usuario vía JWT → la clienta
  podría saltarse el flag. En `profiles` con RLS estricta (solo la propia clienta
  puede poner el flag en `false`, nunca en `true`; solo el trainer puede ponerlo en
  `true`), el flag es confiable. Además, vive junto al resto del perfil, se consulta
  con un solo SELECT y no depende de estructura opaca de Supabase.

**Decisión — rol en tabla vs. JWT claim.**
- **Decisión:** columna `role` en `profiles` + función `public.is_trainer()` que la lee.
- **Alternativa considerada:** custom JWT claim vía hook de Supabase Auth.
- **Razón:** la tabla es más simple de auditar y modificar. El coste de un join extra
  en RLS es insignificante gracias al índice por PK y porque la fila de `profiles`
  del usuario autenticado se cachea por query.

**Decisión — comportamiento de la FK a `auth.users`.**
- **Decisión:** `ON DELETE RESTRICT`.
- **Alternativa considerada:** `ON DELETE CASCADE`.
- **Razón:** si alguien borra manualmente un `auth.users` (desde dashboard de Supabase,
  por error o por limpieza), `CASCADE` se llevaría por delante el profile, lo cual
  rompería la integridad histórica (pagos con FK a profile con `ON DELETE RESTRICT`
  empezarían a fallar; además se perdería la trazabilidad). `RESTRICT` obliga al
  operador a seguir el procedimiento correcto: primero marcar `is_active = false` en
  `profiles` (soft-delete) y, si de verdad hay que eliminar físicamente, borrar a
  mano todas las filas dependientes en este orden: `routine_exercise_sets` →
  `routine_exercises` → `routine_surveys` → `routines` → `payments` → `profiles` →
  `auth.users`. En la práctica diaria **nunca se borra**; lo normal es desactivar.
  Documentar en el runbook del trainer que "eliminar" = `is_active=false`.

---

### 3.2 `plans`

**Propósito.** Catálogo de planes (trimestral inicial, extensible).

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK default `gen_random_uuid()` | |
| `code` | `text` | NOT NULL, UNIQUE | `trimestral`, `mensual`, `semestral`, `anual`. |
| `name` | `text` | NOT NULL | Etiqueta visible. |
| `duration_days` | `integer` | NOT NULL, CHECK `> 0` | Base para calcular `due_date` del pago. |
| `price` | `numeric(12,2)` | NULL | Precio de referencia; el pago guarda el monto real. |
| `description` | `text` | NULL | |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NULL | |

**Seed inicial:** una fila `('trimestral', 'Trimestral', 90, ...)`.

**Índices:** PK; UNIQUE en `code`.

---

### 3.3 `payments`

**Propósito.** Historial de pagos de cada clienta, con vencimiento calculado.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | NOT NULL, FK → `profiles(id) ON DELETE RESTRICT` | |
| `plan_id` | `uuid` | NOT NULL, FK → `plans(id) ON DELETE RESTRICT` | |
| `paid_on` | `date` | NOT NULL | |
| `amount` | `numeric(12,2)` | NOT NULL, CHECK `>= 0` | |
| `due_date` | `date` | NOT NULL | Si viene NULL al insertar, el trigger lo calcula como `paid_on + plan.duration_days`. Si Ruby lo setea explícitamente, **se respeta** (caso "le regalé una semana"). Se almacena para no depender de `duration_days` histórico. |
| `payment_method` | `text` | NULL, CHECK `IN ('cash','transfer','card','yape','plin','other')` | Ajustable. |
| `notes` | `text` | NULL | |
| `created_by` | `uuid` | NOT NULL, FK → `profiles(id)` | Auditoría; normalmente Ruby. |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**Índices:**
- `CREATE INDEX ON payments(client_id, paid_on DESC);` — "últimos pagos de una clienta".
- `CREATE INDEX ON payments(due_date);` — "quién vence esta semana".

**Nota de diseño:** `due_date` se **almacena**, no se calcula al vuelo. Si mañana
Ruby cambia `duration_days` de un plan, los pagos históricos conservan su vencimiento
real. Se permiten **varios pagos activos** (no vencidos) simultáneos para una misma
clienta; el "vencimiento real" de una clienta se obtiene con
`SELECT MAX(due_date) FROM payments WHERE client_id = X`.

---

### 3.4 `muscles` + `exercise_muscles` (catálogo normalizado)

**Decisión — músculos normalizados en tabla vs `text[]`.**
- **Decisión:** tabla catálogo `muscles` + tabla pivote `exercise_muscles`.
- **Alternativa considerada:** `target_muscles text[]` en `exercises`.
- **Razón:** las analíticas son el caso de uso principal (qué músculos trabajó una
  clienta en una semana/mes). Con `text[]` necesito `unnest` + `lower()` en cada
  query y es frágil ante typos ("biceps" vs "Bíceps" vs "bicep"). Con tabla:
  - joins rápidos indexados,
  - UI puede mostrar un selector con grupos (pecho, espalda, pierna...),
  - internacionalización futura (columna `name_en`) sin romper datos,
  - `is_primary` distingue músculo principal vs. secundario → analítica más rica.
  El coste es una migración de seed con ~30 filas; despreciable.

#### `muscles`

| Columna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `text` | NOT NULL UNIQUE (`chest`, `lats`, `biceps`, `quads`, ...) |
| `name` | `text` | NOT NULL (etiqueta es-ES) |
| `muscle_group` | `text` | NOT NULL (`upper_body`, `lower_body`, `core`, `cardio`) |
| `is_active` | `boolean` | DEFAULT `true` |

Seed con ~25-30 músculos/grupos comunes.

#### `exercise_muscles`

| Columna | Tipo | Constraints |
|---|---|---|
| `exercise_id` | `uuid` | FK → `exercises(id) ON DELETE CASCADE` |
| `muscle_id` | `uuid` | FK → `muscles(id) ON DELETE RESTRICT` |
| `is_primary` | `boolean` | NOT NULL DEFAULT `false` |
| **PK compuesta** | | `(exercise_id, muscle_id)` |

**Índices:**
- `CREATE INDEX ON exercise_muscles(muscle_id);` — "ejercicios que trabajan X".

---

### 3.5 `exercises`

**Propósito.** Banco reutilizable de ejercicios.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `name` | `text` | NOT NULL | |
| `description` | `text` | NULL | Explicación textual. |
| `media_url` | `text` | NULL | URL única al video/recurso. |
| `media_platform` | `text` | NULL, CHECK `IN ('youtube','tiktok','instagram','facebook','drive','other')` | Permite renderizar embed correcto. |
| `default_weight_unit` | `text` | NOT NULL DEFAULT `'kg'`, CHECK `IN ('kg','lb')` | |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` | Soft-delete. |
| `created_by` | `uuid` | NOT NULL, FK → `profiles(id)` | Ruby, hoy. |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NULL | |

**Índices:**
- `CREATE INDEX ON exercises(name text_pattern_ops) WHERE is_active;` — búsqueda por nombre.

**Nota de extensibilidad:** hoy es `media_url` única. Si en el futuro un ejercicio
necesita múltiples videos, se crea una tabla `exercise_media(id, exercise_id, url,
platform, position)` sin romper nada. Se evita sobre-ingeniería ahora.

**Visibilidad para clientas.** La policy de SELECT en `exercises` limita a la clienta
a los ejercicios que aparecen en alguna de sus rutinas asignadas (ver sección 5).

---

### 3.6 `routines`

**Propósito.** Sesión de entrenamiento asignada a UNA clienta para UNA fecha.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `client_id` | `uuid` | NOT NULL, FK → `profiles(id) ON DELETE RESTRICT` | |
| `trainer_id` | `uuid` | NOT NULL, FK → `profiles(id)` | Quién la creó. |
| `name` | `text` | NOT NULL | "Pierna 1", "Espalda + bíceps", etc. |
| `scheduled_date` | `date` | NOT NULL | Fecha objetivo. |
| `status` | `text` | NOT NULL DEFAULT `'pending'`, CHECK `IN ('pending','in_progress','completed','skipped')` | |
| `started_at` | `timestamptz` | NULL | Cronómetro arranca aquí. |
| `completed_at` | `timestamptz` | NULL | Cronómetro termina aquí. |
| `trainer_notes` | `text` | NULL | Notas globales del trainer. |
| `source_routine_id` | `uuid` | NULL, FK → `routines(id) ON DELETE SET NULL` | Si es copia, apunta al origen. Útil para trazabilidad. |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NULL | |

**CHECK coherencia de fechas:**
- `started_at IS NULL OR status <> 'pending'`
- `completed_at IS NULL OR started_at IS NOT NULL`
- `completed_at IS NULL OR completed_at >= started_at`

**Índices:**
- `CREATE INDEX ON routines(client_id, scheduled_date DESC);` — agenda de una clienta.
- `CREATE INDEX ON routines(scheduled_date);` — vista global del trainer.
- `CREATE INDEX ON routines(client_id, status) WHERE status IN ('pending','in_progress');` — pendientes.

**Decisión — cronómetro persistente.**
- Se guarda solo `started_at` y `completed_at`. El front calcula el elapsed como
  `now() - started_at`. No hace falta guardar duración derivada; si se quiere, es
  una columna generada `duration_seconds GENERATED ALWAYS AS (EXTRACT(EPOCH FROM completed_at - started_at)) STORED`.

**Regla de inmutabilidad (ver sección 8.A).** Una vez que `status` deja de ser
`pending`, la estructura planeada de la rutina queda congelada: ya no se pueden
insertar, actualizar ni borrar filas de `routine_exercises` ligadas a esta rutina.
Si Ruby quiere una variante de la rutina, duplica vía `fn_duplicate_routine` (que
crea una rutina nueva en `pending`, editable).

---

### 3.7 `routine_exercises`

**Propósito.** Items de una rutina. Mezcla campos del entrenador (recomendaciones)
y de la clienta (notas propias). Las repeticiones reales por serie viven en la hija.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `routine_id` | `uuid` | NOT NULL, FK → `routines(id) ON DELETE CASCADE` | |
| `exercise_id` | `uuid` | NOT NULL, FK → `exercises(id) ON DELETE RESTRICT` | |
| `position` | `integer` | NOT NULL, CHECK `>= 0` | Orden visual en la rutina. |
| `recommended_sets` | `integer` | NOT NULL, CHECK `>= 1` | **campo trainer** |
| `recommended_reps` | `integer` | NULL, CHECK `>= 1` | **campo trainer**. Null = libre/AMRAP. |
| `recommended_weight` | `numeric(6,2)` | NULL, CHECK `>= 0` | **campo trainer**. Es el **único** peso del sistema — no se registra peso real por serie. |
| `recommended_weight_unit` | `text` | NOT NULL DEFAULT `'kg'`, CHECK `IN ('kg','lb')` | Se copia del ejercicio al crear. **Único uso del enum `weight_unit` en el esquema.** |
| `rest_seconds` | `integer` | NULL, CHECK `>= 0` | **campo trainer** |
| `trainer_notes` | `text` | NULL | **campo trainer** |
| `client_notes` | `text` | NULL | **campo clienta**. Observación de la clienta sobre ese ejercicio — **incluye desviaciones de peso** (p. ej. "subí a 15 kg", "bajé 2 kg por molestia en el hombro"), molestias, sensaciones, o cualquier comentario que quiera pasar a Ruby. |

**Índices:**
- UNIQUE `(routine_id, position)` — evita colisión de orden.
- `CREATE INDEX ON routine_exercises(exercise_id);` — "dónde se ha usado este ejercicio".

**Regla de inmutabilidad (ver sección 8.A).** `routine_exercises` solo acepta INSERT,
UPDATE y DELETE cuando la rutina padre está en `status = 'pending'`. Una vez que la
rutina arranca (`in_progress`), no se pueden añadir/quitar ejercicios ni modificar
los campos del trainer de los existentes. Excepción editable siempre: la columna
`client_notes` (la escribe la clienta durante la ejecución y puede seguir ajustándose
hasta `completed`).

---

### 3.8 `routine_exercise_sets`

**Decisión — reps por serie: `int[]` vs. tabla hija.**
- **Decisión:** tabla hija `routine_exercise_sets`.
- **Alternativa considerada:** `performed_reps int[]` en `routine_exercises`.
- **Razón:**
  1. RLS granular por operación es más clara sobre filas que sobre elementos de array.
  2. Permite crecer (RIR, RPE, tempo) sin migrar datos existentes.
  3. El volumen es bajo: ~4-5 sets × ~6-8 ejercicios × N rutinas. Decenas de miles
     de filas al año por clienta; irrelevante para Postgres.

**Decisión — peso real por serie.**
- **Decisión:** **no se registra peso real por serie.** Se conserva únicamente
  `recommended_weight` + `recommended_weight_unit` en `routine_exercises` como fuente
  única de verdad del peso. Si la clienta sube o baja el peso respecto al recomendado,
  **lo anota en `routine_exercises.client_notes`** (texto libre por ejercicio).
- **Alternativa considerada:** columnas `performed_weight numeric` y
  `weight_unit text` por cada set, simétricas a `performed_reps`.
- **Razón:** Ruby quiere que la rutina siempre refleje el peso **que ella prescribió**,
  no una bitácora de pesos reales por serie. El detalle de "ese día fue pesado / lo
  bajé / me sentí fuerte" queda mejor en un comentario libre que en una columna
  numérica que obliga a la clienta a decidir un número por serie (fricción alta en
  mobile). Si en el futuro se quiere una bitácora real por serie, se añade
  `performed_weight` y `performed_weight_unit` a esta tabla sin romper lo existente.

| Columna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `routine_exercise_id` | `uuid` | NOT NULL, FK → `routine_exercises(id) ON DELETE CASCADE` |
| `set_number` | `integer` | NOT NULL, CHECK `>= 1` |
| `performed_reps` | `integer` | NULL, CHECK `>= 0` |
| `created_at` | `timestamptz` | DEFAULT `now()` |

**Índices:**
- UNIQUE `(routine_exercise_id, set_number)`.

**Regla de inmutabilidad (ver sección 8.A).**
- Con la rutina padre en `status = 'pending'`: **el trainer** puede pre-inicializar
  (INSERT) N filas vacías según `recommended_sets`; también puede actualizarlas y
  borrarlas. La clienta no escribe aquí todavía.
- Con la rutina padre en `status = 'in_progress'`: **la clienta** (y el trainer)
  pueden INSERT / UPDATE / DELETE libremente sus propios sets. Aquí es donde la
  clienta registra `performed_reps`.
- Con la rutina padre en `status = 'completed'` o `'skipped'`: **los sets quedan
  inmutables** — nadie, ni clienta ni trainer, puede modificarlos (ni INSERT, ni
  UPDATE, ni DELETE). La única vía para "ajustar" una rutina ya cerrada es
  documental (notas externas) o duplicar la rutina y rehacer.

---

### 3.9 `routine_surveys`

**Decisión — tabla separada 1:1 vs. columnas en `routines`.**
- **Decisión:** tabla aparte, con PK = FK a `routines.id` (relación 1:1 estricta).
- **Alternativa considerada:** columnas en `routines`.
- **Razón:**
  1. Separación de concerns: la encuesta es un artefacto de la clienta tras terminar;
     las columnas de rutina son asignación + estado.
  2. RLS distinta: en `routines` Ruby escribe; en `routine_surveys` solo la clienta
     escribe.
  3. El set de preguntas va a evolucionar. Concentrarlo en una tabla aparte hace
     migraciones locales.
  4. Evita filas con muchos NULL (la mayoría de rutinas no tendrán encuesta al minuto
     de creadas).

**Decisión — columnas fijas vs. JSONB para respuestas.**
- **Decisión:** híbrido. Columnas fijas para las 2-3 preguntas **estables** (sensación
  general, sensación del peso, notas libres) + `extra_answers jsonb` para preguntas
  experimentales/nuevas que Ruby quiera agregar sin migración.
- **Alternativa considerada:** JSONB puro.
- **Razón:** las preguntas estables deben ser consultables con SQL plano y validables
  con CHECK. Las experimentales no vale la pena migrar cada vez. El JSONB se valida
  desde el backend con un schema versionado.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `routine_id` | `uuid` | PK, FK → `routines(id) ON DELETE CASCADE` | |
| `overall_feeling` | `text` | NULL, CHECK `IN ('great','good','ok','tired','bad')` | Fijo. |
| `weights_feeling` | `text` | NULL, CHECK `IN ('too_light','ok','too_heavy')` | Fijo. |
| `notes` | `text` | NULL | Libre. |
| `extra_answers` | `jsonb` | NULL | Futuras preguntas. |
| `evidence_path` | `text` | NULL | Path al objeto en Supabase Storage (bucket `routine-evidence`). **Opcional** — la clienta no está obligada a subir foto. |
| `submitted_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**Índices:** PK suficiente. `submitted_at` opcional si se quiere listar por fecha.

**Regla de inmutabilidad (ver sección 8.A).** La encuesta se **inserta** por la
clienta en el momento en que la rutina pasa a `status = 'completed'`. Una vez
insertada:
- La clienta **no puede** editarla ni borrarla (es una foto de lo que sintió ese día).
- El trainer **sí puede** editar/borrar (por si hace falta corregir algo por
  pedido de la clienta, o limpiar ruido). Recomendado: que sea excepcional y quede
  en log.

---

## 4. Vistas y funciones analíticas

### 4.1 `v_client_adherence` — cumplimiento por clienta

Vista agregada. El truncado semanal se hace en **zona horaria America/Bogota** para
que "semana" signifique la semana del calendario local de Ruby.

```text
SELECT
  client_id,
  DATE_TRUNC(
    'week',
    (scheduled_date::timestamp) AT TIME ZONE 'America/Bogota'
  )::date AS period_start,
  COUNT(*) FILTER (WHERE status <> 'skipped')         AS assigned,
  COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed')
    / NULLIF(COUNT(*) FILTER (WHERE status <> 'skipped'), 0),
    1
  ) AS adherence_pct
FROM routines
GROUP BY client_id, period_start;
```

Para rangos arbitrarios se prefiere función:

```
FUNCTION fn_client_adherence(p_client_id uuid, p_from date, p_to date)
RETURNS TABLE(assigned int, completed int, adherence_pct numeric)
```

Filtra por `scheduled_date BETWEEN p_from AND p_to`. Los bounds del rango se
interpretan en `America/Bogota` (fecha del calendario local).

### 4.2 `fn_muscles_worked` y `fn_muscles_planned` — músculos por rango

Se separan en **dos funciones** con el mismo shape de salida, porque responden a
preguntas distintas:

- `fn_muscles_worked` → "qué músculos **ejecutó** la clienta en este rango".
- `fn_muscles_planned` → "qué músculos **se planearon** para la clienta en este rango",
  útil para que Ruby vea el balance muscular del plan aunque la clienta incumpla.

**Shape de salida común:**

```
TABLE(
  muscle_id     uuid,
  muscle_code   text,
  muscle_name   text,
  muscle_group  text,
  exercise_count int,   -- # de filas routine_exercises que tocaron el músculo
  session_count  int    -- # de rutinas distintas que tocaron el músculo
)
```

#### 4.2.1 `fn_muscles_worked(p_client_id uuid, p_from date, p_to date)`

Cuenta solo sobre rutinas **ejecutadas** (`status = 'completed'`). Ventana temporal:
**`completed_at` en `[p_from, p_to]` interpretado en `America/Bogota`**.

**Por qué `completed_at` y no `scheduled_date` aquí:** porque responde "qué
trabajaste **de verdad** en este rango". Si una rutina estaba planeada para el
lunes 1 y la clienta la hizo el miércoles 3, corresponde al día en que se ejecutó.
`scheduled_date` podría no coincidir con la realidad y arrastraría sesgo a la
analítica de ejecución.

```text
SELECT m.id, m.code, m.name, m.muscle_group,
       COUNT(*)                    AS exercise_count,
       COUNT(DISTINCT r.id)        AS session_count
FROM routines r
JOIN routine_exercises re ON re.routine_id  = r.id
JOIN exercise_muscles  em ON em.exercise_id = re.exercise_id
JOIN muscles           m  ON m.id           = em.muscle_id
WHERE r.client_id    = p_client_id
  AND r.status       = 'completed'
  AND (r.completed_at AT TIME ZONE 'America/Bogota')::date
        BETWEEN p_from AND p_to
GROUP BY m.id, m.code, m.name, m.muscle_group
ORDER BY session_count DESC, exercise_count DESC;
```

#### 4.2.2 `fn_muscles_planned(p_client_id uuid, p_from date, p_to date)`

Cuenta sobre rutinas **asignadas**, independiente del status. Ventana temporal:
`scheduled_date BETWEEN p_from AND p_to` (la fecha ya es `date`, no hay TZ).

```text
SELECT m.id, m.code, m.name, m.muscle_group,
       COUNT(*)                    AS exercise_count,
       COUNT(DISTINCT r.id)        AS session_count
FROM routines r
JOIN routine_exercises re ON re.routine_id  = r.id
JOIN exercise_muscles  em ON em.exercise_id = re.exercise_id
JOIN muscles           m  ON m.id           = em.muscle_id
WHERE r.client_id      = p_client_id
  AND r.scheduled_date BETWEEN p_from AND p_to
GROUP BY m.id, m.code, m.name, m.muscle_group
ORDER BY session_count DESC, exercise_count DESC;
```

**Comparación planeado vs. ejecutado.** El frontend puede llamar ambas con el mismo
rango y mostrar un diff (p. ej., "planeado 8 sesiones de pierna, ejecutado 5").

Índices que apoyan estas queries: `routines(client_id, scheduled_date)`,
`routines(client_id, status) WHERE status IN ('pending','in_progress')` (no aplica
a estas dos funciones, pero sí a listados), PK en `routine_exercises(routine_id)`,
FK en `exercise_muscles(exercise_id)`. Para `fn_muscles_worked` conviene además un
índice sobre `routines(client_id, completed_at)` filtrado a `status='completed'`;
ver sección 7.

### 4.3 `fn_duplicate_routine` — copiar rutina a otra clienta

```
FUNCTION fn_duplicate_routine(
  p_source_routine_id uuid,
  p_target_client_id  uuid,
  p_target_date       date,
  p_new_name          text DEFAULT NULL
) RETURNS uuid  -- id de la nueva rutina
LANGUAGE plpgsql SECURITY DEFINER
```

**Decisión — RPC vs. tabla `routine_templates` separada.**
- **Decisión:** RPC `fn_duplicate_routine`. Cualquier rutina puede actuar como
  plantilla. La nueva rutina guarda `source_routine_id` para trazabilidad.
- **Alternativa considerada:** tabla `routine_templates` independiente.
- **Razón:** duplica el modelo (templates vs. routines con estructura casi idéntica),
  obliga a Ruby a decidir de antemano si una rutina "es plantilla" o no. La realidad
  es que cualquier rutina buena puede ser plantilla. El RPC resuelve con una función.
  Si en el futuro se quiere una biblioteca explícita de plantillas, se añade un flag
  `is_template boolean` en `routines` sin romper nada.

Lo que la función copia (campos del entrenador):
- `routines`: `name` (o `p_new_name`), `trainer_notes`, `trainer_id` (el caller).
- `routine_exercises`: `exercise_id`, `position`, `recommended_sets`,
  `recommended_reps`, `recommended_weight`, `recommended_weight_unit`, `rest_seconds`,
  `trainer_notes`.

Lo que **NO** copia (datos de clienta):
- `started_at`, `completed_at`, `status` (arranca en `'pending'`).
- `routine_exercises.client_notes`.
- `routine_exercise_sets` — no se crean filas.
- `routine_surveys` — ídem.

Setea `source_routine_id = p_source_routine_id` en la nueva rutina.

Requiere `SECURITY DEFINER` + check interno `is_trainer(auth.uid())`, porque cruza
datos de dos clientas. **Nota importante:** esta función inserta en `routine_exercises`
aun cuando existen triggers de inmutabilidad, pero como la rutina que crea nace en
`status = 'pending'`, el trigger la acepta (es solo una copia fresca, no una edición
sobre una rutina ya iniciada).

---

## 5. RLS — lógica por tabla

### 5.1 Helpers

```sql
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.current_role() = 'trainer';
$$;
```

Uso: todas las policies usan `public.is_trainer()` o comparaciones con `auth.uid()`.

### 5.2 Política por tabla (en prosa; SQL lo escribe el backend)

**`profiles`**
- SELECT: `is_trainer()` OR `id = auth.uid()`.
- UPDATE: trainer puede todo. Cliente puede solo su fila y **solo** las columnas
  permitidas: `phone` y la contraseña (esta última vía Supabase Auth, no vía update
  a `profiles`; el cambio setea `must_change_password = false`). El resto bloqueado
  (no puede editar `full_name`, `birth_date`, `email`, `notes`, `role`, `is_active`
  ni poner `must_change_password = true` por sí misma). Se implementa como policy
  con `WITH CHECK` combinada con trigger `BEFORE UPDATE` que revierte columnas no
  permitidas para cliente (o vía RPC `client_update_own_profile`).
- INSERT: no directo. Se inserta vía trigger `on_auth_user_created` o RPC
  `trainer_create_client` (SECURITY DEFINER) que crea la fila de auth + profile.
- DELETE: denegado a todos. Soft-delete vía `is_active`.

**`plans`**
- SELECT: cualquier autenticado (`auth.role() = 'authenticated'`).
- INSERT/UPDATE/DELETE: solo trainer.

**`payments`**
- SELECT: trainer OR `client_id = auth.uid()`.
- INSERT/UPDATE/DELETE: solo trainer.

**`muscles`**
- SELECT: autenticado.
- INSERT/UPDATE/DELETE: solo trainer.

**`exercises`**
- SELECT: `is_trainer()` OR `EXISTS (SELECT 1 FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE re.exercise_id = exercises.id AND r.client_id = auth.uid())`.
  → la clienta solo ve los ejercicios que forman parte de alguna de sus rutinas.
- INSERT/UPDATE/DELETE: solo trainer.

**`exercise_muscles`**
- SELECT: autenticado.
- INSERT/UPDATE/DELETE: solo trainer.

**`routines`**
- SELECT: trainer OR `client_id = auth.uid()`.
- INSERT: solo trainer.
- UPDATE:
  - Trainer: libre.
  - Cliente: solo su fila y **solo** transiciones válidas de `status` (`pending` →
    `in_progress`, `in_progress` → `completed`) y escritura de `started_at`,
    `completed_at`. El resto bloqueado por trigger `BEFORE UPDATE` que compara
    `OLD.*` y revierte columnas del trainer.
- DELETE: solo trainer.

**`routine_exercises`**
- SELECT: trainer OR clienta dueña de la `routine` (vía EXISTS join).
- INSERT/DELETE: solo trainer, **y solo si la rutina padre está en `status='pending'`**
  (se enforza adicionalmente vía trigger de inmutabilidad, sección 8.A).
- UPDATE:
  - Trainer: permitido **solo si la rutina padre está en `pending`**. El trigger de
    inmutabilidad rechaza cualquier UPDATE sobre columnas del trainer si la rutina
    ya no está en `pending`.
  - Cliente: solo puede escribir `client_notes`. Esta columna sigue siendo editable
    mientras la rutina esté en `pending` o `in_progress`. Al pasar a `completed` o
    `skipped` se congela también. Trigger `BEFORE UPDATE` revierte cualquier intento
    de modificar `recommended_*`, `trainer_notes`, `rest_seconds`, `position`,
    `exercise_id`.

**`routine_exercise_sets`**
- SELECT: trainer OR clienta dueña (vía EXISTS).
- INSERT:
  - Trainer: solo si rutina padre en `pending` (pre-inicialización de N sets vacíos).
  - Clienta dueña: solo si rutina padre en `in_progress`.
- UPDATE / DELETE:
  - Trainer: permitido si rutina padre en `pending` o `in_progress`.
  - Clienta dueña: permitido si rutina padre en `in_progress`.
  - Nadie puede UPDATE/DELETE si la rutina está en `completed` o `skipped` (inmutable).

**`routine_surveys`**
- SELECT: trainer OR clienta dueña de la rutina.
- INSERT: clienta dueña (típicamente al pasar la rutina a `completed`) O trainer.
- UPDATE: solo trainer. Una vez insertada, la clienta no puede editarla.
- DELETE: solo trainer.

> Nota: las restricciones de "qué columnas puede tocar la clienta" se hacen con
> **trigger `BEFORE UPDATE`** que compara `OLD` vs `NEW` según `current_role()`.
> RLS sola no puede restringir a nivel de columna de forma limpia en Postgres sin
> `GRANT` por columna; usar trigger es más mantenible en este caso.

---

## 6. Consideraciones de escalabilidad / extensibilidad

- **Más roles.** El `role` es `text` con CHECK, no ENUM. Agregar `'admin'` o
  `'nutritionist'` es `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT`. Las
  policies usan helpers (`is_trainer()`), no comparaciones hardcodeadas.
- **Más planes.** La tabla `plans` ya es catálogo; agregar plan = INSERT.
- **Múltiples videos por ejercicio.** Hoy `media_url` única. Extensión: tabla
  `exercise_media` sin tocar `exercises`.
- **Reuniones / calendario (próxima fase).** Se agregará tabla `meetings(id,
  trainer_id, client_id, scheduled_at, meeting_url, status)`. La vista calendario
  del cliente será un `UNION` de rutinas (`scheduled_date`) y reuniones
  (`scheduled_at`), sin tocar lo existente.
- **Histórico de precio por plan.** Si Ruby sube precios, `plans.price` cambia
  pero `payments.amount` ya está congelado por pago. No hay pérdida histórica.
- **Internacionalización.** `muscles` tiene `name` hoy; se agrega `name_en` etc.
  cuando toque. Los `code` son siempre en inglés y estables.
- **Particionado.** No necesario en fase 1. Si `routine_exercise_sets` crece
  mucho, se particiona por año de `created_at`.
- **Auditoría.** Si hace falta, se agrega tabla `audit_log` sin cambiar nada actual.
- **Bitácora de peso real por serie.** Si en el futuro Ruby necesita registro
  histórico de peso levantado por serie (hoy esto se resuelve con texto libre en
  `routine_exercises.client_notes`), se añaden columnas `performed_weight` y
  `performed_weight_unit` a `routine_exercise_sets` sin migrar datos.

---

## 7. Índices — resumen

| Tabla | Índices (más allá de PK) |
|---|---|
| `profiles` | `(role) WHERE is_active`, UNIQUE `(email)` |
| `plans` | UNIQUE `(code)` |
| `payments` | `(client_id, paid_on DESC)`, `(due_date)` |
| `exercises` | `(name text_pattern_ops) WHERE is_active` |
| `exercise_muscles` | `(muscle_id)` |
| `routines` | `(client_id, scheduled_date DESC)`, `(scheduled_date)`, parcial `(client_id, status) WHERE status IN ('pending','in_progress')`, parcial `(client_id, completed_at) WHERE status = 'completed'` (apoya `fn_muscles_worked`) |
| `routine_exercises` | UNIQUE `(routine_id, position)`, `(exercise_id)` |
| `routine_exercise_sets` | UNIQUE `(routine_exercise_id, set_number)` |

Paginación: `keyset` sobre `(scheduled_date DESC, id DESC)` para listados largos de
rutinas. Offset solo para pantallas administrativas pequeñas.

---

## 8. Triggers requeridos

### 8.A Triggers de inmutabilidad (congelado de rutinas ejecutadas)

Estos triggers son el corazón de la regla "la estructura ejecutada no se modifica".
Implementan, a nivel de base de datos, lo siguiente:

1. **`fn_routine_exercises_immutable`** — `BEFORE INSERT OR UPDATE OR DELETE` en
   `routine_exercises`.
   - Si la rutina padre (`NEW.routine_id` o `OLD.routine_id`) tiene `status <> 'pending'`,
     el trigger rechaza la operación con `RAISE EXCEPTION 'routine is not editable'`.
   - **Excepción para UPDATE de la clienta sobre `client_notes`:** se permite siempre
     que la rutina esté en `pending` o `in_progress` (no en `completed`/`skipped`).
     Se detecta comparando columnas: si la única columna que cambió es `client_notes`
     y `current_role() = 'client'` y la rutina está en `pending` o `in_progress`,
     se permite.
   - La función `fn_duplicate_routine` (SECURITY DEFINER) inserta en
     `routine_exercises` ligadas a una rutina **recién creada en `pending`**, por lo
     que el trigger no la bloquea.

2. **`fn_routine_exercise_sets_immutable`** — `BEFORE INSERT OR UPDATE OR DELETE` en
   `routine_exercise_sets`.
   - Resuelve el status de la rutina padre haciendo el join
     `routine_exercise_sets → routine_exercises → routines`.
   - Si la rutina padre está en `pending`: permite operaciones solo al trainer
     (inicialización de sets vacíos).
   - Si la rutina padre está en `in_progress`: permite al trainer y a la clienta
     dueña.
   - Si la rutina padre está en `completed` o `skipped`: rechaza toda operación
     (`RAISE EXCEPTION 'routine is closed; sets are immutable'`).

3. **`fn_routine_surveys_immutable`** — `BEFORE UPDATE OR DELETE` en `routine_surveys`.
   - Si `current_role() = 'client'`: rechaza UPDATE y DELETE siempre (la clienta
     solo puede INSERT una vez).
   - Trainer: permitido (UPDATE y DELETE). Se asume uso excepcional.

### 8.B Otros triggers

4. `set_updated_at` BEFORE UPDATE en `profiles`, `plans`, `exercises`, `routines`,
   `routine_exercises` — setea `updated_at = now()`.
5. `on_profile_deactivate` BEFORE UPDATE en `profiles` — si `is_active` pasa a
   `false`, setea `deactivated_at = now()`; si vuelve a `true`, lo deja en NULL.
6. `enforce_client_update_routines` BEFORE UPDATE en `routines` — si el caller es
   cliente, bloquea columnas que no sean `status`, `started_at`, `completed_at`.
7. `enforce_client_update_routine_exercises` BEFORE UPDATE en `routine_exercises` —
   si cliente, solo permite `client_notes`. Se combina con el trigger de
   inmutabilidad 8.A.1.
8. `enforce_routine_status_transitions` BEFORE UPDATE en `routines` — valida
   transiciones: `pending → in_progress → completed`, `pending → skipped`, etc.
9. `calc_payment_due_date` BEFORE INSERT en `payments` — si `due_date` viene NULL,
   lo calcula como `paid_on + (SELECT duration_days FROM plans WHERE id = plan_id)`.
   Si `due_date` viene con valor, se respeta tal cual (caso "le regalé una semana").

---

## 9. Storage (Supabase Storage)

- Bucket **`routine-evidence`** (privado).
- Path sugerido: `routine-evidence/{client_id}/{routine_id}/{filename}`.
- Policies del bucket:
  - SELECT/INSERT: trainer O usuario cuyo `auth.uid()` aparece como primera carpeta
    del path.
  - DELETE: solo trainer.
- `routine_surveys.evidence_path` guarda la ruta relativa (sin dominio).

---

## 10. Resumen de enums/CHECK definidos

| Campo | Valores |
|---|---|
| `profiles.role` | `trainer`, `client` |
| `payments.payment_method` | `cash`, `transfer`, `card`, `yape`, `plin`, `other` |
| `exercises.media_platform` | `youtube`, `tiktok`, `instagram`, `facebook`, `drive`, `other` |
| `exercises.default_weight_unit`, `routine_exercises.recommended_weight_unit` | `kg`, `lb` |
| `routines.status` | `pending`, `in_progress`, `completed`, `skipped` |
| `routine_surveys.overall_feeling` | `great`, `good`, `ok`, `tired`, `bad` |
| `routine_surveys.weights_feeling` | `too_light`, `ok`, `too_heavy` |
| `muscles.muscle_group` | `upper_body`, `lower_body`, `core`, `cardio` |

Todos como `text + CHECK`, no `CREATE TYPE ... ENUM`. Agregar un valor es una línea.

**Nota sobre el enum `weight_unit`.** Tras eliminar `performed_weight` de
`routine_exercise_sets`, el enum `weight_unit` (`kg|lb`) sigue usándose en
`exercises.default_weight_unit` y `routine_exercises.recommended_weight_unit`, por
lo que **no** se elimina del esquema. El CHECK se mantiene en esas dos tablas.

---

## 11. Zona horaria

Todas las funciones y vistas analíticas (`v_client_adherence`, `fn_client_adherence`,
`fn_muscles_worked`) que conviertan timestamps a "días" o "semanas" del calendario
lo hacen en **`America/Bogota`**, que es la zona horaria de Ruby. Las fechas ya
tipadas como `date` (p. ej. `routines.scheduled_date`) no requieren conversión. Los
timestamps (`routines.completed_at`, `routines.started_at`, `payments.created_at`,
etc.) son `timestamptz` y se convierten con `AT TIME ZONE 'America/Bogota'` cuando
se necesite extraer fecha local.
