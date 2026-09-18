-- ============================================================================
-- FATBALLOT — single clean schema (Supabase)
-- Paste this ENTIRE file once into: Dashboard -> SQL Editor -> New query -> Run
--
-- Tables:        profiles, registration_bank, settings, offices, candidates, votes
-- Access model:  Row Level Security on every table. The browser talks to
--                Supabase directly with the ANON key; the service_role key is
--                never used by the app.
-- No demo data.  The only seeded row is the single Superadmin (see bottom).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  ra_number  text not null unique,
  email      text not null unique,
  full_name  text not null default '',
  phone      text not null default '',
  department text not null default '',
  level      text not null default '',
  role       text not null default 'member' check (role in ('member', 'admin', 'superadmin')),
  status     text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The registration bank: the committee pre-loads RA + email (+ optional name).
-- A voter may only register if their RA + email match a bank entry.
create table public.registration_bank (
  id         uuid primary key default gen_random_uuid(),
  ra_number  text not null unique,
  email      text not null unique,
  full_name  text not null default '',
  created_at timestamptz not null default now()
);

create unique index registration_bank_email_ci on public.registration_bank (lower(email));
create unique index profiles_email_ci on public.profiles (lower(email));

create table public.settings (
  id               int primary key default 1 check (id = 1),
  site_name        text not null default 'FatBallot',
  about_title      text not null default 'About the Election',
  about_content    text not null default 'Welcome to the official FatBallot election platform.',
  about_image_url  text not null default '',
  election_start   timestamptz not null default now(),
  election_end     timestamptz not null default now() + interval '7 days',
  registration_open boolean not null default true,
  voting_open      boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table public.offices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  icon        text not null default 'Crown',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.candidates (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices (id) on delete cascade,
  ra_number   text not null,
  full_name   text not null,
  avatar      text not null default '',
  tagline     text not null default '',
  statement   text not null default '',
  created_at  timestamptz not null default now()
);

create table public.votes (
  id           uuid primary key default gen_random_uuid(),
  voter_id     uuid not null references public.profiles (id) on delete cascade,
  office_id    uuid not null references public.offices (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  choice       text not null check (choice in ('candidate', 'for', 'against')),
  created_at   timestamptz not null default now(),
  unique (voter_id, office_id)  -- one vote per office per voter (changing your
                                -- vote UPSERTs the same row)
);

-- ----------------------------------------------------------------------------
-- AUTH HELPER FUNCTIONS (security definer = bypass RLS, no recursion)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'superadmin')) $$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin') $$;

-- Guards identity fields (RA number, email, role, status) against self-edits.
-- RLS alone cannot compare the old row to the proposed row ("new"/"old"), so a
-- BEFORE UPDATE trigger does: only committee members may change identity
-- fields, and only the Superadmin may touch a Superadmin's row.
create or replace function public.protect_profile_identity()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'The id cannot be changed';
    end if;
    if new.ra_number is distinct from old.ra_number
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.status is distinct from old.status then
      if not public.is_admin() then
        raise exception 'Only the committee may change identity fields';
      end if;
      if old.role = 'superadmin' and not public.is_superadmin() then
        raise exception 'Only the Superadmin may modify a Superadmin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

-- PROFILES
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated
  using (is_admin());

-- A voter registers their own profile ONLY if: it is their own auth identity,
-- they stay a plain 'member'/'active', and their RA + email are in the
-- registration bank (which is then consumed by the unique constraints).
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and role = 'member'
    and status = 'active'
    and lower(email) = (select lower(email) from auth.users where id = auth.uid())
    and exists (select 1 from public.registration_bank b
                where b.ra_number = ra_number
                  and lower(b.email) = lower(email))
    and exists (select 1 from public.settings s where s.id = 1 and s.registration_open)
  );

-- Members may update their own row; the trigger locks identity fields.
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins manage others; only a superadmin can touch superadmins or appoint one.
create policy profiles_update_admin on public.profiles for update to authenticated
  using (is_admin() and (role <> 'superadmin' or is_superadmin()))
  with check (is_admin() and (role <> 'superadmin' or is_superadmin()));

create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (is_admin() and (role <> 'superadmin' or is_superadmin()));

-- REGISTRATION BANK (committee only: superadmin + admin)
alter table public.registration_bank enable row level security;
create policy bank_select_admin on public.registration_bank for select to authenticated using (is_admin());
create policy bank_insert_admin on public.registration_bank for insert to authenticated with check (is_admin());
create policy bank_delete_admin on public.registration_bank for delete to authenticated using (is_admin());

-- SETTINGS (public read; admin write)
alter table public.settings enable row level security;
create policy settings_select_all on public.settings for select to anon, authenticated using (true);
create policy settings_update_admin on public.settings for update to authenticated using (is_admin()) with check (is_admin());

-- OFFICES (public read; committee write)
alter table public.offices enable row level security;
create policy offices_select_all on public.offices for select to anon, authenticated using (true);
create policy offices_insert_admin on public.offices for insert to authenticated with check (is_admin());
create policy offices_update_admin on public.offices for update to authenticated using (is_admin()) with check (is_admin());
create policy offices_delete_admin on public.offices for delete to authenticated using (is_admin());

-- CANDIDATES (public read; committee write)
alter table public.candidates enable row level security;
create policy candidates_select_all on public.candidates for select to anon, authenticated using (true);
create policy candidates_insert_admin on public.candidates for insert to authenticated with check (is_admin());
create policy candidates_update_admin on public.candidates for update to authenticated using (is_admin()) with check (is_admin());
create policy candidates_delete_admin on public.candidates for delete to authenticated using (is_admin());

-- VOTES (own ballot; admin may inspect for audits; voting gates in the DB)
alter table public.votes enable row level security;
create policy votes_select_own on public.votes for select to authenticated
  using (voter_id = auth.uid());
create policy votes_select_admin on public.votes for select to authenticated
  using (is_admin());
create policy votes_insert_self on public.votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.settings s where s.id = 1 and s.voting_open)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );
create policy votes_update_self on public.votes for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.settings s where s.id = 1 and s.voting_open)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );
create policy votes_delete_admin on public.votes for delete to authenticated using (is_admin());

-- ----------------------------------------------------------------------------
-- PUBLIC RESULTS / STATS VIEWS (security definer = reads all ballots)
-- ----------------------------------------------------------------------------
create or replace view public.vote_counts as
  select
    v.office_id,
    v.candidate_id,
    c.full_name as candidate_name,
    c.avatar,
    c.tagline,
    count(*) filter (where v.choice in ('candidate', 'for'))  as votes_for,
    count(*) filter (where v.choice = 'against')              as votes_against
  from public.votes v
  join public.candidates c on c.id = v.candidate_id
  group by v.office_id, v.candidate_id, c.full_name, c.avatar, c.tagline;

create or replace view public.office_totals as
  select office_id, count(*) as total
  from public.votes
  group by office_id;

create or replace view public.voter_stats as
  select
    (select count(*) from public.profiles)          as registered_voters,
    (select count(*) from public.profiles where status = 'active') as active_voters,
    (select count(*) from public.offices)           as offices_count,
    (select count(*) from public.candidates)        as candidates_count,
    (select count(*) from public.votes)             as votes_count;

grant select on public.vote_counts, public.office_totals, public.voter_stats to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- GRANTS (RLS still governs every row)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- SEED: settings + the ONE superadmin (NO demo data)
-- ----------------------------------------------------------------------------
insert into public.settings (id) values (1);

-- Change the password below right after your first sign-in:
--   Profile -> Account Security -> Change Password
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

insert into public.profiles (id, ra_number, email, full_name, role, status)
select u.id, '26406', u.email, 'Ernest Ovi Sun', 'superadmin', 'active'
from auth.users u
where u.email = 'ernestoviosun@gmail.com'
on conflict do nothing;