export type PortalRole = 'buyer' | 'supplier';
export type DbUserRole = 'customer' | 'supplier' | 'admin';

export const OAUTH_INTENT_COOKIE = 'mitfast_oauth_intent';

export const BUYER_ON_SUPPLIER_ERROR_MESSAGE =
  'This account is already a buyer. Use a different email for supplier access.';

export const SUPPLIER_ON_BUYER_ERROR_MESSAGE =
  'This account is a supplier. Sign in on the supplier login page.';

export const ADMIN_ON_NON_ADMIN_ERROR_MESSAGE =
  'This account has admin access. Sign in via staff login.';

export function portalToDbRole(portal: PortalRole): 'customer' | 'supplier' {
  return portal === 'supplier' ? 'supplier' : 'customer';
}

export function dbRoleToPortal(role: DbUserRole): 'buyer' | 'supplier' | 'admin' {
  if (role === 'supplier') return 'supplier';
  if (role === 'admin') return 'admin';
  return 'buyer';
}

/**
 * Returns a user-friendly error message if an account with dbRole attempts to
 * authenticate on a portal expecting expectedPortal. Returns null if allowed.
 */
export function getPortalMismatchError(
  expectedPortal: PortalRole,
  dbRole: string | null | undefined
): string | null {
  if (!dbRole) return null;

  if (expectedPortal === 'buyer') {
    if (dbRole === 'supplier') {
      return SUPPLIER_ON_BUYER_ERROR_MESSAGE;
    }
    // Admins are allowed to sign in via the buyer portal and are automatically routed to the admin dashboard
  }

  if (expectedPortal === 'supplier') {
    if (dbRole === 'customer') {
      return BUYER_ON_SUPPLIER_ERROR_MESSAGE;
    }
    if (dbRole === 'admin') {
      return ADMIN_ON_NON_ADMIN_ERROR_MESSAGE;
    }
  }

  return null;
}

export interface ProfileStubCheck {
  role?: string | null;
  phone?: string | null;
  created_at?: string | null;
}

/**
 * Checks whether a customer profile is a fresh trigger-created OAuth stub
 * (has no phone number and was created within the last 15 minutes),
 * which can safely be claimed/converted into a supplier profile during initial OAuth onboarding.
 */
export function isFreshOAuthProfile(
  profile: ProfileStubCheck | null | undefined,
  hasSupplierRecord: boolean = false
): boolean {
  if (!profile) return true;
  if (profile.role !== 'customer') return false;
  if (hasSupplierRecord) return false;

  const phone = (profile.phone || '').trim();
  if (phone.length > 0) return false;

  if (profile.created_at) {
    const createdTime = new Date(profile.created_at).getTime();
    if (!Number.isNaN(createdTime)) {
      const ageMs = Date.now() - createdTime;
      // 15 minutes window for OAuth completion
      const MAX_AGE_MS = 15 * 60 * 1000;
      return ageMs >= 0 && ageMs < MAX_AGE_MS;
    }
  }

  // If created_at is not present, consider fresh if phone is empty and no supplier record
  return true;
}
