// The one Supabase client for the whole app. Uses the public (anon) key only;
// every table is protected by Row Level Security in supabase/schema.sql.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const missingVars = [url ? '' : 'VITE_SUPABASE_URL', anonKey ? '' : 'VITE_SUPABASE_ANON_KEY'].filter(Boolean);

export const supabaseConfigError = missingVars.length
  ? `Supabase is unreachable: missing ${missingVars.join(' and ')}. Set them in the Vercel dashboard (Settings -> Environment Variables) and redeploy.`
  : null;

// Built conditionally so a misconfigured build shows a readable error screen
// (see main.tsx) instead of crashing to a blank page at import time.
export const supabase: SupabaseClient = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : (null as unknown as SupabaseClient);