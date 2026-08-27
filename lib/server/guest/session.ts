import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export const GUEST_COOKIE = 'mf_guest_sid';
const GUEST_TTL_DAYS = 30;

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function clearGuestCookie() {
  const jar = await cookies();
  jar.set(GUEST_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

/**
 * Ensures a valid guest session id (creates DB row + sets httpOnly cookie).
 */
export async function ensureGuestSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  const admin = createAdminClient();

  if (existing) {
    const { data } = await admin
      .from('guest_sessions')
      .select('id, expires_at')
      .eq('id', existing)
      .maybeSingle();

    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      return data.id;
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + GUEST_TTL_DAYS);

  const { assertRateLimit } = await import('@/lib/server/db/rate-limit');
  const limited = await assertRateLimit({
    scope: 'guest_session_create',
    key: existing || 'new',
    windowSeconds: 60,
    maxHits: 30,
  });
  if (!limited.ok && limited.code === 'RATE_LIMITED') {
    throw new Error('Too many guest sessions');
  }

  const { data: created, error } = await admin
    .from('guest_sessions')
    .insert({ expires_at: expiresAt.toISOString() })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create guest session');
  }

  jar.set(GUEST_COOKIE, created.id, cookieOptions(GUEST_TTL_DAYS * 24 * 60 * 60));
  return created.id;
}

export async function peekGuestSessionId(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (!existing) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('guest_sessions')
    .select('id, expires_at')
    .eq('id', existing)
    .maybeSingle();

  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return data.id;
}
