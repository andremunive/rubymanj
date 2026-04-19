-- ============================================================
-- 0001_extensions.sql
-- Enable PostgreSQL extensions required by Rubymanj.
-- ============================================================

create extension if not exists pgcrypto;        -- gen_random_uuid()
create extension if not exists "uuid-ossp";     -- uuid_generate_v4() (belt & suspenders)

-- ============================================================
-- DOWN (manual rollback — do not run in production without care)
-- drop extension if exists "uuid-ossp";
-- drop extension if exists pgcrypto;
-- ============================================================
