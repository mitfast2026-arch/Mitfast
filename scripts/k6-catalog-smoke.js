/**
 * Staging/localhost catalog smoke (k6) — free-tier safe defaults.
 *
 * Prefer scripts/k6-free-tier-public.js for constant-arrival-rate control.
 *
 *   k6 run -e TEST_BASE_URL=http://localhost:3000 -e MAX_VUS=25 scripts/k6-catalog-smoke.js
 *
 * Do NOT point at production without explicit approval (ALLOW_PROD_LOAD=1).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.TEST_BASE_URL || 'http://localhost:3000';
const MAX_VUS = Math.min(25, Number(__ENV.MAX_VUS || 25));

if (
  (/mitfast-b2b(\.|-)/i.test(BASE) || (/vercel\.app/i.test(BASE) && !/staging/i.test(BASE))) &&
  __ENV.ALLOW_PROD_LOAD !== '1'
) {
  throw new Error('Refusing production-like URL. Use localhost or staging.');
}

export const options = {
  stages: [
    { duration: '30s', target: Math.min(10, MAX_VUS) },
    { duration: '60s', target: MAX_VUS },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const home = http.get(`${BASE}/`);
  check(home, { 'home 200': (r) => r.status === 200 });

  const products = http.get(`${BASE}/api/products?limit=20`);
  check(products, { 'products api 200': (r) => r.status === 200 });

  const catalog = http.get(`${BASE}/products`);
  check(catalog, {
    'catalog 200': (r) => r.status === 200,
    'catalog has product link': (r) => String(r.body).includes('/products/'),
  });

  const robots = http.get(`${BASE}/robots.txt`);
  check(robots, { 'robots 200': (r) => r.status === 200 });

  sleep(1);
}
