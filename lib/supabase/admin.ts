import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

declare global {
  // eslint-disable-next-line no-var
  var __mitfastAdminClient: SupabaseClient<Database> | undefined;
}

/**
 * Service-role Supabase client (singleton per process).
 * Avoids reallocating a client on every API/service call under serverless concurrency.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (globalThis.__mitfastAdminClient) {
    return globalThis.__mitfastAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const client = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  globalThis.__mitfastAdminClient = client;
  return client;
}
