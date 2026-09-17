import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gavjqssxqfzbpniammrm.supabase.co';
// Prefer a service-role key (bypasses RLS) but fall back to the anon key.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export function hasSupabase(): boolean {
  return SUPABASE_KEY.length > 0;
}

export function getSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// In production a persistent store is mandatory; fail loudly instead of silently losing data.
export function ensureSupabaseOrThrow(serviceName: string) {
  if (process.env.NODE_ENV === 'production' && !hasSupabase()) {
    throw new Error(
      `${serviceName} requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) to persist data in production.`
    );
  }
}