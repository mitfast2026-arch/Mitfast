# MITFAST Staging Load Test Plan

**Status:** CODE-READY until this plan is executed on staging. Do not run against production.

## Environment

- Staging Vercel deployment (mirror of `mitfast-b2b`)
- Staging Supabase project or isolated DB copy
- Tool: [k6](https://k6.io/) or Artillery

## Metrics to record

| Metric | Source |
|--------|--------|
| RPS | k6 |
| P50 / P95 / P99 latency | k6 + Vercel Analytics |
| 5xx rate | Vercel |
| PostgREST / DB CPU | Supabase dashboard |
| Connection count | Supabase |
| Function duration | Vercel |

## Phases

### Phase 1 — Read baseline (500 VUs, 5 min)

- `GET /` (homepage)
- `GET /api/products?limit=20`
- `GET /api/categories`
- `GET /api/products/[id]` (sample 5 product IDs)

**Pass criteria:** P95 < 2s origin, error rate < 1%, CDN cache hits on repeat product list.

### Phase 2 — Customer dashboard fan-out (50–300 VUs)

- Authenticated session cookie
- `GET /customer/dashboard` + `/api/customer/badge-counts` + limited list APIs (`limit=4`)

**Pass criteria:** P95 < 3s, no 5xx, DB connections stable.

### Phase 3 — Supplier portal (100 VUs)

- `GET /api/suppliers/{id}/stats`
- `GET /api/supplier/orders?limit=50`
- `GET /api/supplier/rfqs?limit=50`

### Phase 4 — Concurrent writes

| Scenario | VUs | Expected |
|----------|-----|----------|
| Cart add same product | 100 | Final qty = sum of deltas |
| Convert same RFQ → order | 20 | 1 success, 19 `ALREADY_CONVERTED` |
| Approve + reject same supplier | 10 | 1 winner, rest `INVALID_STATUS` |
| Duplicate RFQ submit (Idempotency-Key) | 10 | 1 create, 9 cached response |

### Phase 5 — Dependency failure

- Redis unavailable: no change (unused)
- Tigris blocked: enquiry create succeeds without attachment; image upload returns 5xx

## Sample k6 script (reads)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = __ENV.TEST_BASE_URL || 'https://staging.example.com';

export default function () {
  const res = http.get(`${BASE}/api/products?limit=20`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Sign-off

Mark **LOAD-VERIFIED** only when:

1. Phase 1–4 complete on staging
2. No duplicate orders/RFQs in DB after Phase 4
3. Supabase CPU < 80% sustained at target VUs
4. Results documented with timestamps and Vercel/Supabase screenshots

## Rollback

If load test fails: revert application deploy first; keep DB migration (indexes/RPCs are additive and correctness-safe).
