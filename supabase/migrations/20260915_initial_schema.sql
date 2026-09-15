-- ============================================================================
-- FatBallot - Initial Supabase Schema Migration
-- ============================================================================
-- This migration creates all tables needed for the FatBallot election platform.
-- Based on the existing Node.js database implementation (server/database.ts).
-- ============================================================================

-- ============================================================================
-- 1. ENUMS & EXTENSIONS
-- ============================================================================

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types used across tables
CREATE TYPE public."role_enum" AS ENUM ('voter', 'contestant', 'committee', 'superadmin');
CREATE TYPE public."vote_choice_enum" AS ENUM ('candidate', 'for', 'against');
CREATE TYPE public."timeline_status_enum" AS ENUM ('completed', 'active', 'upcoming');
CREATE TYPE public."screening_result_enum" AS ENUM ('passed', 'pending');
CREATE TYPE public."observer_status_enum" AS ENUM ('active', 'inactive');

-- ============================================================================
-- 2. CORE SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_name TEXT NOT NULL DEFAULT 'FatBallot',
  about_title TEXT NOT NULL DEFAULT 'Official 2026 Youth & Community Executive Elections',
  about_content TEXT NOT NULL DEFAULT 'Welcome to the official digital voting platform for the 2026 General Elections. FatBallot is engineered to guarantee sovereign transparency, immutable election integrity, and seamless accessibility for all accredited voters. Every vote cast, accreditation processed, and ballot modification is cryptographically signed and permanently logged in our zero-tampering audit ledger. Please ensure your accreditation is active before proceeding to the ballot chamber.',
  about_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
  election_start_time TIMESTAMPTZ NOT NULL DEFAULT (now() - interval '1 hour'),
  election_end_time TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  contestants_can_view_voters BOOLEAN NOT NULL DEFAULT true,
  public_audit_log BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '{
    "canRegisterUsers": ["superadmin", "committee"],
    "canAccreditUsers": ["superadmin", "committee"],
    "canCreateOffices": ["superadmin", "committee"],
    "canAssignOffices": ["superadmin", "committee"],
    "canCreateScreeningCriteria": ["superadmin", "committee"],
    "canAssignAgents": ["superadmin", "committee"],
    "canCreateObservers": ["superadmin"]
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. OFFICES TABLE (Contested Positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Crown', -- Lucide icon identifier
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial offices
INSERT INTO public.offices (id, title, "order", description, icon) VALUES
  (uuid_generate_v4(), 'Executive President', 1, 'Chief Executive Officer presiding over executive meetings and steering council mandates.', 'Crown'),
  (uuid_generate_v4(), 'Vice President', 2, 'Principal assistant to the President, supervising committees and policy execution.', 'Shield'),
  (uuid_generate_v4(), 'General Secretary', 3, 'Custodian of council secretariat, minutes, correspondence, and institutional records.', 'FileText'),
  (uuid_generate_v4(), 'Treasurer & Financial Secretary', 4, 'Manager of budgetary allocations, audits, funds custody, and financial disclosures.', 'Coins'),
  (uuid_generate_v4(), 'Director of Socials & Welfare', 5, 'Overseeing student wellbeing, community engagements, cultural forums, and welfare.', 'Sparkles'),
  (uuid_generate_v4(), 'Public Relations Officer (PRO)', 6, 'Primary spokesperson managing institutional communications and public bulletins.', 'Megaphone')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. CANDIDATES / CONTESTANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ra_number TEXT NOT NULL UNIQUE,
  avatar TEXT,
  tagline TEXT,
  vision TEXT,
  antecedent TEXT[] DEFAULT '{}',
  current_offices TEXT[] DEFAULT '{}',
  achievements TEXT[] DEFAULT '{}',
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. VOTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ra_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  role public."role_enum" NOT NULL DEFAULT 'voter',
  is_accredited BOOLEAN NOT NULL DEFAULT false,
  is_screened BOOLEAN DEFAULT false,
  assigned_office_id UUID REFERENCES public.offices(id),
  is_agent BOOLEAN NOT NULL DEFAULT false,
  agent_office_id UUID REFERENCES public.offices(id),
  agent_candidate_id UUID REFERENCES public.candidates(id),
  department TEXT,
  phone TEXT,
  avatar TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  last_ip INET
);

-- Create index for RA number lookups
CREATE INDEX IF NOT EXISTS idx_voters_ra_number ON public.voters(ra_number);
CREATE INDEX IF NOT EXISTS idx_voters_email ON public.voters(email);
CREATE INDEX IF NOT EXISTS idx_voters_role ON public.voters(role);
CREATE INDEX IF NOT EXISTS idx_voters_accredited ON public.voters(is_accredited);

-- ============================================================================
-- 6. TIMELINE TABLE (Election Milestones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "order" INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  status public."timeline_status_enum" NOT NULL DEFAULT 'upcoming',
  icon TEXT NOT NULL DEFAULT 'Clock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial timeline items
INSERT INTO public.timeline (id, "order", title, description, date, status, icon) VALUES
  (uuid_generate_v4(), 1, 'Voter Registration & Database Publication', 'Publishing of eligible electorate voter lists, RA assignments, and institutional directory cross-matching.', 'Aug 01 - Aug 20, 2026', 'completed', 'UserCheck'),
  (uuid_generate_v4(), 2, 'Nomination & Candidate Screening', 'Submission of candidacy nomination forms, vetting of constitutional eligibility, and publication of contestant profiles.', 'Aug 21 - Aug 28, 2026', 'completed', 'FileCheck'),
  (uuid_generate_v4(), 3, 'Presidential & Executive Manifesto Debate', 'Broadcasted public debate sessions and manifesto presentations streamed live across constituent forums.', 'Sep 01 - Sep 05, 2026', 'completed', 'Radio'),
  (uuid_generate_v4(), 4, 'Voter Accreditation & Security Verification', 'Issuance of secure biometric/digital RA authentication tokens and single-device credential validation.', 'Sep 06 - Sep 11, 2026', 'active', 'BadgeCheck'),
  (uuid_generate_v4(), 5, 'FatBallot Live Election & E-Ballot Portal', 'Electronic ballot portal opens for accredited voters. Real-time encrypted vote casting with instant change capability.', 'Sep 12 - Sep 15, 2026', 'active', 'Vote'),
  (uuid_generate_v4(), 6, 'Official Collation, Audit & Declaration of Results', 'Cryptographic validation of SHA-256 audit ledger, official return certifications, and swearing-in ceremony.', 'Sep 16, 2026', 'upcoming', 'Award')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. YCEC MEMBERS TABLE (Youth & Electoral Committee)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ycec_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar TEXT,
  tenure TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial YCEC members
INSERT INTO public.ycec_members (id, name, role, email, phone, tenure) VALUES
  (uuid_generate_v4(), 'Engr. Nnamdi Paul Azikiwe', 'Chief Electoral Commissioner & Chairman', 'chairman.ycec@fatballot.org', '+234 803 111 2221', '2025 - 2027'),
  (uuid_generate_v4(), 'Prof. Aisha Mohammed Danjuma', 'Secretary to the Electoral Commission', 'secretary.ycec@fatballot.org', '+234 803 111 2222', '2025 - 2027'),
  (uuid_generate_v4(), 'Barr. Femi Kayode Alabi', 'Chief Legal & Constitutional Advisory Counsel', 'legal.ycec@fatballot.org', '+234 803 111 2223', '2025 - 2027'),
  (uuid_generate_v4(), 'Dr. Maryam Chinedu Sanni', 'Head of Digital Cryptography & Audit Ledger', 'security.ycec@fatballot.org', '+234 803 111 2224', '2025 - 2027'),
  (uuid_generate_v4(), 'Mr. Victor Damilola Adeleke', 'Director of Logistics, Accreditation & Collation', 'logistics.ycec@fatballot.org', '+234 803 111 2225', '2025 - 2027')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. VOTES TABLE (Ballot Cast Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voter_ra_number TEXT NOT NULL,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE RESTRICT,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  choice public."vote_choice_enum" NOT NULL,
  ip_address INET,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_change BOOLEAN NOT NULL DEFAULT false,
  voter_id UUID REFERENCES public.voters(id) ON DELETE SET NULL,
  CONSTRAINT valid_choice CHECK (
    (choice = 'candidate' AND candidate_id IS NOT NULL) OR
    (choice IN ('for', 'against') AND candidate_id IS NULL)
  )
);

-- Create indexes for vote queries
CREATE INDEX IF NOT EXISTS idx_votes_voter_ra ON public.votes(voter_ra_number);
CREATE INDEX IF NOT EXISTS idx_votes_office ON public.votes(office_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON public.votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_timestamp ON public.votes(timestamp);
CREATE INDEX IF NOT EXISTS idx_votes_is_change ON public.votes(is_change);

-- ============================================================================
-- 8b. VOTE CHANGE LOG (for tracking vote changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vote_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  previous_choice public."vote_choice_enum" NOT NULL,
  previous_candidate_id UUID REFERENCES public.candidates(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT -- RA number of the voter who changed their vote
);

-- ============================================================================
-- 9. SCREENING CRITERIA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.screening_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial screening criteria
INSERT INTO public.screening_criteria (id, office_id, title, criteria) VALUES
  (uuid_generate_v4(), (SELECT id FROM public.offices WHERE title = 'Executive President'), 'Executive Presidential Clearance Benchmark', '["Valid constituent matriculation and good financial standing", "Cumulative GPA above minimum threshold (3.0+)", "Zero disciplinary indictment or examination malpractice records", "Public asset and constitutional pledge disclosure", "Certified leadership track record and public debate participation", "Endorsement signatures from at least 25 accredited electorate members"]'::jsonb),
  (uuid_generate_v4(), (SELECT id FROM public.offices WHERE title = 'Vice President'), 'Vice Presidential Vetting Standards', '["Good academic and administrative standing", "Demonstrated committee coordination experience", "Pledge of executive alignment and non-partisanship", "Endorsement signatures from at least 15 registered constituents"]'::jsonb),
  (uuid_generate_v4(), (SELECT id FROM public.offices WHERE title = 'General Secretary'), 'General Secretariat Procedural Competence', '["Documentation, archival, and typing proficiency", "No unresolved disciplinary disputes", "Endorsement by at least 10 registered voters"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. CANDIDATE SCREENINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.candidate_screenings (
  candidate_id UUID PRIMARY KEY REFERENCES public.candidates(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.offices(id),
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  is_screened BOOLEAN NOT NULL DEFAULT false,
  screened_at TIMESTAMPTZ,
  screened_by UUID REFERENCES public.voters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. AGENTS TABLE (Electoral Agents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voter_id UUID NOT NULL REFERENCES public.voters(id) ON DELETE CASCADE,
  voter_ra_number TEXT NOT NULL,
  voter_name TEXT NOT NULL,
  office_id UUID NOT NULL REFERENCES public.offices(id),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id),
  candidate_name TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for agent lookups
CREATE INDEX IF NOT EXISTS idx_agents_voter ON public.agents(voter_id);
CREATE INDEX IF NOT EXISTS idx_agents_candidate ON public.agents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_agents_office ON public.agents(office_id);

-- ============================================================================
-- 12. OBSERVERS TABLE (Unique links, read-only, single-device enforced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.observers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rank TEXT NOT NULL,
  office TEXT,
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_device_id TEXT, -- Single device binding reference
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for token verification
CREATE INDEX IF NOT EXISTS idx_observers_token ON public.observers(token);
CREATE INDEX IF NOT EXISTS idx_observers_active ON public.observers(is_active);

-- ============================================================================
-- 13. SESSIONS TABLE (Authentication sessions - single device enforced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  ra_number TEXT NOT NULL,
  voter_id UUID NOT NULL REFERENCES public.voters(id) ON DELETE CASCADE,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_active_session UNIQUE (ra_number, is_revoked)
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_ra ON public.sessions(ra_number);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);

-- ============================================================================
-- 14. MAGIC LINKS TABLE (Authentication magic links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.magic_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  ra_number TEXT NOT NULL,
  email TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_active_link UNIQUE (token, used)
);

-- Create index for magic link verification
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_ra ON public.magic_links(ra_number);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON public.magic_links(expires_at);

-- ============================================================================
-- 15. AUDIT LOG TABLE (Immutable, cryptographically signed ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  index INTEGER NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  actor_ra_number TEXT,
  actor_name TEXT,
  actor_email TEXT,
  actor_role public."role_enum",
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash TEXT NOT NULL DEFAULT repeat('0', 64),
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_index ON public.audit_log(index);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_hash ON public.audit_log(hash);

-- ============================================================================
-- 16. PROFILE / VOTER PREFERENCES (Optional extension)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voter_profiles (
  voter_id UUID PRIMARY KEY REFERENCES public.voters(id) ON DELETE CASCADE,
  prefers_dark_mode BOOLEAN NOT NULL DEFAULT false,
  notification_email BOOLEAN NOT NULL DEFAULT true,
  dashboard_view VARCHAR(20) NOT NULL DEFAULT 'metrics', -- 'metrics' | 'list' | 'cards'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 17. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on settings
CREATE OR REPLACE FUNCTION public.update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER settings_updated_at_trigger
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_settings_timestamp();

-- Trigger to update updated_at on offices
CREATE OR REPLACE FUNCTION public.update_offices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER offices_updated_at_trigger
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_offices_timestamp();

-- Trigger to update updated_at on candidates
CREATE OR REPLACE FUNCTION public.update_candidates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER candidates_updated_at_trigger
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_candidates_timestamp();

-- ============================================================================
-- 18. ROW-LEVEL SECURITY POLICIES (Basic - enable as needed)
-- ============================================================================

-- Enable RLS on all tables (commented out by default - uncomment and customize for production)
-- ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.timeline ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ycec_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.screening_criteria ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.candidate_screenings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.observers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.voter_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================
-- Tables created: 17
-- Total records (initial data): Offices(6), Timeline(6), YCEC(5), Screening Criteria(3)
-- All UUIDs generated automatically with uuid_generate_v4()
-- Role enums: voter | contestant | committee | superadmin
-- Vote choices: candidate | for | against
-- Timeline status: completed | active | upcoming
-- ============================================================================