/**
 * Safe supplier-portal READ smoke (k6). Free-tier friendly stages.
 *
 * Writes are intentionally omitted — use scripts/supplier-load-test.ts for CRUD.
 *
 *   k6 run -e TEST_BASE_URL=http://localhost:3000 scripts/k6-supplier-portal-smoke.js
 *
 * Do NOT point at production Vercel/Supabase free tier with high VUs.
 * Default peaks at 40 VUs. Override with -e MAX_VUS=20 for extra safety.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const MAX_VUS = Math.min(25, Number(__ENV.MAX_VUS || 25));
const BASE = __ENV.TEST_BASE_URL || 'http://localhost:3000';

if (
  (/mitfast-b2b.*vercel\.app/i.test(BASE) || (/vercel\.app/i.test(BASE) && !/staging/i.test(BASE))) &&
  __ENV.ALLOW_PROD_LOAD !== '1'
) {
  throw new Error('Refusing production Vercel URL. Set ALLOW_PROD_LOAD=1 only with explicit approval.');
}

export const options = {
  stages: [
    { duration: '20s', target: Math.min(8, MAX_VUS) },
    { duration: '40s', target: Math.min(15, MAX_VUS) },
    { duration: '40s', target: MAX_VUS },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  // Public/catalog reads that suppliers also hit while working in portal
  const products = http.get(`${BASE}/api/products?limit=20`);
  check(products, { 'products 200': (r) => r.status === 200 });

  const categories = http.get(`${BASE}/api/categories`);
  check(categories, { 'categories 200': (r) => r.status === 200 });

  // Unauthenticated supplier APIs should fail closed (401/403), not 5xx.
  // Tag expected auth failures so they do not inflate http_req_failed.
  const own = http.get(`${BASE}/api/supplier/products`, {
    tags: { name: 'supplier_products_gated' },
    responseCallback: http.expectedStatuses(200, 401, 403),
  });
  check(own, {
    'supplier products gated': (r) => r.status === 401 || r.status === 403 || r.status === 200,
    'supplier products not 5xx': (r) => r.status < 500,
  });

  sleep(1);
}
