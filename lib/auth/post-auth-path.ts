/**
 * Shared post-login / portal destination rules.
 * Used by middleware, OAuth callback, and client auth pages.
 * Never treat this as authorization — callers must already know profiles.role.
 */

export const ACCESS_DENIED_PARAM = 'notice';
export const ACCESS_DENIED_VALUE = 'denied';

const BUYER_STOREFRONT_PREFIXES = [
  '/cart',
  '/products',
  '/categories',
  '/enquiry',
  '/rfq',
  '/customer',
  '/wishlist',
  '/track',
  '/about',
  '/services',
  '/privacy',
  '/terms',
] as const;

export function isIdentityComplete(profile: {
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

export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://') || path.includes('\\')) return false;
  return true;
}

export function internalPathname(path: string): string {
  try {
    return new URL(path, 'http://local.invalid').pathname;
  } catch {
    return path.split('?')[0] || path;
  }
}

export function buyerAllowsStorefront(path: string): boolean {
  if (!isSafeInternalPath(path)) return false;
  const pathname = internalPathname(path);
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/supplier') ||
    pathname.startsWith('/auth')
  ) {
    return false;
  }
  if (pathname === '/') return true;
  return BUYER_STOREFRONT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function homeForRole(
  role: string | null | undefined,
  supplierStatus?: string | null
): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'supplier') {
    if (!supplierStatus) return '/auth/supplier/apply';
    if (supplierStatus === 'rejected') return '/auth/supplier/rejected';
    if (supplierStatus === 'archived') return '/auth/supplier/pending?status=archived';
    if (supplierStatus === 'pending') return '/auth/supplier/pending';
    if (supplierStatus === 'active') return '/supplier/dashboard';
    return '/auth/supplier/pending';
  }
  return '/customer/dashboard';
}

export function appendDeniedNotice(path: string): string {
  const url = new URL(path, 'http://local.invalid');
  url.searchParams.set(ACCESS_DENIED_PARAM, ACCESS_DENIED_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function completeProfilePath(
  role: 'buyer' | 'supplier',
  redirectPath?: string | null
): string {
  const params = new URLSearchParams();
  params.set('role', role);
  if (role === 'buyer' && redirectPath && buyerAllowsStorefront(redirectPath)) {
    params.set('redirect', redirectPath);
  }
  return `/auth/complete-profile?${params.toString()}`;
}

export function resolvePostAuthPath(opts: {
  role: string | null | undefined;
  supplierStatus?: string | null;
  redirectPath?: string | null;
  /** When false, non-admins go to complete-profile. Defaults to true. */
  identityComplete?: boolean;
}): string {
  const role = opts.role;
  const redirectPath = opts.redirectPath;
  const identityOk = opts.identityComplete !== false;

  if (role === 'admin') {
    if (
      redirectPath &&
      isSafeInternalPath(redirectPath) &&
      internalPathname(redirectPath).startsWith('/admin')
    ) {
      return redirectPath;
    }
    return '/admin/dashboard';
  }

  if (role === 'supplier') {
    if (!identityOk) return completeProfilePath('supplier');
    if (
      opts.supplierStatus === 'active' &&
      redirectPath &&
      isSafeInternalPath(redirectPath) &&
      internalPathname(redirectPath).startsWith('/supplier')
    ) {
      return redirectPath;
    }
    return homeForRole('supplier', opts.supplierStatus);
  }

  if (!identityOk) return completeProfilePath('buyer', redirectPath);
  if (redirectPath && buyerAllowsStorefront(redirectPath)) return redirectPath;
  return '/customer/dashboard';
}
