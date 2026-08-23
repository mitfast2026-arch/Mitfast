/**
 * Full page navigation through the server sign-out route so auth cookies are cleared
 * before middleware runs on the login page.
 */
import { invalidatePortalCache } from '@/lib/client/portal-data-cache';

export function signOutTo(nextHref: string) {
  const next =
    nextHref.startsWith('/') && !nextHref.startsWith('//')
      ? nextHref
      : '/auth';
  invalidatePortalCache();
  window.location.assign(`/auth/signout?next=${encodeURIComponent(next)}`);
}
