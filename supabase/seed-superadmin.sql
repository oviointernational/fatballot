-- ============================================================================
-- FatBallot - Superadmin seed (run manually, once)
-- ============================================================================
-- Creates (or replaces) the Superadmin account (RA-1001) directly in the
-- database, including its password hash.
--
-- IMPORTANT: the app reads voters from the app_store JSON blob
-- (row key = 'store'), NOT from the relational public.voters table, so this
-- script writes there. Nothing else in the store is touched.
--
-- HOW TO USE:
--   1. Generate a password hash on YOUR machine (password never leaves it):
--
--        $env:SA_PASSWORD="choose-a-strong-password"
--        node -e 'const c=require("crypto"); const s=c.randomBytes(16).toString("hex"); console.log(["scrypt","16384","8","1",s,c.scryptSync(process.env.SA_PASSWORD,s,64).toString("hex")].join("$"))'
--
--      Copy the printed line (starts with scrypt$16384$8$1$...).
--   2. Fill in the four values below.
--   3. Run this whole script in Supabase Dashboard -> SQL Editor.
--   4. Sign in on the site with RA Number 1001 + your password, then change
--      the password anytime in Profile -> Account Security.
-- ============================================================================

DO $$
DECLARE
  sa_email TEXT := 'YOU@EXAMPLE.COM';          -- <-- your real email
  sa_first TEXT := 'Firstname';                -- <-- your first name
  sa_last  TEXT := 'Lastname';                 -- <-- your last name
  sa_hash  TEXT := 'PASTE_SCRYPT_HASH_HERE';   -- <-- hash from step 1
  blob   JSONB;
  others JSONB;
BEGIN
  IF sa_email = 'YOU@EXAMPLE.COM' OR sa_hash = 'PASTE_SCRYPT_HASH_HERE' THEN
    RAISE EXCEPTION 'Fill in sa_email, sa_first, sa_last and sa_hash at the top of this script first.';
  END IF;

  IF sa_hash NOT LIKE 'scrypt$16384$8$1$%' THEN
    RAISE EXCEPTION 'sa_hash is not a valid scrypt hash (expected format scrypt$16384$8$1$<salt>$<hash>). Generate it with the node command above.';
  END IF;

  SELECT data INTO blob FROM public.app_store WHERE key = 'store';
  IF blob IS NULL THEN
    blob := '{}'::jsonb;
  END IF;

  -- Keep every existing voter EXCEPT any previous superadmin / RA-1001.
  SELECT COALESCE(jsonb_agg(v), '[]'::jsonb) INTO others
    FROM jsonb_array_elements(COALESCE(blob->'voters', '[]'::jsonb)) AS v
    WHERE NOT (
      lower(COALESCE(v->>'role', '')) = 'superadmin'
      OR regexp_replace(upper(COALESCE(v->>'raNumber', '')), '[^0-9]', '', 'g') = '1001'
    );

  -- Prepend the fresh Superadmin record (with password hash).
  blob := jsonb_set(
    blob,
    '{voters}',
    jsonb_build_array(jsonb_build_object(
      'id', 'vot-superadmin',
      'raNumber', '1001',
      'email', lower(sa_email),
      'firstName', sa_first,
      'middleName', 'Chief',
      'lastName', sa_last,
      'role', 'superadmin',
      'isAccredited', true,
      'department', 'Electoral Commission Directorate',
      'phone', '',
      'registeredAt', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'passwordHash', sa_hash
    )) || others
  );

  INSERT INTO public.app_store(key, data, updated_at)
  VALUES ('store', blob, now())
  ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

  RAISE NOTICE 'Superadmin RA-1001 (%) ready. Sign in with RA number 1001 + your password.', lower(sa_email);
END $$;
