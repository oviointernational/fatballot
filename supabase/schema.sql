-- ============================================================================
-- FatBallot — COMPLETE database schema (single file, direct-to-Supabase)
-- ============================================================================
-- Run in the Supabase Dashboard -> SQL Editor. This file is idempotent and
-- SAFE TO RE-RUN any time: tables/views/functions use "if not exists" /
-- "create or replace", triggers and RLS policies are dropped before being
-- recreated, seeds use "on conflict do nothing", and the voters role
-- constraint is refreshed so 'ycec' is always allowed.
--
-- Architecture: the browser talks DIRECTLY to Supabase with the public anon
-- key. Every table is protected by Row Level Security. Logic that must not
-- live in the client runs in SECURITY DEFINER functions (audit chain,
-- observer verification, RA->email lookup, contestant "who voted for you").
--
-- Sign-in: Supabase Auth, email + password (accounts are created by the
-- voter themselves through the bank-gated Registration flow).
--
-- What this creates:
--   * voters (auth_uid maps to auth.users), registration_bank (gates new
--     signups), offices, candidates, votes, timeline, ycec_members,
--     screening_criteria, candidate_screenings, agents, observers,
--     settings (single JSONB row), audit_log (SHA-256 chained).
--   * Structural seed data: settings, 6 offices, 6 timeline milestones,
--     5 YCEC members, 3 screening benchmarks.
--   * One seeded Superadmin (RA-26406 / ernestoviosun@gmail.com). CHANGE the
--     password after your first sign-in (Profile -> Account Security).
--   * The ballot box starts EMPTY: no candidates, no votes, no agents,
--     no observers.
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- AUTH HELPER FUNCTIONS (security definer = bypass RLS, no recursion)
-- NOTE: these are plpgsql so they can be created here, BEFORE the voters
-- table exists below (sql-language bodies are validated at creation time).
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language plpgsql stable security definer set search_path = public as
$$
begin
  return exists (select 1 from public.voters where auth_uid = auth.uid() and role in ('committee', 'superadmin') and coalesce(is_active, true));
end;
$$;

create or replace function public.is_superadmin()
returns boolean language plpgsql stable security definer set search_path = public as
$$
begin
  return exists (select 1 from public.voters where auth_uid = auth.uid() and role = 'superadmin' and coalesce(is_active, true));
end;
$$;

-- RA number sign-in helper: resolves an RA number to the account email so the
-- login form can accept EITHER "2567" or "you@example.com".
create or replace function public.lookup_email_for_ra(p_ra_number integer)
returns text language plpgsql stable security definer set search_path = public as
$$
begin
  return (select email from public.voters where ra_number = p_ra_number and coalesce(is_active, true) limit 1);
end;
$$;

-- Access-control flag: may a registered-but-unaccredited voter cast a ballot?
create or replace function public.allows_unaccredited_voting()
returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce((data->>'allowUnaccreditedVoting')::boolean, false)
  from public.settings where id = 1;
$$;

-- --------------------------------------------------------------------------
-- ADMIN ACCOUNT PROVISIONING (registration is admin-managed: voters contact
-- the electoral body, and a Committee Admin or the Superadmin creates the
-- account with an initial password the voter may change after sign-in).
-- Both functions are SECURITY DEFINER so they may write auth.users.
-- --------------------------------------------------------------------------
create or replace function public.admin_provision_user(
  p_ra_number integer,
  p_email text,
  p_full_name text,
  p_password text,
  p_role text default 'voter',
  p_department text default '',
  p_phone text default ''
)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_auth_id uuid;
  v_norm_email text := lower(trim(p_email));
  v_first_name text;
  v_last_name text;
  v_role text := coalesce(nullif(trim(p_role), ''), 'voter');
begin
  if not is_admin() then
    raise exception 'Permission denied: admin access required.';
  end if;
  if v_role not in ('voter', 'contestant', 'committee') then
    raise exception 'Invalid role. Allowed roles: voter, contestant, committee.';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Initial password must be at least 6 characters.';
  end if;
  if exists (select 1 from public.voters where lower(email) = v_norm_email or ra_number = p_ra_number) then
    raise exception 'That RA number or email already belongs to a registered voter.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_norm_email) then
    raise exception 'An account already exists for that email address.';
  end if;

  v_first_name := split_part(trim(p_full_name), ' ', 1);
  v_last_name := nullif(trim(substr(trim(p_full_name), length(v_first_name) + 1)), '');

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    v_norm_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(), '', '', '', '', ''
  )
  returning id into v_auth_id;

  insert into public.voters (id, auth_uid, ra_number, email, first_name, middle_name, last_name, role, is_accredited, is_active, department, phone, registered_at)
  values (
    v_auth_id::text,
    v_auth_id,
    p_ra_number,
    v_norm_email,
    v_first_name,
    '',
    coalesce(v_last_name, v_first_name),
    v_role,
    false,
    true,
    coalesce(nullif(trim(p_department), ''), ''),
    coalesce(nullif(trim(p_phone), ''), ''),
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );

  return jsonb_build_object(
    'id', v_auth_id::text,
    'raNumber', p_ra_number,
    'email', v_norm_email,
    'role', v_role
  );
end;
$$;

-- Admin sets a brand-new password for a voter (e.g. forgotten password).
-- Revokes the voter's existing session tokens so the new password applies
-- immediately; the voter can change it to their own later in Profile.
create or replace function public.admin_change_password(p_voter_id text, p_new_password text)
returns boolean language plpgsql security definer set search_path = public as
$$
declare
  v_auth_uid uuid;
  v_role text;
begin
  if not is_admin() then
    raise exception 'Permission denied: admin access required.';
  end if;
  if char_length(coalesce(p_new_password, '')) < 6 then
    raise exception 'New password must be at least 6 characters.';
  end if;

  select auth_uid, role into v_auth_uid, v_role
  from public.voters where id = p_voter_id;
  if not found then
    raise exception 'No voter record matches that user.';
  end if;
  if v_role = 'superadmin' and not is_superadmin() then
    raise exception 'Only the Superadmin may change the Superadmin password.';
  end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      recovery_token = '',
      confirmation_token = '',
      email_change_token_new = '',
      email_change_token_current = '',
      updated_at = now()
  where id = v_auth_uid;

  delete from auth.refresh_tokens where user_id = v_auth_uid;

  return true;
end;
$$;

-- --------------------------------------------------------------------------
-- IDENTITY GUARD (RLS alone cannot compare old row to proposed row)
-- The trigger is attached to public.voters AFTER the table is created below.
-- --------------------------------------------------------------------------
create or replace function public.protect_voter_identity()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.auth_uid is distinct from old.auth_uid
       or new.email is distinct from old.email or new.ra_number is distinct from old.ra_number then
      raise exception 'Identity fields (id, auth_uid, email, RA number) cannot be changed.';
    end if;
    -- Only the committee may promote roles / change accreditation state.
    if new.role is distinct from old.role or new.is_accredited is distinct from old.is_accredited
       or new.assigned_office_id is distinct from old.assigned_office_id
       or new.is_agent is distinct from old.is_agent then
      if not public.is_admin() then
        raise exception 'Only the committee may change roles, accreditation, or office assignment.';
      end if;
      if old.role = 'superadmin' and not public.is_superadmin() then
        raise exception 'Only the Superadmin may modify a Superadmin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- SETTINGS (single JOSNB row; public read, committee write)
-- --------------------------------------------------------------------------
create table if not exists public.settings (
  id   integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

insert into public.settings (id, data) values (1, '{
  "siteName": "FatBallot",
  "aboutTitle": "Official 2026 Youth & Community Executive Elections",
  "aboutContent": "Welcome to the official digital voting platform for the 2026 General Elections. FatBallot is engineered to guarantee sovereign transparency, immutable election integrity, and seamless accessibility for all accredited voters. Every vote cast, accreditation processed, and ballot modification is cryptographically signed and permanently logged in our zero-tampering audit ledger. Please ensure your accreditation is active before proceeding to the ballot chamber.",
  "aboutImageUrl": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
  "contestantsCanViewVoters": true,
  "publicAuditLog": false,
  "registrationOpen": true,
  "allowUnaccreditedVoting": false,
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
on conflict (id) do nothing;

update public.settings
set data = jsonb_set(data, '{electionStartTime}', to_jsonb((now() - interval '1 hour')::text), true)
  || jsonb_set('{}'::jsonb, '{electionEndTime}', to_jsonb((now() + interval '72 hours')::text), true)
where id = 1 and not (data ? 'electionStartTime');

update public.settings
set data = jsonb_set(data, '{electionEndTime}', to_jsonb((now() + interval '72 hours')::text), true)
where id = 1 and not (data ? 'electionEndTime');

-- Backfill for databases created before this flag existed.
update public.settings
set data = data || '{"allowUnaccreditedVoting": false}'::jsonb
where id = 1 and not (data ? 'allowUnaccreditedVoting');

-- --------------------------------------------------------------------------
-- REGISTRATION BANK (committee may add eligible voters; the row is consumed
-- when the voter finishes self-registration)
-- --------------------------------------------------------------------------
create table if not exists public.registration_bank (
  id        bigint generated always as identity primary key,
  ra_number integer not null unique,
  email     text    not null unique,
  full_name text    not null default '',
  created_at text   not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

-- --------------------------------------------------------------------------
-- VOTERS (electoral roll; auth_uid links a row to Supabase Auth)
-- --------------------------------------------------------------------------
create table if not exists public.voters (
  id                text primary key,
  auth_uid          uuid unique,
  ra_number         integer not null unique check (ra_number > 0),
  email             text not null unique,
  first_name        text not null,
  middle_name       text not null default '',
  last_name         text not null,
  role              text not null default 'voter'
                    check (role in ('voter', 'contestant', 'committee', 'ycec', 'superadmin')),
  is_accredited     boolean not null default false,
  is_screened       boolean not null default false,
  assigned_office_id text,
  is_agent          boolean not null default false,
  agent_office_id   text,
  agent_candidate_id text,
  department        text not null default '',
  phone             text not null default '',
  avatar            text not null default '',
  registered_at     text not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  is_active         boolean not null default true
);

create index if not exists idx_voters_email ON public.voters (email);
create index if not exists idx_voters_role ON public.voters (role);

-- Keep the role whitelist in sync even when this file is re-run over a DB
-- whose voters table was created by an earlier version of the schema.
alter table public.voters drop constraint if exists voters_role_check;
alter table public.voters add constraint voters_role_check
  check (role in ('voter', 'contestant', 'committee', 'ycec', 'superadmin'));

-- Consume the registration-bank row once a voter account is created.
create or replace function public.consume_registration_bank()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  delete from public.registration_bank
  where ra_number = new.ra_number and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists consume_registration_bank on public.voters;
create trigger consume_registration_bank
  after insert on public.voters
  for each row execute function public.consume_registration_bank();

drop trigger if exists protect_voter_identity on public.voters;
create trigger protect_voter_identity
  before update on public.voters
  for each row execute function public.protect_voter_identity();

-- --------------------------------------------------------------------------
-- OFFICES (contested positions)
-- --------------------------------------------------------------------------
create table if not exists public.offices (
  id          text primary key,
  title       text not null,
  "order"     integer not null default 0,
  description text not null default '',
  icon        text not null default 'Crown'
);

insert into public.offices (id, title, "order", description, icon) VALUES
  ('off-pres', 'Executive President', 1, 'Chief Executive Officer presiding over executive meetings and steering council mandates.', 'Crown'),
  ('off-vp', 'Vice President', 2, 'Principal assistant to the President, supervising committees and policy execution.', 'Shield'),
  ('off-sec', 'General Secretary', 3, 'Custodian of council secretariat, minutes, correspondence, and institutional records.', 'FileText'),
  ('off-tres', 'Treasurer & Financial Secretary', 4, 'Manager of budgetary allocations, audits, funds custody, and financial disclosures.', 'Coins'),
  ('off-soc', 'Director of Socials & Welfare', 5, 'Overseeing student wellbeing, community engagements, cultural forums, and welfare.', 'Sparkles'),
  ('off-pro', 'Public Relations Officer (PRO)', 6, 'Primary spokesperson managing institutional communications and public bulletins.', 'Megaphone')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- CANDIDATES / CONTESTANTS (starts empty)
-- --------------------------------------------------------------------------
create table if not exists public.candidates (
  id              text primary key,
  office_id       text not null default '',
  voter_id        text,
  name            text not null,
  ra_number       text not null unique,
  avatar          text not null default '',
  tagline         text not null default '',
  vision          text not null default '',
  antecedent      jsonb not null default '[]'::jsonb,
  current_offices jsonb not null default '[]'::jsonb,
  achievements    jsonb not null default '[]'::jsonb,
  contact_email   text not null default ''
);

-- --------------------------------------------------------------------------
-- VOTES (ballot box; starts empty; one row per voter per office)
-- --------------------------------------------------------------------------
create table if not exists public.votes (
  id              text primary key default gen_random_uuid()::text,
  voter_ra_number integer not null,
  office_id       text not null,
  choice          text not null check (choice in ('candidate', 'for', 'against')),
  candidate_id    text,
  timestamp       text not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  unique (voter_ra_number, office_id)
);

create index if not exists idx_votes_office ON public.votes (office_id);
create index if not exists idx_votes_candidate ON public.votes (candidate_id);

-- --------------------------------------------------------------------------
-- TIMELINE (election milestones; editable from Admin)
-- --------------------------------------------------------------------------
create table if not exists public.timeline (
  id          text primary key,
  "order"     integer not null default 0,
  title       text not null,
  description text not null default '',
  date        text not null,
  status      text not null default 'upcoming'
              check (status in ('completed', 'active', 'upcoming')),
  icon        text not null default 'Clock'
);

insert into public.timeline (id, "order", title, description, date, status, icon) VALUES
  ('time-1', 1, 'Voter Registration & Database Publication', 'Publishing of eligible electorate voter lists, RA assignments, and institutional directory cross-matching.', 'Aug 01 - Aug 20, 2026', 'completed', 'UserCheck'),
  ('time-2', 2, 'Nomination & Candidate Screening', 'Submission of candidacy nomination forms, vetting of constitutional eligibility, and publication of contestant profiles.', 'Aug 21 - Aug 28, 2026', 'completed', 'FileCheck'),
  ('time-3', 3, 'Presidential & Executive Manifesto Debate', 'Broadcasted public debate sessions and manifesto presentations streamed live across constituent forums.', 'Sep 01 - Sep 05, 2026', 'completed', 'Radio'),
  ('time-4', 4, 'Voter Accreditation & Security Verification', 'Issuance of secure biometric/digital RA authentication tokens and single-device credential validation.', 'Sep 06 - Sep 11, 2026', 'active', 'BadgeCheck'),
  ('time-5', 5, 'FatBallot Live Election & E-Ballot Portal', 'Electronic ballot portal opens for accredited voters. Real-time encrypted vote casting with instant change capability.', 'Sep 12 - Sep 15, 2026', 'active', 'Vote'),
  ('time-6', 6, 'Official Collation, Audit & Declaration of Results', 'Cryptographic validation of SHA-256 audit ledger, official return certifications, and swearing-in ceremony.', 'Sep 16, 2026', 'upcoming', 'Award')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- YCEC MEMBERS (electoral commission directory)
-- --------------------------------------------------------------------------
create table if not exists public.ycec_members (
  id     text primary key,
  name   text not null,
  role   text not null,
  email  text not null,
  phone  text not null default '',
  avatar text not null default '',
  tenure text not null default ''
);

insert into public.ycec_members (id, name, role, email, phone, avatar, tenure) VALUES
  ('ycec-1', 'Engr. Nnamdi Paul Azikiwe', 'Chief Electoral Commissioner & Chairman', 'chairman.ycec@fatballot.org', '+234 803 111 2221', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-2', 'Prof. Aisha Mohammed Danjuma', 'Secretary to the Electoral Commission', 'secretary.ycec@fatballot.org', '+234 803 111 2222', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-3', 'Barr. Femi Kayode Alabi', 'Chief Legal & Constitutional Advisory Counsel', 'legal.ycec@fatballot.org', '+234 803 111 2223', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-4', 'Dr. Maryam Chinedu Sanni', 'Head of Digital Cryptography & Audit Ledger', 'security.ycec@fatballot.org', '+234 803 111 2224', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', '2025 - 2027'),
  ('ycec-5', 'Mr. Victor Damilola Adeleke', 'Director of Logistics, Accreditation & Collation', 'logistics.ycec@fatballot.org', '+234 803 111 2225', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80', '2025 - 2027')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- SCREENING CRITERIA + CANDIDATE SCREENINGS
-- --------------------------------------------------------------------------
create table if not exists public.screening_criteria (
  id        text primary key,
  office_id text not null unique,
  title     text not null,
  criteria  jsonb not null default '[]'::jsonb
);

insert into public.screening_criteria (id, office_id, title, criteria) VALUES
  ('crit-pres', 'off-pres', 'Executive Presidential Clearance Benchmark', '["Valid constituent matriculation and good financial standing", "Cumulative GPA above minimum threshold (3.0+)", "Zero disciplinary indictment or examination malpractice records", "Public asset and constitutional pledge disclosure", "Certified leadership track record and public debate participation", "Endorsement signatures from at least 25 accredited electorate members"]'::jsonb),
  ('crit-vp', 'off-vp', 'Vice Presidential Vetting Standards', '["Good academic and administrative standing", "Demonstrated committee coordination experience", "Pledge of executive alignment and non-partisanship", "Endorsement signatures from at least 15 registered constituents"]'::jsonb),
  ('crit-sec', 'off-sec', 'General Secretariat Procedural Competence', '["Documentation, archival, and typing proficiency", "No unresolved disciplinary disputes", "Endorsement by at least 10 registered voters"]'::jsonb)
on conflict (id) do nothing;

create table if not exists public.candidate_screenings (
  candidate_id text primary key,
  office_id    text not null,
  results      jsonb not null default '[]'::jsonb,
  passed_count integer not null default 0,
  total_count  integer not null default 0,
  percentage   integer not null default 0,
  is_screened  boolean not null default false,
  screened_at  text not null default ''
);

-- --------------------------------------------------------------------------
-- AGENTS + OBSERVERS (start empty; commissioned from Admin)
-- --------------------------------------------------------------------------
create table if not exists public.agents (
  id              text primary key,
  voter_id        text not null unique,
  voter_ra_number integer not null,
  voter_name      text not null,
  office_id       text not null,
  candidate_id    text not null,
  candidate_name  text not null,
  assigned_at     text not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

create table if not exists public.observers (
  id           text primary key,
  name         text not null,
  rank         text not null,
  office       text not null default '',
  phone        text not null,
  token        text not null unique,
  created_at   text not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  is_active    boolean not null default true
);

-- Observer verification (returns ONLY public fields, never the token).
create or replace function public.verify_observer(p_token text)
returns table (id text, name text, rank text, office text)
language sql stable security definer set search_path = public as
$$ select id, name, rank, office from public.observers
   where token = p_token and is_active
   limit 1 $$;

-- --------------------------------------------------------------------------
-- AUDIT LOG (append-only; the chain is built INSIDE append_audit so clients
-- cannot forge a block or race the ordering)
-- --------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  timestamp     text not null default to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  event_type    text not null,
  actor         jsonb not null default '{}'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  previous_hash text not null,
  hash          text not null
);

create index if not exists idx_audit_log_event ON public.audit_log (event_type);
create index if not exists idx_audit_log_actor_ra ON public.audit_log ((actor->>'raNumber'));
create index if not exists idx_audit_log_details_gin ON public.audit_log using gin (details);

create or replace function public.append_audit(p_event_type text, p_actor jsonb default '{}'::jsonb, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as
$$
declare
  v_prev text := 'genesis';
  v_ts   text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_enc  text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('fatballot_audit'));
  select hash into v_prev from public.audit_log order by id desc limit 1;
  if v_prev is null then v_prev := 'genesis'; end if;
  v_enc := encode(digest(v_prev || p_event_type || p_actor::text || p_details::text || v_ts, 'sha256'), 'hex');
  insert into public.audit_log (timestamp, event_type, actor, details, previous_hash, hash)
  values (v_ts, p_event_type, p_actor, p_details, v_prev, v_enc);
end;
$$;

-- Verify the whole chain; returns true/false.
create or replace function public.verify_audit_chain()
returns boolean language plpgsql security definer set search_path = public as
$$
declare
  r record;
  v_prev text := 'genesis';
  v_ok boolean := true;
begin
  for r in select * from public.audit_log order by id asc loop
    if r.previous_hash <> v_prev then
      v_ok := false;
    end if;
    if r.hash <> encode(digest(r.previous_hash || r.event_type || r.actor::text || r.details::text || r.timestamp, 'sha256'), 'hex') then
      v_ok := false;
    end if;
    v_prev := r.hash;
  end loop;
  return v_ok;
end;
$$;

-- A voter's own audit trail: every action they performed AND every action
-- performed ON their account (enrolment, accreditation, password changes,
-- profile edits, votes) — timestamped and attributed to the actor.
create or replace view public.my_audit as
  with me as (
    select id, ra_number::text as ra
    from public.voters
    where auth_uid = auth.uid()
  )
  select al.*
  from public.audit_log al, me
  where al.actor->>'raNumber'      = me.ra
     or al.details->>'raNumber'    = me.ra
     or al.details->>'voterId'     = me.id
     or al.details->>'voterRaNumber' = me.ra
  order by al.id desc;

-- Contestant: "who voted for you" — gated by settings + ownership.
create or replace function public.voters_for_candidate(p_candidate_id text)
returns table (ra_number integer, full_name text, department text)
language sql stable security definer set search_path = public as
$$
select v.ra_number,
       trim(v.first_name || ' ' || coalesce(v.middle_name, '') || ' ' || v.last_name),
       v.department
from public.votes vt
join public.voters v on v.ra_number = vt.voter_ra_number and coalesce(v.is_active, true)
join public.candidates c on c.id = vt.candidate_id
join public.settings s on s.id = 1
where vt.candidate_id = p_candidate_id
  and (select data->>'contestantsCanViewVoters' from public.settings where id = 1) = 'true'
  and exists (
    select 1 from public.voters me
    join public.candidates mc on mc.voter_id = me.id
    where me.auth_uid = auth.uid() and mc.id = p_candidate_id
  )
order by v.ra_number
$$;

-- --------------------------------------------------------------------------
-- PUBLIC RESULTS / STATS VIEWS (aggregate only; RLS inherently bypassed)
-- --------------------------------------------------------------------------
create or replace view public.vote_counts as
  select
    vt.office_id,
    vt.candidate_id,
    c.name  as candidate_name,
    c.avatar,
    sum((vt.choice = 'candidate' or vt.choice = 'for')::int) as votes_for,
    sum((vt.choice = 'against')::int)                        as votes_against
  from public.votes vt
  left join public.candidates c on c.id = vt.candidate_id
  group by vt.office_id, vt.candidate_id, c.name, c.avatar;

create or replace view public.office_totals as
  select office_id, count(*) as total
  from public.votes
  group by office_id;

create or replace view public.voter_stats as
  select
    (select count(*) from public.voters where coalesce(is_active, true))            as registered_voters,
    (select count(*) from public.voters where is_accredited and coalesce(is_active, true)) as accredited_voters,
    (select count(*) from public.offices)                                            as offices_count,
    (select count(*) from public.candidates)                                         as contestants_count,
    (select count(*) from public.votes)                                              as votes_count,
    (select count(*) from public.ycec_members)                                       as ycec_count;

grant select on public.vote_counts, public.office_totals, public.voter_stats, public.my_audit to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- --------------------------------------------------------------------------
alter table public.voters enable row level security;
alter table public.registration_bank enable row level security;
alter table public.settings enable row level security;
alter table public.offices enable row level security;
alter table public.candidates enable row level security;
alter table public.votes enable row level security;
alter table public.timeline enable row level security;
alter table public.ycec_members enable row level security;
alter table public.screening_criteria enable row level security;
alter table public.candidate_screenings enable row level security;
alter table public.agents enable row level security;
alter table public.observers enable row level security;
alter table public.audit_log enable row level security;

-- VOTERS
drop policy if exists voters_select_all on public.voters;
create policy voters_select_all on public.voters for select to authenticated using (coalesce(is_active, true));
drop policy if exists voters_insert_self on public.voters;
create policy voters_insert_self on public.voters for insert to authenticated with check (
  auth_uid = auth.uid()
  and role = 'voter'
  and is_accredited = false
  and is_active = true
  and lower(email) = (select lower(email) from auth.users where id = auth.uid())
  and exists (select 1 from public.registration_bank b
              where b.ra_number = ra_number and lower(b.email) = lower(email))
);
drop policy if exists voters_update_self on public.voters;
create policy voters_update_self on public.voters for update to authenticated
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());
drop policy if exists voters_update_admin on public.voters;
create policy voters_update_admin on public.voters for update to authenticated
  using (is_admin() and (role <> 'superadmin' or is_superadmin()))
  with check (is_admin() and (role <> 'superadmin' or is_superadmin()));
drop policy if exists voters_delete_admin on public.voters;
create policy voters_delete_admin on public.voters for delete to authenticated
  using (is_admin() and (role <> 'superadmin' or is_superadmin()));

-- REGISTRATION BANK (committee only)
drop policy if exists bank_select_admin on public.registration_bank;
create policy bank_select_admin on public.registration_bank for select to authenticated using (is_admin());
drop policy if exists bank_insert_admin on public.registration_bank;
create policy bank_insert_admin on public.registration_bank for insert to authenticated with check (is_admin());
drop policy if exists bank_update_admin on public.registration_bank;
create policy bank_update_admin on public.registration_bank for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists bank_delete_admin on public.registration_bank;
create policy bank_delete_admin on public.registration_bank for delete to authenticated using (is_admin());

-- SETTINGS
drop policy if exists settings_select_all on public.settings;
create policy settings_select_all on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_update_admin on public.settings;
create policy settings_update_admin on public.settings for update to authenticated using (is_admin()) with check (is_admin());

-- OFFICES
drop policy if exists offices_select_all on public.offices;
create policy offices_select_all on public.offices for select to anon, authenticated using (true);
drop policy if exists offices_insert_admin on public.offices;
create policy offices_insert_admin on public.offices for insert to authenticated with check (is_admin());
drop policy if exists offices_update_admin on public.offices;
create policy offices_update_admin on public.offices for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists offices_delete_admin on public.offices;
create policy offices_delete_admin on public.offices for delete to authenticated using (is_admin());

-- CANDIDATES (public read; committee writes; a contestant may claim their own seat)
drop policy if exists candidates_select_all on public.candidates;
create policy candidates_select_all on public.candidates for select to anon, authenticated using (true);
drop policy if exists candidates_insert_self on public.candidates;
create policy candidates_insert_self on public.candidates for insert to authenticated with check (
  exists (select 1 from public.voters v
          where v.id = voter_id
            and v.auth_uid = auth.uid()
            and v.role = 'contestant'
            and v.assigned_office_id = office_id)
);
drop policy if exists candidates_insert_admin on public.candidates;
create policy candidates_insert_admin on public.candidates for insert to authenticated with check (is_admin());
drop policy if exists candidates_update_admin on public.candidates;
create policy candidates_update_admin on public.candidates for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists candidates_delete_admin on public.candidates;
create policy candidates_delete_admin on public.candidates for delete to authenticated using (is_admin());

-- VOTES (own ballot; committee may inspect for audits; accredited gate in DB)
drop policy if exists votes_select_own on public.votes;
create policy votes_select_own on public.votes for select to authenticated
  using (exists (select 1 from public.voters v where v.auth_uid = auth.uid() and v.ra_number = voter_ra_number)
         or is_admin());
drop policy if exists votes_insert_self on public.votes;
create policy votes_insert_self on public.votes for insert to authenticated with check (
  exists (select 1 from public.voters v
          where v.auth_uid = auth.uid() and v.ra_number = voter_ra_number
            and (v.is_accredited or public.allows_unaccredited_voting())
            and coalesce(v.is_active, true))
  and exists (select 1 from public.offices o where o.id = office_id)
  and (choice = 'for' or choice = 'against' or (choice = 'candidate'
       and exists (select 1 from public.candidates c where c.id = candidate_id and c.office_id = office_id)))
);
drop policy if exists votes_update_self on public.votes;
create policy votes_update_self on public.votes for update to authenticated
  using (exists (select 1 from public.voters v where v.auth_uid = auth.uid() and v.ra_number = voter_ra_number)
         or is_admin())
  with check (
    exists (select 1 from public.voters v
            where v.auth_uid = auth.uid() and v.ra_number = voter_ra_number
              and (v.is_accredited or public.allows_unaccredited_voting())
              and coalesce(v.is_active, true))
    and exists (select 1 from public.offices o where o.id = office_id)
    and (choice = 'for' or choice = 'against' or (choice = 'candidate'
         and exists (select 1 from public.candidates c where c.id = candidate_id and c.office_id = office_id)))
  );
drop policy if exists votes_delete_admin on public.votes;
create policy votes_delete_admin on public.votes for delete to authenticated using (is_admin());

-- TIMELINE / YCEC (public read; committee write; observers may read for their portal)
drop policy if exists timeline_select_all on public.timeline;
create policy timeline_select_all on public.timeline for select to anon, authenticated using (true);
drop policy if exists timeline_insert_admin on public.timeline;
create policy timeline_insert_admin on public.timeline for insert to authenticated with check (is_admin());
drop policy if exists timeline_update_admin on public.timeline;
create policy timeline_update_admin on public.timeline for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists timeline_delete_admin on public.timeline;
create policy timeline_delete_admin on public.timeline for delete to authenticated using (is_admin());

drop policy if exists ycec_select_all on public.ycec_members;
create policy ycec_select_all on public.ycec_members for select to anon, authenticated using (true);
drop policy if exists ycec_insert_admin on public.ycec_members;
create policy ycec_insert_admin on public.ycec_members for insert to authenticated with check (is_admin());
drop policy if exists ycec_update_admin on public.ycec_members;
create policy ycec_update_admin on public.ycec_members for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists ycec_delete_admin on public.ycec_members;
create policy ycec_delete_admin on public.ycec_members for delete to authenticated using (is_admin());

-- SCREENING (public read; committee writes)
drop policy if exists scr_select_all on public.screening_criteria;
create policy scr_select_all on public.screening_criteria for select to anon, authenticated using (true);
drop policy if exists scr_insert_admin on public.screening_criteria;
create policy scr_insert_admin on public.screening_criteria for insert to authenticated with check (is_admin());
drop policy if exists scr_update_admin on public.screening_criteria;
create policy scr_update_admin on public.screening_criteria for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists scr_delete_admin on public.screening_criteria;
create policy scr_delete_admin on public.screening_criteria for delete to authenticated using (is_admin());

drop policy if exists can_scr_select_all on public.candidate_screenings;
create policy can_scr_select_all on public.candidate_screenings for select to anon, authenticated using (true);
drop policy if exists can_scr_insert_admin on public.candidate_screenings;
create policy can_scr_insert_admin on public.candidate_screenings for insert to authenticated with check (is_admin());
drop policy if exists can_scr_update_admin on public.candidate_screenings;
create policy can_scr_update_admin on public.candidate_screenings for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists can_scr_delete_admin on public.candidate_screenings;
create policy can_scr_delete_admin on public.candidate_screenings for delete to authenticated using (is_admin());

-- AGENTS (committee only read/write)
drop policy if exists agents_select_admin on public.agents;
create policy agents_select_admin on public.agents for select to authenticated using (is_admin());
drop policy if exists agents_insert_admin on public.agents;
create policy agents_insert_admin on public.agents for insert to authenticated with check (is_admin());
drop policy if exists agents_update_admin on public.agents;
create policy agents_update_admin on public.agents for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists agents_delete_admin on public.agents;
create policy agents_delete_admin on public.agents for delete to authenticated using (is_admin());

-- OBSERVERS (committee manages; tokens are never publicly readable)
drop policy if exists observers_select_admin on public.observers;
create policy observers_select_admin on public.observers for select to authenticated using (is_admin());
drop policy if exists observers_insert_admin on public.observers;
create policy observers_insert_admin on public.observers for insert to authenticated with check (is_admin());
drop policy if exists observers_update_admin on public.observers;
create policy observers_update_admin on public.observers for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists observers_delete_admin on public.observers;
create policy observers_delete_admin on public.observers for delete to authenticated using (is_admin());

-- AUDIT LOG (committee reads; everyone authenticates through append_audit RPC;
-- the my_audit view exposes your own trail; direct inserts are forbidden)
drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin on public.audit_log for select to authenticated using (is_admin());
drop policy if exists audit_select_own on public.audit_log;
create policy audit_select_own on public.audit_log for select to authenticated
  using (actor->>'raNumber' = (select ra_number::text from public.voters where auth_uid = auth.uid()));
-- When the committee enables the public audit log, every signed-in member may read the full chain.
drop policy if exists audit_select_public on public.audit_log;
create policy audit_select_public on public.audit_log for select to authenticated
  using ((select data->>'publicAuditLog' from public.settings where id = 1) = 'true');
-- Commissioned agents may monitor every audit entry that touches their candidate.
drop policy if exists audit_select_agent on public.audit_log;
create policy audit_select_agent on public.audit_log for select to authenticated
  using (exists (
    select 1 from public.agents a
    join public.voters v on v.ra_number = a.voter_ra_number
    where v.auth_uid = auth.uid() and v.is_agent and a.candidate_id = details->>'candidateId'
  ));

-- --------------------------------------------------------------------------
-- GRANTS (RLS still governs every row; functions run as owner)
-- --------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on function public.append_audit(text, jsonb, jsonb) to authenticated;
grant execute on function public.verify_audit_chain() to authenticated;
grant execute on function public.verify_observer(text) to anon, authenticated;
grant execute on function public.lookup_email_for_ra(integer) to anon, authenticated;
grant execute on function public.allows_unaccredited_voting() to anon, authenticated;
grant execute on function public.admin_provision_user(integer, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_change_password(text, text) to authenticated;
grant execute on function public.voters_for_candidate(text) to authenticated;
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- --------------------------------------------------------------------------
-- SEED: the ONE Superadmin (NO demo candidates/votes/voters)
-- --------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'ernestoviosun@gmail.com',
  crypt('Ovi#Super26406', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', '', ''
)
on conflict do nothing;

insert into public.voters (id, auth_uid, ra_number, email, first_name, middle_name, last_name, role, is_accredited, department, phone, registered_at)
select 'vot-superadmin', u.id, 26406, u.email, 'Ernest', 'Ovi', 'Sun', 'superadmin', true, 'Electoral Commission Directorate', '+234 801 000 2640', '2026-08-01T08:00:00.000Z'
from auth.users u
where u.email = 'ernestoviosun@gmail.com'
on conflict (id) do nothing;

insert into public.audit_log (timestamp, event_type, actor, details, previous_hash, hash)
select to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'GENESIS_BLOCK',
       '{"role":"system"}'::jsonb,
       '{"note":"Genesis block. Database schema seeded."}'::jsonb,
       'genesis',
       encode(digest('genesisGENESIS_BLOCK' || '{"role":"system"}'::text || '{"note":"Genesis block. Database schema seeded."}'::text || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'), 'hex')
where not exists (select 1 from public.audit_log);

-- ============================================================================
-- DONE. Next: set "Confirm email" OFF in Authentication settings, sign in as
-- the Superadmin (email/password provisioned below; change it at first login),
-- then enrol voters from the Voters tab: the Admin sets an account + initial
-- password, and the voter signs in with their RA Number + that password.
-- Passwords can be reset later via the Admin's "Change Password" control.
-- ============================================================================