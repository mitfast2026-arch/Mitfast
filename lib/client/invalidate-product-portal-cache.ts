import { invalidatePortalCache } from '@/lib/client/portal-data-cache';

/** Invalidate admin/supplier portal client caches after product mutations. */
export function invalidateProductPortalCaches() {
  if (typeof window === 'undefined') return;
  invalidatePortalCache('/api/products');
  invalidatePortalCache('/api/supplier/products');
  invalidatePortalCache('/api/admin/approvals');
}
