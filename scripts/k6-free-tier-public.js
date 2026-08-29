/**
 * Free-tier-safe public catalog smoke (k6).
 *
 * Caps: max 25 VUs, ~3 RPS constant arrival (override with RATE / MAX_VUS).
 * Refuses production URLs unless ALLOW_PROD_LOAD=1.
 *
 *   k6 run -e TEST_BASE_URL=http://localhost:3000 scripts/k6-free-tier-public.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const MAX_VUS = Math.min(25, Number(__ENV.MAX_VUS || 25));
const RATE = Math.min(5, Math.max(1, Number(__ENV.RATE || 3)));
const DURATION = __ENV.DURATION || '90s';

if (
  (/mitfast-b2b(\.|-)/i.test(BASE) || /mitfast-b2b-puce/i.test(BASE)) &&
  __ENV.ALLOW_PROD_LOAD !== '1'
) {
  throw new Error('Refusing production Vercel URL. Use localhost or a staging host.');
}
if (/vercel\.app/i.test(BASE) && !/staging/i.test(BASE) && __ENV.ALLOW_PROD_LOAD !== '1') {
  throw new Error('Refusing vercel.app without "staging" in URL. Set ALLOW_PROD_LOAD=1 only with approval.');
}

export const options = {
  scenarios: {
    public_reads: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(10, MAX_VUS),
      maxVUs: MAX_VUS,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
  },
};

let productIds = [];

export function setup() {
  const products = http.get(`${BASE}/api/products?limit=20`);
  check(products, { 'setup products 200': (r) => r.status === 200 });
  try {
    const body = products.json();
    const list = body?.data?.products || body?.data || body?.products || [];
    if (Array.isArray(list)) {
      productIds = list
        .map((p) => p.id || p.slug)
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch (_) {
    /* keep empty */
  }
  return { productIds };
}

export default function (data) {
  const ids = data.productIds || [];

  const home = http.get(`${BASE}/`);
  check(home, { 'home 200': (r) => r.status === 200 });

  const products = http.get(`${BASE}/api/products?limit=20`);
  check(products, { 'products 200': (r) => r.status === 200 });

  const categories = http.get(`${BASE}/api/categories`);
  check(categories, { 'categories 200': (r) => r.status === 200 });

  if (ids.length > 0) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const detail = http.get(`${BASE}/api/products/${id}`);
    check(detail, {
      'product detail ok': (r) => r.status === 200 || r.status === 404,
      'product detail not 5xx': (r) => r.status < 500,
    });
  }

  sleep(0.1);
}
