# Rubymanj — Migrations (Phase 1)

## Application order

Apply strictly in numerical order. Each file is self-contained (table + indexes + triggers + RLS in one file).

| File | What it creates |
|---|---|
| `0001_extensions.sql` | pgcrypto, uuid-ossp |
| `0002_profiles.sql` | `profiles` table, helper functions (`current_user_role`, `is_trainer`), RLS, `trainer_create_client` RPC |
| `0003_plans.sql` | `plans` table, RLS, seed row (trimestral) |
| `0004_payments.sql` | `payments` table, `calc_payment_due_date` trigger, RLS |
| `0005_muscles.sql` | `muscles` table, RLS, seed (~28 muscles) |
| `0006_exercises.sql` | `exercises` table, RLS |
| `0007_exercise_muscles.sql` | `exercise_muscles` pivot, RLS |
| `0008_routines.sql` | `routines` table, status-transition trigger, client-column-guard trigger, RLS |
| `0009_routine_exercises.sql` | `routine_exercises` table, immutability trigger (§8.A.1), column-guard trigger, RLS |
| `0010_routine_exercise_sets.sql` | `routine_exercise_sets` table, immutability trigger (§8.A.2), RLS |
| `0011_routine_surveys.sql` | `routine_surveys` table, immutability trigger (§8.A.3), RLS |
| `0012_storage_routine_evidence.sql` | `routine-evidence` Storage bucket + policies |
| `0013_views_and_functions.sql` | `v_client_adherence`, `fn_client_adherence`, `fn_muscles_worked`, `fn_muscles_planned`, `fn_duplicate_routine` |

## How to run

### Option A — Supabase CLI (recommended)

```bash
# Link to your remote project first (one-time)
supabase link --project-ref <YOUR_PROJECT_REF>

# Apply all pending migrations
supabase db push
```

### Option B — psql directly

```bash
for f in supabase/migrations/00*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

### Option C — Supabase Studio SQL editor

Paste and run each file in order via the SQL editor in the Supabase dashboard.

## Post-migration QA checklist

Run these checks manually after applying all 13 files.

### Auth and profiles

- [ ] Set Ruby's profile to `role = 'trainer'` manually (the auth trigger creates all users as `client` by default unless `raw_user_meta_data.role` is set at signup).
- [ ] Call `trainer_create_client(email, password, full_name)` as the trainer. Verify the returned UUID, and that `profiles.must_change_password = true` for the new client.
- [ ] Log in as the new client. Attempt `SELECT * FROM profiles` — must return only the client's own row (not Ruby's profile).
- [ ] As the client, attempt `UPDATE profiles SET role = 'trainer'` on own row — trigger must revert it; role stays `client`.
- [ ] Attempt `DELETE FROM profiles` as anyone — must be blocked by RLS policy.
- [ ] Attempt `DELETE FROM auth.users` for a user who has a profile row — must fail with FK RESTRICT error.
- [ ] Deactivate a client: `UPDATE profiles SET is_active = false WHERE id = <uuid>`. Verify `deactivated_at` is set by trigger. Re-activate: verify `deactivated_at` becomes NULL.

### Plans and payments

- [ ] Verify the seed row: `SELECT * FROM plans WHERE code = 'trimestral'` returns 1 row.
- [ ] As trainer, insert a payment with `due_date = NULL`. Verify `due_date` was calculated as `paid_on + 90` (for the trimestral plan).
- [ ] Insert a payment with an explicit `due_date`. Verify the explicit value is preserved (not recalculated).
- [ ] As client, attempt `INSERT INTO payments ...` — must be blocked.
- [ ] As client, verify `SELECT FROM payments` returns only own rows.

### Exercises and muscles

- [ ] Verify muscles seed: `SELECT count(*) FROM muscles` should return 28.
- [ ] Create an exercise as trainer and tag it with muscles via `exercise_muscles`.
- [ ] As a client with NO assigned routines, attempt `SELECT * FROM exercises` — must return 0 rows.
- [ ] As a client WITH an assigned routine that includes that exercise, attempt `SELECT * FROM exercises` — must return the exercise(s) in their routine only.

### Routines — status lifecycle

- [ ] Create a routine (trainer). Verify `status = 'pending'`.
- [ ] As client, attempt invalid transition `pending -> completed` — must fail.
- [ ] As client, transition `pending -> in_progress` — must succeed.
- [ ] As client, transition `in_progress -> completed` — must succeed.
- [ ] As client, attempt `in_progress -> pending` (backwards) — must fail.

### Routine exercises — immutability (§8.A.1)

- [ ] As trainer, insert a `routine_exercises` row on a `pending` routine — must succeed.
- [ ] Transition the routine to `in_progress`. As trainer, attempt INSERT on `routine_exercises` — must fail with `routine_not_editable`.
- [ ] As client in `in_progress`, attempt UPDATE on `routine_exercises.recommended_sets` — trigger must revert it (column guard).
- [ ] As client in `in_progress`, UPDATE `routine_exercises.client_notes` — must succeed.
- [ ] Transition routine to `completed`. As anyone, attempt any DML on `routine_exercises` — must fail with `routine_closed`.

### Routine exercise sets — immutability (§8.A.2)

- [ ] As trainer on a `pending` routine, INSERT a set row (`performed_reps = NULL`) — must succeed.
- [ ] As client on a `pending` routine, attempt INSERT a set — must fail with `routine_not_started`.
- [ ] Transition routine to `in_progress`. As client, INSERT / UPDATE / DELETE set rows — must succeed.
- [ ] As client on `in_progress`, INSERT a set for a **different client's** routine — must fail by RLS.
- [ ] Transition routine to `completed`. As trainer, attempt UPDATE on a set — must fail with `routine_closed`.
- [ ] Transition routine to `completed`. As client, attempt UPDATE on a set — must fail with `routine_closed`.

### Routine surveys — immutability (§8.A.3)

- [ ] As client, INSERT a survey for own completed routine — must succeed.
- [ ] As client, attempt UPDATE on own survey — must fail with `survey_immutable`.
- [ ] As client, attempt DELETE on own survey — must fail with `survey_immutable`.
- [ ] As trainer, UPDATE a survey — must succeed (exceptional correction).

### Analytical functions

- [ ] `fn_duplicate_routine` called by client — must fail with `not_authorized`.
- [ ] `fn_duplicate_routine` called by trainer on a `completed` routine — must create a new `pending` routine with same exercises; `client_notes` empty; no sets; no survey. `source_routine_id` points to original.
- [ ] `fn_muscles_worked` with a date range that has no completed routines — must return 0 rows, no error.
- [ ] `fn_muscles_worked` and `fn_muscles_planned` for the same range — verify both return same columns (same shape). Values may differ.
- [ ] `v_client_adherence`: create 2 routines in the same ISO week in Bogota local time but on dates that straddle UTC midnight. Verify they group into the same `period_start`.

### Storage

- [ ] As client, upload an object to `routine-evidence/{own_uuid}/...` — must succeed.
- [ ] As client, attempt to upload to `routine-evidence/{other_client_uuid}/...` — must fail.
- [ ] As trainer, upload to any path under `routine-evidence/` — must succeed.
- [ ] As client, attempt DELETE on own uploaded file — must fail (only trainer can delete).
