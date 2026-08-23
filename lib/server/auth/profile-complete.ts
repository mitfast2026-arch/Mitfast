import type { User } from '@supabase/supabase-js';

export function isProfileIdentityComplete(profile: {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  const name = (profile.full_name || '').trim();
  const phone = (profile.phone || '').trim();
  const email = (profile.email || '').trim();
  return name.length >= 2 && phone.length >= 7 && email.includes('@');
}

export function nameFromAuthUser(user: User | null | undefined): string {
  if (!user) return '';
  const meta = user.user_metadata || {};
  return (
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    ''
  ).trim();
}

export function emailFromAuthUser(user: User | null | undefined): string {
  return (user?.email || '').trim();
}
