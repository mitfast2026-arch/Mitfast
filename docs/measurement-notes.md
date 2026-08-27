# MITFAST Measurement Notes (2026-08-27)

## Vercel CLI (verified)

- Account: `mitfast2026-9166`
- Project: `mitfast-b2b` (region `bom1`, Node 24.x)
- Production alias: `https://mitfast-b2b-puce.vercel.app`
- Latest production deployment inspected: `dpl_3ZCwjWouAe7uN7amWqs8bE3qmjfH` → Ready
- Commands used: `vercel ls mitfast-b2b`, `vercel inspect https://mitfast-b2b-puce.vercel.app --format json`

## Local browser verification (dev)

- `/products` → title `Products Catalog | MITFAST`, SSR catalog seed + crawlable links
- `/products/{id}` → product title + Product JSON-LD script present
- `/robots.txt` → Allow `/`, disallow portals/api/auth, sitemap link
- `/sitemap.xml` → generated

## Supabase CLI (blocked)

- Linked temp ref: `qubphaacuuwlpdrsprjl` (correct MITFAST project)
- CLI session currently authenticates as account that only sees `ictnoydmxlywwxwnugal` (forbidden)
- `supabase db push --project-ref qubphaacuuwlpdrsprjl` → **403 access-control**
- `supabase inspect db … --project-ref qubphaacuuwlpdrsprjl` → **403**

**Action required:** `supabase login` as MITFAST owner (`mitfast2026@…`), then:

```powershell
npm run db:push
supabase inspect db calls --project-ref qubphaacuuwlpdrsprjl
supabase inspect db outliers --project-ref qubphaacuuwlpdrsprjl
```

Pending migration to apply: `20260827000032_production_correctness_p0.sql`

App code includes **fallback paths** so RFQ/order/OTP/idempotency keep working until that migration is applied.

## Concurrency script (`npx tsx scripts/concurrency-test.ts`)

- PASS: admin_dashboard_metrics, cart increment race, idempotency unique claim
- SKIP until migration: OTP atomic limit, guest-merge exclusive claim, submit_rfq_from_cart_atomic

## Load test

- Status: **LOAD-TEST REQUIRED** (not executed against production)
- Plan: `docs/load-test-plan.md`
- Sample k6 script: `scripts/k6-catalog-smoke.js` (staging only)

## Redis

- Upstash env present on Vercel; **zero app usage** (by design)
- Do not add Redis page/catalog cache

## Before / after for this change set

```
CHANGE: P0 correctness + SEO SSR + tagged Next cache
BEFORE / AFTER: NEEDS LIVE VERIFICATION after migration deploy + staging k6
Redis ops: 0 → 0
```
