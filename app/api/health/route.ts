import { NextResponse } from 'next/server';

/**
 * Shallow readiness check — env present only (no DB ping to keep it cheap/safe).
 */
export async function GET() {
  const supabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const ok = supabaseUrl && supabaseAnon && serviceRole;

  return NextResponse.json(
    {
      ok,
      checks: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnon,
        SUPABASE_SERVICE_ROLE_KEY: serviceRole,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
