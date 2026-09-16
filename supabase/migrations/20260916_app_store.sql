-- Blob persistence for the FatBallot in-memory store + audit ledger.
-- Vercel serverless functions have no persistent disk, so the full StoreData
-- JSON is stored here under key 'store', and the hash-chained audit ledger
-- under key 'ledger'. RLS stays disabled (matching the rest of the schema);
-- app tables rely on anon/service-role key access.
create table if not exists public.app_store (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);