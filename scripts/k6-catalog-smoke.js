/**
 * Staging-only catalog smoke (k6).
 *
 *   k6 run -e TEST_BASE_URL=https://YOUR-STAGING.vercel.app scripts/k6-catalog-smoke.js
 *
 * Do NOT point at production without explicit approval.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = __ENV.TEST_BASE_URL || 'http://localhost:3000';

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
