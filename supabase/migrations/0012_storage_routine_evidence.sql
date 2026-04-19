-- ============================================================
-- 0012_storage_routine_evidence.sql
-- Supabase Storage: private bucket for routine evidence photos.
-- Path convention: routine-evidence/{client_id}/{routine_id}/{filename}
-- ============================================================

-- Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'routine-evidence',
  'routine-evidence',
  false,  -- private bucket
  52428800,  -- 50 MiB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Storage RLS policies
-- Supabase Storage uses policies on storage.objects.
-- The bucket filter uses: bucket_id = 'routine-evidence'
-- The path convention is: {client_id}/{routine_id}/{filename}
-- (storage.foldername(name))[1] returns the first folder = client_id
-- ------------------------------------------------------------

-- SELECT: trainer sees all; client sees only their own folder
drop policy if exists "routine_evidence_select" on storage.objects;
create policy "routine_evidence_select"
  on storage.objects
  for select
  using (
    bucket_id = 'routine-evidence'
    and (
      public.is_trainer()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- INSERT: trainer can upload for any client; client can upload to their own folder only
drop policy if exists "routine_evidence_insert" on storage.objects;
create policy "routine_evidence_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'routine-evidence'
    and (
      public.is_trainer()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- UPDATE: same rules as INSERT
drop policy if exists "routine_evidence_update" on storage.objects;
create policy "routine_evidence_update"
  on storage.objects
  for update
  using (
    bucket_id = 'routine-evidence'
    and (
      public.is_trainer()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- DELETE: only trainer can delete evidence files
drop policy if exists "routine_evidence_delete" on storage.objects;
create policy "routine_evidence_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'routine-evidence'
    and public.is_trainer()
  );

-- ============================================================
-- DOWN
-- drop policy if exists "routine_evidence_delete" on storage.objects;
-- drop policy if exists "routine_evidence_update" on storage.objects;
-- drop policy if exists "routine_evidence_insert" on storage.objects;
-- drop policy if exists "routine_evidence_select" on storage.objects;
-- delete from storage.buckets where id = 'routine-evidence';
-- ============================================================
