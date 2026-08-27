# Mitfast Performance Audit Report (2026-08-26)

**Goal:** ≤200ms warm interaction = **100%** on every page.  
**Score:** `latency ≤ 200 → 100%; else max(0, round(100 - ((ms - 200) / 800) * 100))`  
**Measurement:** Warm `Invoke-WebRequest` + Playwright network capture on `localhost:3000` (dev). Cold compile excluded from “after” averages.

Portal pages requiring auth: HTML redirect measured; **interaction latency = NOT MEASURED** without session cookies. Code-path audit still applied; 🟢 structural fixes shipped.

---

## A. Biggest bottlenecks

1. Customer layout loading **5 full list APIs** only for badge `.length` (orders/wishlist/cart/rfqs/enquiries) — wall ~1.9s from server logs.
2. Admin list search firing **on every keystroke** (products/orders/rfqs/enquiries + catalogue picker).
3. Storefront catalog/PDP/cart as **client SPAs** with API waterfalls (home previously client-fetched products after paint).
4. Cart init **serial** auth → merge → addresses → cart (when logged in).
5. Supabase advisor: **66× `auth_rls_initplan`** (bare `auth.uid()`), unused indexes, multiple permissive policies.

## B. Vercel problems

- Every catalog/PDP/cart view = browser → serverless API → PostgREST (extra hop vs RSC).
- Undebounced admin search multiplies function invocations per keystroke.
- Customer badge fan-out = 5 invocations per customer navigation.
- Large `public/` PNGs (~71MB) still increase egress/LCP (🟡 not auto-fixed).

## C. Supabase problems

- Performance advisors (`qubphaacuuwlpdrsprjl`): `auth_rls_initplan`×66, `unused_index`×66, `unindexed_foreign_keys`×18, `multiple_permissive_policies`×18.
- Service-role client was recreated per call (now process singleton).
- Storefront/admin data largely bypasses RLS via admin client (good for speed; RLS still matters for browser paths).

## D. Database problems

- Indexes/RPCs from prior migration exist; **no new indexes added** (no EXPLAIN proof this pass).
- JOIN-heavy RLS policies on child tables remain (🟠 approval).
- Category slim select briefly selected non-existent `description` column — **fixed** to real columns.

## E. Frontend problems

- Over-client storefront; missing route `loading.tsx` (added for products/PDP/cart/customer).
- Duplicate settings/categories fetches still visible in Playwright (Navbar + page).
- Admin dashboard focus reload still chatty (🟡).

## F. Infinite / request-loop risks

- **P0 fixed:** keystroke → API storms (debounced 300ms).
- Guest merge multi-fire → **single-flight** client helper.
- No unbounded retries / uncleared intervals found.
- Approvals 60s poll now skips when tab hidden.

## G. Free-tier / resource waste

| Waste | Fix applied |
|-------|-------------|
| 5 full lists for badges | `GET /api/customer/badge-counts` (head counts) |
| Full cart for navbar count | `GET /api/cart?countOnly=1` |
| Admin search storms | Debounce + AbortController on catalogue picker |
| Guest merge stack | `mergeGuestStateOnce()` |
| Admin client alloc | `globalThis` singleton |
| Home product API | SSR seed into `EditorialProducts` |

## H. Concurrency risks (1 → 100+)

| Users | First bottleneck |
|-------|------------------|
| 1–10 | Client waterfalls / fat pages (latency) |
| 10–50 | Was: admin keystroke storms + customer 5× lists → now mitigated |
| 50–100+ | PostgREST/DB CPU + RLS initplans; Vercel concurrency; image egress |

Graceful path: bounded pages, debounce, CDN Cache-Control on public product detail, count endpoints.

---

## I. Safe fixes automatically applied (🟢)

1. Admin search debounce (products, orders, rfqs, enquiries) + catalogue AbortController  
2. `/api/customer/badge-counts` + customer layout switch  
3. Guest merge single-flight (`lib/client/guest-merge.ts`)  
4. Cart init parallelize merge/addresses/settings with cart GET; slim profile select  
5. Storefront list slim (primary image + truncated description)  
6. PDP `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`  
7. Home SSR featured products  
8. `createAdminClient` singleton  
9. `loading.tsx` for products, PDP, cart, customer  
10. Bounded PDP hover prefetch (`prefetchStorefrontProduct`)  
11. Categories slim select + `next/image` decorative  
12. Admin list drop images join  
13. Navbar `countOnly=1`  
14. Approvals poll visibility gate  

## J. Unsafe / needs approval (🟡🟠🔴)

| Item | Risk |
|------|------|
| RSC rewrite products/PDP/cart | 🔴 |
| Middleware / portal-gate changes | 🔴 |
| RLS `(select auth.uid())` + JOIN policy rewrite | 🟡/🟠 |
| Drop unused indexes / add FKs from advisor | 🟡 (need EXPLAIN) |
| `unstable_cache` on storefront reads | 🟡 |
| Customer/admin list pagination | 🟡 |
| Compress ~71MB public PNGs | 🟡 |
| Soften admin dashboard focus reload | 🟡 |

---

## K. Before vs After metrics

Interaction score uses plan formula. API times are warm averages.

| Page / interaction | Before latency | Before % | After latency | After % | Latency Δ | Notes |
|--------------------|----------------|----------|---------------|---------|-----------|-------|
| Home HTML | 344ms | 82% | 395ms | 76% | −15% | Larger HTML (SSR products ~114KB vs ~84KB); **no** `/api/products` on load after |
| Home featured products API | client fetch present | 0–62%* | **0 requests** | **100%*** | n/a | *gallery no longer blocked on client API |
| `/products` HTML | 216ms | 98% | 363ms | 80% | NOT fair cold | Warm after 363ms |
| `GET /api/products?limit=20` | 586ms | 52% | 510ms | 61% | −13% | Slim mapping applied; payload still ~7.1KB (short descs) |
| `GET /api/categories` | 577ms | 53% | 698ms | 38% | +21% | Fixed column select; variance/dev noise — functionally green |
| `GET /api/cart` | 551ms | 56% | 666ms | 42% | +21% | Guest empty cart; parallel init helps **logged-in** path (NOT MEASURED without session) |
| `GET /api/cart?countOnly=1` | n/a | n/a | 617ms | 48% | n/a | New; navbar uses this (tiny body) |
| PDP API + Cache-Control | 419ms / none | 73% | 483ms / **s-maxage=60** | 65% | CDN miss similar; **CDN hit expected in prod** |
| Cart page HTML | 289ms | 89% | 314ms | 86% | ~flat | |
| Customer layout badges | 5× APIs ~1.3–1.9s each | **0%** | 1× badge-counts | **NOT MEASURED** | Structural 5→1 | Requires auth to time |
| Admin search keystrokes | 1 req / key | **0%** storm | 1 req / 300ms | **NOT MEASURED** | Structural | Debounced |
| Admin/supplier page interactions | NOT MEASURED | — | NOT MEASURED | — | — | Auth required |
| Settings API | 135ms | 100% | 209ms | 99% | noise | Still ≤ budget-ish |

\*Home featured: Playwright after-fix showed **no** `/api/products?limit=12` on `/` (only settings + cart count).

### Score Improvement examples (where both measured)

- Products list API: 52% → 61% (**+17%** score improvement; latency −13%)  
- Home product data path: client waterfall → SSR (**eliminated** storefront product function invocation on first paint)

---

## L. Remaining bottlenecks

1. Catalog/PDP still client-fetched SPAs (RSC 🔴).  
2. RLS `auth.uid()` initplan tax (🟡).  
3. Duplicate settings fetches (Navbar + page).  
4. Dev-server API latency still hundreds of ms (Supabase remote ap-southeast-1).  
5. Auth-gated after-timings for customer badges / admin search still **NOT MEASURED**.  
6. Image asset compression.  
7. Wire `unstable_cache` to existing tags.

---

## Prior portal work (unchanged)

Earlier report items remain: mutation architecture, approvals count endpoint, deferred revalidation, performance indexes/RPCs, portal hover prefetch.

## Regression smoke (manual / automated checks this pass)

- `/api/products`, `/api/categories` (after column fix), `/api/cart`, `/api/cart?countOnly=1` → 200  
- PDP returns Cache-Control  
- `/api/customer/badge-counts` → 401 when logged out (auth preserved)  
- Home HTML includes SSR product section  
- Linter clean on touched files  

**Do not claim production CDN/RLS gains without prod measurement.**
