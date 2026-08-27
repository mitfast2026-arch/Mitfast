# MITFAST Measurement Notes (updated 2026-08-27)

## Supabase CLI / plugin

- Linked project: `qubphaacuuwlpdrsprjl` (ACTIVE_HEALTHY, region `ap-southeast-1`)
- Cursor Supabase plugin: authorized as **mitfast2026@gmail.com's Org** (correct MITFAST project)
- Applied through: `20260827000052_fix_trigger_actor_checks.sql`
  - `050` profiles.role freeze
  - `051` soft product INSERT lock
  - `052` fix `SECURITY DEFINER` actor checks (`auth.role()`)
- Hardening smoke: **PASS** (`npm run test:hardening-smoke`)
- Triggers verified live via plugin SQL: `trg_profiles_freeze_role`, `trg_products_soft_lock_client_insert`, `trg_products_block_privileged_client_update` (all use `auth.role()`)

## Ultra-safe hardening (Tier 0–2) — shipped + applied

- Tier 0: OTP/auth generic errors, search sanitize, footer admin link removed, QA sessions gitignored/deleted, JSON-LD escape, `GET /api/health`
- Tier 1–2: migrations 050–052 + smoke green
- Tier 3 (DROP insert policies, REVOKE supplier_price, middleware fail-closed, EMAIL_FROM hard fail): **deferred**

## Vercel

- Project: `mitfast-b2b` (region `bom1`)
- Production must fail-closed (`DATABASE_MISCONFIGURED` / 503) if atomic RPCs missing — unsafe multi-step fallbacks disabled when `VERCEL_ENV=production`

## Load test

- Status: **CODE-READY** for staging k6 (Phases 1–4 in `docs/load-test-plan.md`)
- Not yet **LOAD-VERIFIED** — do not claim ≥85 production score until staging evidence exists
- Local `.env.local` currently has empty Supabase URL/service-role placeholders; use `.env.development.local` or restore real keys before:
  ```powershell
  npm run test:concurrency
  k6 run -e TEST_BASE_URL=https://YOUR-STAGING.vercel.app scripts/k6-catalog-smoke.js
  ```

## Staging load verification checklist (required for ≥85)

1. Deploy remediations to a **staging** Vercel project (not production).
2. Confirm staging DB has migrations through `20260827000052`.
3. Run Phase 1–4 from `docs/load-test-plan.md`.
4. Capture: P95, error rate, Supabase CPU/connections, Vercel 5xx.
5. Only then flip status to **LOAD-VERIFIED** and raise audit overall to ≥85.

## Redis

- Upstash env may exist; **zero app usage** for business state (by design)

## Concurrency / security scripts

```powershell
npm run test:concurrency
npm run test:rls-supplier
npm run test:hardening-smoke
```
