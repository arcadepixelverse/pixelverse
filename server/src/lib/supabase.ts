import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('[Supabase] Missing SUPABASE_URL environment variable');
}
if (!supabaseAnonKey) {
  throw new Error('[Supabase] Missing SUPABASE_ANON_KEY environment variable');
}
if (!supabaseServiceRoleKey) {
  throw new Error('[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/** Admin client with service_role key to bypass RLS for server-side operations and RPC calls */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** Auth client with publishable anon key used strictly for token verification (auth.getUser) */
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
