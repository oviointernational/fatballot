-- ============================================================================
-- FatBallot — COMPLETE database schema (single file)
-- ============================================================================
-- Run ONCE on a FRESH Supabase project:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--
-- What this creates:
--   * All tables the app reads and writes (voters, offices, candidates,
--     votes, sessions, screening, agents, observers, timeline, ycec,
--     settings, audit log).
--   * Structural seed data: site settings, 6 offices, 6 timeline milestones,
--     5 YCEC members, 3 screening benchmarks, and the placeholder Superadmin
--     (RA-1001, NO password) so first-run setup can claim it.
--   * The ballot box starts EMPTY: no candidates, no votes, no agents,
--     no observers, no demo voters.
--
-- Access model (deliberate, read before changing):
--   * The FatBallot server talks to this database with the SERVICE_ROLE key
--     only. The browser NEVER touches Supabase directly and holds no keys.
--   * Row Level Security is therefore left DISABLED on these tables; the
--     service role bypasses RLS anyway. Do NOT expose the service key.
--   * No FOREIGN KEYS: the application enforces relations (e.g. deleting an
--     office must never cascade-delete votes). Adding RESTRICT constraints
--     would break admin workflows.
--
-- Sign-in model: RA number + password. Passwords are scrypt hashes stored in
-- voters.password_hash (format scrypt$N$r$p$salt$hex). To set the Superadmin
-- password directly from SQL after editing names/email below, generate a hash
-- locally and run:
--   UPDATE public.voters SET email = 'you@example.com',
--     first_name = 'First', last_name = 'Last',
--     password_hash = '<scrypt hash>'
--   WHERE ra_number = '1001';
-- Generate the hash with:
--   $env:SA_PASSWORD="choose-a-strong-password"
--   node -e 'const c=require("crypto"); const s=c.randomBytes(16).toString("hex"); console.log(["scrypt","16384","8","1",s,c.scryptSync(process.env.SA_PASSWORD,s,64).toString("hex")].join("$"))'
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. SETTINGS (single row, id = 1; permissions matrix lives inside data)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL
);

INSERT INTO public.settings (id, data) VALUES (1, '{
  "siteName": "FatBallot",
  "aboutTitle": "Official 2026 Youth & Community Executive Elections",
  "aboutContent": "Welcome to the official digital voting platform for the 2026 General Elections. FatBallot is engineered to guarantee sovereign transparency, immutable election integrity, and seamless accessibility for all accredited voters. Every vote cast, accreditation processed, and ballot modification is cryptographically signed and permanently logged in our zero-tampering audit ledger. Please ensure your accreditation is active before proceeding to the ballot chamber.",
  "aboutImageUrl": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
  "contestantsCanViewVoters": true,
  "publicAuditLog": false,
  "permissions": {
    "canRegisterUsers": ["superadmin", "committee"],
    "canAccreditUsers": ["superadmin", "committee"],
    "canCreateOffices": ["superadmin", "committee"],
    "canAssignOffices": ["superadmin", "committee"],
    "canCreateScreeningCriteria": ["superadmin", "committee"],
    "canAssignAgents": ["superadmin", "committee"],
    "canCreateObservers": ["superadmin"]
  }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Election window is seeded relative to setup time (open now, 72h voting).
UPDATE public.settings
SET data = jsonb_set(data, '{electionStartTime}', to_jsonb((now() - interval '1 hour')),
              true)
WHERE id = 1 AND NOT (data ? 'electionStartTime');

UPDATE public.settings
SET data = jsonb_set(data, '{electionEndTime}', to_jsonb((now() + interval '72 hours')),
              true)
WHERE id = 1 AND NOT (data ? 'electionEndTime');

-- --------------------------------------------------------------------------
-- 2. OFFICES (contested positions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offices (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'Crown'
);

INSERT INTO public.offices (id, title, "order", description, icon) VALUES
  ('off-pres', 'Executive President', 1, 'Chief Executive Officer presiding over executive meetings and steering council mandates.', 'Crown'),
  ('off-vp', 'Vice President', 2, 'Principal assistant to the President, supervising committees and policy execution.', 'Shield'),
  ('off-sec', 'General Secretary', 3, 'Custodian of council secretariat, minutes, correspondence, and institutional records.', 'FileText'),
  ('off-tres', 'Treasurer & Financial Secretary', 4, 'Manager of budgetary allocations, audits, funds custody, and financial disclosures.', 'Coins'),
  ('off-soc', 'Director of Socials & Welfare', 5, 'Overseeing student wellbeing, community engagements, cultural forums, and welfare.', 'Sparkles'),
  ('off-pro', 'Public Relations Officer (PRO)', 6, 'Primary spokesperson managing institutional communications and public bulletins.', 'Megaphone')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 3. CANDIDATES / CONTESTANTS (starts empty; created by office assignment)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidates (
  id              TEXT PRIMARY KEY,
  office_id       TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL,
  ra_number       TEXT NOT NULL UNIQUE,
  avatar          TEXT NOT NULL DEFAULT '',
  tagline         TEXT NOT NULL DEFAULT '',
  vision          TEXT NOT NULL DEFAULT '',
  antecedent      JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_offices JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_email   TEXT NOT NULL DEFAULT ''
);

-- --------------------------------------------------------------------------
-- 4. VOTERS (electoral roll; password_hash added for RA + password sign-in)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voters (
  id                TEXT PRIMARY KEY,
  ra_number         TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL,
  middle_name       TEXT NOT NULL DEFAULT '',
  last_name         TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'voter'
                    CHECK (role IN ('voter', 'contestant', 'committee', 'superadmin')),
  is_accredited     BOOLEAN NOT NULL DEFAULT false,
  is_screened       BOOLEAN NOT NULL DEFAULT false,
  assigned_office_id TEXT,
  is_agent          BOOLEAN NOT NULL DEFAULT false,
  agent_office_id   TEXT,
  agent_candidate_id TEXT,
  department        TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  avatar            TEXT NOT NULL DEFAULT '',
  registered_at     TEXT NOT NULL,
  password_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_voters_email ON public.voters (email);
CREATE INDEX IF NOT EXISTS idx_voters_role ON public.voters (role);

-- Placeholder Superadmin (RA-1001, NO password): claimed via first-run setup
-- or by updating email/names/password_hash directly (see header).
INSERT INTO public.voters
  (id, ra_number, email, first_name, middle_name, last_name, role,
   is_accredited, department, phone, registered_at, password_hash)
VALUES
  ('vot-superadmin', '1001', 'superadmin@fatballot.org', 'Electoral', 'Chief',
   'SuperAdmin', 'superadmin', true, 'Electoral Commission Directorate',
   '+234 801 000 1001', '2026-08-01T08:00:00.000Z', NULL)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 5. VOTES (ballot box; starts empty; one row per voter per office)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.votes (
  id              TEXT PRIMARY KEY,
  voter_ra_number TEXT NOT NULL,
  office_id       TEXT NOT NULL,
  choice          TEXT NOT NULL CHECK (choice IN ('candidate', 'for', 'against')),
  candidate_id    TEXT,
  timestamp       TEXT NOT NULL,
  ip_address      TEXT,
  UNIQUE (voter_ra_number, office_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_office ON public.votes (office_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON public.votes (candidate_id);

-- --------------------------------------------------------------------------
-- 6. TIMELINE (election milestones; editable from Admin)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timeline (
  id          TEXT PRIMARY KEY,
  "order"     INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('completed', 'active', 'upcoming')),
  icon        TEXT NOT NULL DEFAULT 'Clock'
);

INSERT INTO public.timeline (id, "order", title, description, date, status, icon) VALUES
  ('time-1', 1, 'Voter Registration & Database Publication', 'Publishing of eligible electorate voter lists, RA assignments, and institutional directory cross-matching.', 'Aug 01 - Aug 20, 2026', 'completed', 'UserCheck'),
  ('time-2', 2, 'Nomination & Candidate Screening', 'Submission of candidacy nomination forms, vetting of constitutional eligibility, and publication of contestant profiles.', 'Aug 21 - Aug 28, 2026', 'completed', 'FileCheck'),
  ('time-3', 3, 'Presidential & Executive Manifesto Debate', 'Broadcasted public debate sessions and manifesto presentations streamed live across constituent forums.', 'Sep 01 - Sep 05, 2026', 'completed', 'Radio'),
  ('time-4', 4, 'Voter Accreditation & Security Verification', 'Issuance of secure biometric/digital RA authentication tokens and single-device credential validation.', 'Sep 06 - Sep 11, 2026', 'active', 'BadgeCheck'),
  ('time-5', 5, 'FatBallot Live Election & E-Ballot Portal', 'Electronic ballot portal opens for accredited voters. Real-time encrypted vote casting with instant change capability.', 'Sep 12 - Sep 15, 2026', 'active', 'Vote'),
  ('time-6', 6, 'Official Collation, Audit & Declaration of Results', 'Cryptographic validation of SHA-256 audit ledger, official return certifications, and swearing-in ceremony.', 'Sep 16, 2026', 'upcoming', 'Award')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 7. YCEC MEMBERS (electoral commission directory)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ycec_members (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  role   TEXT NOT NULL,
  email  TEXT NOT NULL,
  phone  TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  tenure TEXT NOT NULL DEFAULT ''
);

INSERT INTO public.ycec_members (id, name, role, email, phone, avatar, tenure) VALUES
  ('ycec-1', 'Engr. Nnamdi Paul Azikiwe', 'Chief Electoral Commissioner & Chairman', 'chairman.ycec@fatballot.org', '+234 803 111 2221', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-2', 'Prof. Aisha Mohammed Danjuma', 'Secretary to the Electoral Commission', 'secretary.ycec@fatballot.org', '+234 803 111 2222', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-3', 'Barr. Femi Kayode Alabi', 'Chief Legal & Constitutional Advisory Counsel', 'legal.ycec@fatballot.org', '+234 803 111 2223', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-4', 'Dr. Maryam Chinedu Sanni', 'Head of Digital Cryptography & Audit Ledger', 'security.ycec@fatballot.org', '+234 803 111 2224', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-5', 'Mr. Victor Damilola Adeleke', 'Director of Logistics, Accreditation & Collation', 'logistics.ycec@fatballot.org', '+234 803 111 2225', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80', '2025 - 2027')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 8. SCREENING CRITERIA + CANDIDATE SCREENINGS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screening_criteria (
  id        TEXT PRIMARY KEY,
  office_id TEXT NOT NULL UNIQUE,
  title     TEXT NOT NULL,
  criteria  JSONB NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO public.screening_criteria (id, office_id, title, criteria) VALUES
  ('crit-pres', 'off-pres', 'Executive Presidential Clearance Benchmark', '["Valid constituent matriculation and good financial standing", "Cumulative GPA above minimum threshold (3.0+)", "Zero disciplinary indictment or examination malpractice records", "Public asset and constitutional pledge disclosure", "Certified leadership track record and public debate participation", "Endorsement signatures from at least 25 accredited electorate members"]'::jsonb),
  ('crit-vp', 'off-vp', 'Vice Presidential Vetting Standards', '["Good academic and administrative standing", "Demonstrated committee coordination experience", "Pledge of executive alignment and non-partisanship", "Endorsement signatures from at least 15 registered constituents"]'::jsonb),
  ('crit-sec', 'off-sec', 'General Secretariat Procedural Competence', '["Documentation, archival, and typing proficiency", "No unresolved disciplinary disputes", "Endorsement by at least 10 registered voters"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.candidate_screenings (
  candidate_id TEXT PRIMARY KEY,
  office_id    TEXT NOT NULL,
  results      JSONB NOT NULL DEFAULT '[]'::jsonb,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_count  INTEGER NOT NULL DEFAULT 0,
  percentage   INTEGER NOT NULL DEFAULT 0,
  is_screened  BOOLEAN NOT NULL DEFAULT false,
  screened_at  TEXT NOT NULL DEFAULT ''
);

-- --------------------------------------------------------------------------
-- 9. AGENTS + OBSERVERS (start empty; commissioned from Admin)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agents (
  id              TEXT PRIMARY KEY,
  voter_id        TEXT NOT NULL UNIQUE,
  voter_ra_number TEXT NOT NULL,
  voter_name      TEXT NOT NULL,
  office_id       TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  candidate_name  TEXT NOT NULL,
  assigned_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.observers (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  rank                  TEXT NOT NULL,
  office                TEXT NOT NULL DEFAULT '',
  phone                 TEXT NOT NULL,
  token                 TEXT NOT NULL UNIQUE,
  created_at            TEXT NOT NULL,
  last_active_device_id TEXT
);

-- --------------------------------------------------------------------------
-- 10. SESSIONS (exclusive 7-day single-device sessions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  token       TEXT PRIMARY KEY,
  ra_number   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  device_info TEXT,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_ra ON public.sessions (ra_number);

-- --------------------------------------------------------------------------
-- 11. AUDIT LOG (append-only, SHA-256 hash-chained by the server)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idx           INTEGER NOT NULL UNIQUE,
  timestamp     TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  actor         JSONB NOT NULL DEFAULT '{}'::jsonb,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash TEXT NOT NULL,
  hash          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event ON public.audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_ra ON public.audit_log ((actor->>'raNumber'));

-- ============================================================================
-- DONE. Verify with: SELECT count(*) FROM public.voters;  -- expect 1
-- ============================================================================
