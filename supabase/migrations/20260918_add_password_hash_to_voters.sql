-- ============================================================================
-- FatBallot migration: voter password hash column
-- ============================================================================
-- Password login (RA number + password) stores scrypt hashes. The running
-- application reads and writes voters inside the app_store JSON blob
-- (row key = 'store', field "passwordHash" per voter), which needs no schema
-- change. This migration keeps the relational public.voters table in sync
-- for anyone inspecting or reporting from SQL directly.
--
-- Hash format: scrypt$16384$8$1$<16-byte hex salt>$<64-byte hex derived key>
-- Generate one locally with:
--   $env:SA_PASSWORD="choose-a-strong-password"
--   node -e 'const c=require("crypto"); const s=c.randomBytes(16).toString("hex"); console.log(["scrypt","16384","8","1",s,c.scryptSync(process.env.SA_PASSWORD,s,64).toString("hex")].join("$"))'
-- ============================================================================

ALTER TABLE public.voters
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN public.voters.password_hash IS
  'scrypt password hash (scrypt$N$r$p$salt$hex) for RA-number + password sign-in. The app itself reads voters from the app_store blob (passwordHash field); this column mirrors it for SQL-level access.';
