import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | undefined;

export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  browserClient ??= createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

export const createClient = createBrowserClient;
