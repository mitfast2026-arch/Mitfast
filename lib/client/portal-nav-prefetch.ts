import { prefetchPortalData } from '@/lib/client/portal-data-cache';

/** Default list page size for portal GETs. */
export const PORTAL_PAGE_LIMIT = 25;

/**
 * Map portal routes → API URLs to warm on hover/intent.
 * Keep URLs aligned with each page's initial fetch.
 */
export const PORTAL_ROUTE_PREFETCH: Record<string, string[]> = {
  '/admin/dashboard': ['/api/admin/dashboard'],
  '/admin/approvals': ['/api/admin/approvals'],
  '/admin/products': [
    `/api/products?mode=admin&page=1&limit=${PORTAL_PAGE_LIMIT}&sort=newest`,
    '/api/categories?mode=admin&status=active',
  ],
  '/admin/suppliers': [`/api/suppliers?page=1&limit=${PORTAL_PAGE_LIMIT}`],
  '/admin/customers': [`/api/customers?page=1&limit=${PORTAL_PAGE_LIMIT}`],
  '/admin/enquiries': [`/api/enquiries?page=1&limit=${PORTAL_PAGE_LIMIT}`],
  '/admin/rfqs': [`/api/rfqs?page=1&limit=${PORTAL_PAGE_LIMIT}`],
  '/admin/orders': [
    `/api/orders?convertedOnly=true&page=1&limit=${PORTAL_PAGE_LIMIT}&search=`,
  ],
  '/admin/categories': ['/api/categories?mode=admin&status=active'],
  '/admin/homepage': ['/api/admin/homepage'],
  '/admin/settings': ['/api/settings'],
  '/supplier/dashboard': [], // stats URL needs supplier id — warmed by layout
  '/supplier/products': [
    `/api/supplier/products?page=1&limit=${PORTAL_PAGE_LIMIT}`,
    '/api/categories?status=active',
  ],
  '/supplier/profile': ['/api/supplier/profile'],
  '/supplier/settings': [],
  '/supplier/product-views': [],
};

export function prefetchPortalRouteData(href: string) {
  const urls = PORTAL_ROUTE_PREFETCH[href];
  if (!urls?.length) return;
  for (const url of urls) {
    prefetchPortalData(url);
  }
}
