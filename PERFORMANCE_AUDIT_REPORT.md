# Mitfast Performance Audit Report

## CRITICAL BOTTLENECKS (found)

1. **Post-mutation full-list refetch with no response validation** — Admin product publish/unpublish/approve/archive called `loadProducts()` (50-row heavy join) after every click, with no pending state and no check of `res.ok` / `json.success`. This was the primary cause of “stuck buttons” and “refresh fixes it.”

2. **Admin layout fetched entire Approval Center on every navigation** — `useEffect(..., [pathname])` loaded `/api/admin/approvals` (3 unbounded joined queries) on every sidebar click just for a badge count.

3. **Triple auth + heavy list payloads + synchronous cache busting** — Middleware + `getServerSession()` per API call; admin product list selected images/specs for every row; `revalidatePath` ran before mutation JSON responses.

## FIXES IMPLEMENTED

1. **Shared mutation architecture** — [`lib/client/api-client.ts`](lib/client/api-client.ts) + [`lib/client/use-mutation.ts`](lib/client/use-mutation.ts): typed success/error, per-entity pending keys, in-flight locks, optimistic updates where safe.

2. **Admin products** — Per-row pending spinners, optimistic publish/unpublish/archive, targeted `patchProduct()` instead of full refetch; edit modal loads detail via `GET /api/products/[id]?mode=admin`.

3. **Admin layout** — [`ApprovalsCountProvider`](components/portal/ApprovalsCountContext.tsx) + `GET /api/admin/approvals/count` (3 head counts); mount + 60s poll + event after approvals; removed pathname-triggered full fetch.

4. **Supplier layout** — [`SupplierProvider`](components/portal/SupplierContext.tsx): auth once on mount, no full-screen gate on navigation.

5. **Auth deduplication** — `getServerSession` wrapped in `React.cache()`; removed double `requireSupplier()` on `POST /api/products`.

6. **Deferred revalidation** — All product mutation routes use `deferRevalidateProduct()` (microtask) instead of blocking on `revalidatePath`.

7. **Portal pages migrated to mutation utility** — Admin: products, approvals, dashboard, rfqs, orders, suppliers, enquiries. Supplier: products (paginated API), rfqs.

## DATABASE OPTIMIZATIONS

1. **Migration** [`supabase/migrations/20260822120000_performance_indexes.sql`](supabase/migrations/20260822120000_performance_indexes.sql):
   - `enquiries(product_id)`
   - `orders(rfq_id)`, `orders(enquiry_id)`
   - `product_approval_requests(status, request_type, created_at DESC)`
   - `products(supplier_id, archive_status)`

2. **RPC `supplier_product_demand_stats`** — Replaces N+1 per-product count loops in `getSupplierProductStats` (with batched legacy fallback).

3. **RPC `category_product_counts`** — Replaces full product scan for category enrichment.

4. **Paginated supplier enquiries** — `getEnquiriesForSupplier` now supports page/limit + count.

5. **Paginated approval center** — `getApprovalCenterItems` limited to 25 per tab, parallel queries.

## CACHE/REDIS OPTIMIZATIONS

1. **Tag-based storefront invalidation** — `revalidateTag('products')`, `revalidateTag('categories')`, `revalidateTag('product:{id}')` plus path revalidation.

2. **Deferred revalidation** — `deferRevalidateProduct()` returns API response before cache bust (Next.js 14 compatible microtask).

3. **Request-scoped auth cache** — `React.cache()` on `getServerSession`.

4. **No Redis required** — Portal data is dynamic API; storefront uses path/tag revalidation only.

## ROUTE/PAGE OPTIMIZATIONS

1. **Slim admin product list** — `getProductsForAdmin` list columns only; detail via `getProductForAdminDetail`.

2. **Supplier products API** — `GET /api/supplier/products?page=&limit=` replaces browser Supabase fetch-all.

3. **Supplier layout** — Shell renders immediately after first auth; children no longer blocked on every route change.

4. **Explicit Refresh buttons** — Full reload only on user-initiated refresh, not after every mutation.

## SECURITY ISSUES FOUND

1. **Double `getServerSession` on product POST** — Redundant (not a bypass); fixed.

2. **Supplier browser Supabase reads** — Products page moved to authenticated API route; RLS unchanged, server enforces `requireSupplier`.

3. **No RLS weakening** — All performance changes preserve server-side auth and admin client patterns.

## SCALABILITY RISKS REMAINING

1. **Full portal RSC migration** — Portals remain client SPAs; follow-up: server layout shells + streamed page data.

2. **Admin dashboard activity feed** — Still queries 5 tables (limited to 20 each); monitor at high volume.

3. **Customer/supplier list pagination** — Customer orders/RFQs pages still fetch unbounded lists; add pagination in a follow-up.

4. **`unstable_cache` on storefront** — Tags are invalidated but storefront reads not yet wrapped in `unstable_cache` (requires Next 15 `after()` or cache wrapper for full benefit).

5. **Apply migration** — Run `supabase db push` or apply `20260822120000_performance_indexes.sql` on production for RPC/index benefits.

## Verification

- `npm run build` — passes (Next.js 14.2.35)
- Manual test checklist: publish/unpublish, approvals, RFQ negotiate/accept, order status, supplier product list pagination
