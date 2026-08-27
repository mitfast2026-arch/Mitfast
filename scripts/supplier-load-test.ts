/**
 * Safe multi-supplier product CRUD load test (free-tier friendly).
 *
 * Models ~1000 concurrent supplier usage WITHOUT opening 1000 connections:
 * - Ladder: measure latency/errors at 5 / 10 / 20 / 40 concurrent writers
 * - Burst: process TARGET_OPS (default 1000) with a capped worker pool
 * - Mix: create + update-request + delete across multiple suppliers
 *
 * Safety:
 * - Caps concurrency (default 40, hard max 50)
 * - Never targets Vercel HTTP by default (Supabase PostgREST only)
 * - Tags all rows with [LOADTEST:<runId>] and always cleans up
 * - Aborts if error rate exceeds 15% mid-run
 * - Requires LOAD_TEST_CONFIRM=1
 *
 * Run:
 *   LOAD_TEST_CONFIRM=1 npx tsx scripts/supplier-load-test.ts
 *
 * Optional env:
 *   SUPPLIER_COUNT=5
 *   MAX_CONCURRENCY=25
 *   TARGET_OPS=1000
 *   PRODUCTS_PER_SUPPLIER=8
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Next.js priority (dev): .env.development.local > .env.local > .env
// Load low→high with override so non-empty local secrets win over empty placeholders.
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(process.cwd(), '.env.development.local'), override: true });

const CONFIRM = process.env.LOAD_TEST_CONFIRM === '1';
const SUPPLIER_COUNT = clampInt(process.env.SUPPLIER_COUNT, 3, 2, 8);
const MAX_CONCURRENCY = clampInt(process.env.MAX_CONCURRENCY, 25, 5, 50);
const TARGET_OPS = clampInt(process.env.TARGET_OPS, 1000, 50, 2000);
const PRODUCTS_PER_SUPPLIER = clampInt(process.env.PRODUCTS_PER_SUPPLIER, 6, 2, 12);
const LADDER = [5, 10, 20, Math.min(40, MAX_CONCURRENCY)].filter(
  (v, i, arr) => v <= MAX_CONCURRENCY && arr.indexOf(v) === i
);

const MARKER_PREFIX = '[LOADTEST:';

type Timing = { op: string; ms: number; ok: boolean; error?: string };
type SupplierRow = { id: string; company_name: string | null };

function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pct(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(label: string, timings: Timing[]) {
  const ms = timings.map((t) => t.ms).sort((a, b) => a - b);
  const ok = timings.filter((t) => t.ok).length;
  const fail = timings.length - ok;
  const errRate = timings.length ? fail / timings.length : 0;
  const totalMs = timings.reduce((s, t) => s + t.ms, 0);
  const rps = totalMs > 0 ? (timings.length / (Math.max(...timings.map((t) => t.ms)) / 1000 || 1)) : 0;

  // Approximate sustained RPS from wall time of the batch (caller passes wall via meta)
  return {
    label,
    count: timings.length,
    ok,
    fail,
    errRate,
    p50: pct(ms, 50),
    p95: pct(ms, 95),
    p99: pct(ms, 99),
    max: ms[ms.length - 1] || 0,
    approxBatchRps: Number(rps.toFixed(2)),
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;

  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

async function timed<T>(op: string, fn: () => Promise<T>): Promise<Timing & { value?: T }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { op, ms: performance.now() - start, ok: true, value };
  } catch (err) {
    return {
      op,
      ms: performance.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  if (/vercel\.app/i.test(process.env.TEST_BASE_URL || '')) {
    throw new Error('Refusing HTTP base URL on Vercel — this script uses Supabase only (free-tier safe).');
  }
  return { url, key };
}

async function pickSuppliers(admin: SupabaseClient, count: number): Promise<SupplierRow[]> {
  const { data, error } = await admin
    .from('suppliers')
    .select('id, company_name')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(count);

  if (error) throw error;
  if (!data || data.length < 2) {
    throw new Error(
      `Need ≥2 active suppliers for multi-supplier load test (found ${data?.length ?? 0}). Approve suppliers first.`
    );
  }
  return data;
}

async function pickCategoryId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from('categories').select('id').limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('No categories found — create at least one category first.');
  return data.id;
}

function productPayload(runId: string, supplierIdx: number, n: number, categoryId: string) {
  return {
    name: `${MARKER_PREFIX}${runId}] S${supplierIdx}-P${n}`,
    description: `Safe free-tier load test product (${runId})`,
    category_id: categoryId,
    sku: `LT-${runId.slice(0, 8)}-${supplierIdx}-${n}`,
    stock_quantity: 0,
    moq: 100,
    suggested_moq: 100,
    supplier_price: 10 + (n % 7),
    profit_type: 'percentage' as const,
    profit_value: 15,
    selling_price: 11.5 + (n % 7),
    discount: 0,
    gst_rate: 18,
    gst_included: false,
    approval_status: 'pending' as const,
    publication_status: 'unpublished' as const,
    archive_status: 'active' as const,
    is_draft: false,
  };
}

async function createProduct(
  admin: SupabaseClient,
  supplierId: string,
  categoryId: string,
  runId: string,
  supplierIdx: number,
  n: number
) {
  const row = {
    ...productPayload(runId, supplierIdx, n, categoryId),
    supplier_id: supplierId,
  };
  const { data, error } = await admin.from('products').insert(row).select('id').single();
  if (error || !data) throw new Error(error?.message || 'create failed');

  await admin.from('product_approval_requests').insert({
    product_id: data.id,
    request_type: 'new_product',
    proposed_data: {
      name: row.name,
      description: row.description,
      sku: row.sku,
      suggested_moq: row.suggested_moq,
      supplier_price: row.supplier_price,
      category_id: categoryId,
    },
    status: 'pending',
  });

  return data.id as string;
}

async function editProduct(admin: SupabaseClient, productId: string, supplierId: string, categoryId: string, runId: string) {
  const { data: existing, error: fetchError } = await admin
    .from('products')
    .select('id, supplier_id, updated_at')
    .eq('id', productId)
    .eq('supplier_id', supplierId)
    .single();
  if (fetchError || !existing) throw new Error(fetchError?.message || 'product not owned');

  await admin
    .from('product_approval_requests')
    .update({
      status: 'rejected',
      rejection_reason: 'Superseded by load test',
      reviewed_at: new Date().toISOString(),
    })
    .eq('product_id', productId)
    .in('status', ['pending', 'update_pending']);

  await admin
    .from('products')
    .update({
      approval_status: 'update_pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);

  const { error: reqError } = await admin.from('product_approval_requests').insert({
    product_id: productId,
    request_type: 'update',
    proposed_data: {
      name: `${MARKER_PREFIX}${runId}] edited`,
      category_id: categoryId,
      description: 'load-test edit',
      suggested_moq: 150,
      supplier_price: 12.5,
    },
    status: 'update_pending',
    base_product_updated_at: existing.updated_at,
  } as Record<string, unknown>);

  if (reqError) throw new Error(reqError.message);
}

async function deleteProduct(admin: SupabaseClient, productId: string) {
  // Mirrors admin hard-delete path (suppliers cannot DELETE; products stay unpublished in this test)
  const { data, error } = await admin
    .from('products')
    .select('id, publication_status')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  if (data.publication_status === 'published') {
    throw new Error('refusing to delete published product');
  }
  const { error: delError } = await admin.from('products').delete().eq('id', productId);
  if (delError) throw new Error(delError.message);
}

async function cleanup(admin: SupabaseClient, runId: string) {
  const marker = `${MARKER_PREFIX}${runId}]`;
  const { data: products } = await admin
    .from('products')
    .select('id')
    .ilike('name', `${marker}%`);

  const ids = (products || []).map((p) => p.id);
  if (ids.length === 0) {
    console.log('  cleanup: nothing to remove');
    return;
  }

  await admin.from('product_approval_requests').delete().in('product_id', ids);
  await admin.from('product_specifications').delete().in('product_id', ids);
  await admin.from('product_images').delete().in('product_id', ids);
  const { error } = await admin.from('products').delete().in('id', ids);
  if (error) throw error;
  console.log(`  cleanup: removed ${ids.length} load-test products`);
}

function printSummary(row: ReturnType<typeof summarize> & { wallSec?: number; throughput?: number }) {
  const errPct = (row.errRate * 100).toFixed(1);
  const thr = row.throughput != null ? ` | thr=${row.throughput.toFixed(1)} ops/s` : '';
  console.log(
    `  ${row.label.padEnd(28)} n=${String(row.count).padStart(4)} ok=${row.ok} fail=${row.fail} err=${errPct}%` +
      ` | p50=${row.p50.toFixed(0)}ms p95=${row.p95.toFixed(0)}ms p99=${row.p99.toFixed(0)}ms max=${row.max.toFixed(0)}ms${thr}`
  );
}

async function runLadder(
  admin: SupabaseClient,
  suppliers: SupplierRow[],
  categoryId: string,
  runId: string
) {
  console.log('\n=== Phase A: concurrency ladder (create) ===');
  const createdIds: { id: string; supplierId: string }[] = [];

  for (const concurrency of LADDER) {
    const jobs = Array.from({ length: concurrency }, (_, i) => i);
    const wallStart = performance.now();
    const timings = await mapPool(jobs, concurrency, async (i) => {
      const supplier = suppliers[i % suppliers.length];
      const result = await timed('create', async () => {
        const id = await createProduct(admin, supplier.id, categoryId, runId, i % suppliers.length, Date.now() + i);
        return id;
      });
      if (result.ok && result.value) {
        createdIds.push({ id: result.value, supplierId: supplier.id });
      }
      return result as Timing;
    });
    const wallSec = (performance.now() - wallStart) / 1000;
    const summary = { ...summarize(`create@${concurrency}`, timings), wallSec, throughput: timings.length / wallSec };
    printSummary(summary);

    if (summary.errRate > 0.15) {
      throw new Error(`Aborting: error rate ${(summary.errRate * 100).toFixed(1)}% at concurrency ${concurrency}`);
    }

    // Brief cool-down for free tier
    await new Promise((r) => setTimeout(r, 750));
  }

  return createdIds;
}

async function runEditDelete(
  admin: SupabaseClient,
  categoryId: string,
  runId: string,
  products: { id: string; supplierId: string }[]
) {
  console.log('\n=== Phase B: concurrent edit (update-request) + delete ===');
  if (products.length < 4) {
    console.log('  SKIP — not enough products from Phase A');
    return;
  }

  const half = Math.floor(products.length / 2);
  const toEdit = products.slice(0, half);
  const toDelete = products.slice(half);
  const concurrency = Math.min(MAX_CONCURRENCY, products.length);

  const wallStart = performance.now();
  const editTimings = await mapPool(toEdit, concurrency, async (p) => {
    return timed('edit', () => editProduct(admin, p.id, p.supplierId, categoryId, runId));
  });
  const editWall = (performance.now() - wallStart) / 1000;
  printSummary({
    ...summarize(`edit@${concurrency}`, editTimings),
    wallSec: editWall,
    throughput: editTimings.length / editWall,
  });

  await new Promise((r) => setTimeout(r, 500));

  const delStart = performance.now();
  const deleteTimings = await mapPool(toDelete, concurrency, async (p) => {
    return timed('delete', () => deleteProduct(admin, p.id));
  });
  const delWall = (performance.now() - delStart) / 1000;
  printSummary({
    ...summarize(`delete@${concurrency}`, deleteTimings),
    wallSec: delWall,
    throughput: deleteTimings.length / delWall,
  });

  if (editTimings.filter((t) => !t.ok).length / editTimings.length > 0.15) {
    throw new Error('Aborting: edit error rate too high');
  }
  if (deleteTimings.filter((t) => !t.ok).length / deleteTimings.length > 0.15) {
    throw new Error('Aborting: delete error rate too high');
  }
}

async function runMixedBurst(
  admin: SupabaseClient,
  suppliers: SupplierRow[],
  categoryId: string,
  runId: string
) {
  console.log('\n=== Phase C: mixed burst (create/edit/delete) toward 1000-ops capacity ===');
  console.log(
    `  workers=${MAX_CONCURRENCY} suppliers=${suppliers.length} targetOps=${TARGET_OPS} (NOT ${TARGET_OPS} open connections)`
  );

  // Dedicated edit pool (never deleted during burst — avoids cross-worker races)
  const seedCount = Math.min(PRODUCTS_PER_SUPPLIER * suppliers.length, 40);
  const editPool: { id: string; supplierId: string }[] = [];
  for (let i = 0; i < seedCount; i++) {
    const supplier = suppliers[i % suppliers.length];
    const id = await createProduct(admin, supplier.id, categoryId, runId, i % suppliers.length, 10_000 + i);
    editPool.push({ id, supplierId: supplier.id });
  }

  type Job =
    | { kind: 'create'; supplierIdx: number; n: number }
    | { kind: 'edit'; productIdx: number }
    | { kind: 'delete'; supplierIdx: number; n: number };

  const jobs: Job[] = [];
  for (let i = 0; i < TARGET_OPS; i++) {
    const roll = i % 10;
    if (roll < 5) {
      jobs.push({ kind: 'create', supplierIdx: i % suppliers.length, n: 20_000 + i });
    } else if (roll < 8) {
      jobs.push({ kind: 'edit', productIdx: i % editPool.length });
    } else {
      // Self-contained: create unpublished then delete (admin delete path)
      jobs.push({ kind: 'delete', supplierIdx: i % suppliers.length, n: 40_000 + i });
    }
  }

  let progressAt = 0;
  const wallStart = performance.now();
  const timings = await mapPool(
    jobs,
    MAX_CONCURRENCY,
    async (job) => {
      if (job.kind === 'create') {
        const supplier = suppliers[job.supplierIdx];
        return timed('create', () =>
          createProduct(admin, supplier.id, categoryId, runId, job.supplierIdx, job.n)
        );
      }
      if (job.kind === 'edit') {
        const p = editPool[job.productIdx];
        return timed('edit', () => editProduct(admin, p.id, p.supplierId, categoryId, runId));
      }
      const supplier = suppliers[job.supplierIdx];
      return timed('delete', async () => {
        const id = await createProduct(
          admin,
          supplier.id,
          categoryId,
          runId,
          job.supplierIdx,
          job.n
        );
        await deleteProduct(admin, id);
      });
    },
    (done, total) => {
      if (done - progressAt >= 100 || done === total) {
        progressAt = done;
        process.stdout.write(`\r  progress ${done}/${total}`);
      }
    }
  );
  process.stdout.write('\n');

  const wallSec = (performance.now() - wallStart) / 1000;
  const overall = {
    ...summarize(`mixed@${MAX_CONCURRENCY}`, timings),
    wallSec,
    throughput: timings.length / wallSec,
  };
  printSummary(overall);

  const byOp = ['create', 'edit', 'delete'] as const;
  for (const op of byOp) {
    const subset = timings.filter((t) => t.op === op);
    if (subset.length) {
      printSummary({
        ...summarize(`  └ ${op}`, subset),
        throughput: subset.length / wallSec,
      });
    }
  }

  if (overall.errRate > 0.15) {
    throw new Error(`Mixed burst error rate ${(overall.errRate * 100).toFixed(1)}% — free tier saturated`);
  }

  // Capacity projection for "1000 concurrent users" with think-time
  const thinkSec = 5; // typical supplier form think time
  const sustainableUsers = Math.floor(overall.throughput * thinkSec);
  console.log('\n=== Capacity projection (heuristic) ===');
  console.log(`  Measured throughput: ${overall.throughput.toFixed(1)} CRUD ops/s at ${MAX_CONCURRENCY} workers`);
  console.log(`  Rough concurrent suppliers (≈${thinkSec}s think-time): ~${sustainableUsers}`);
  console.log(
    sustainableUsers >= 1000
      ? '  Verdict: YES — path looks viable for ~1000 concurrent with think-time (still verify on staging).'
      : `  Verdict: NOT YET — free-tier headroom ≈ ${sustainableUsers} concurrent; need staging/paid tier or queueing for 1000.`
  );
  console.log('  Note: suppliers do not hard-delete; delete path tested = admin unpublished delete.');

  return overall;
}

async function main() {
  console.log('MITFAST supplier load test (free-tier safe)');
  console.log(`  suppliers=${SUPPLIER_COUNT} maxConcurrency=${MAX_CONCURRENCY} targetOps=${TARGET_OPS}`);
  console.log(`  ladder=[${LADDER.join(', ')}]`);

  if (!CONFIRM) {
    console.error('\nRefusing to run without LOAD_TEST_CONFIRM=1');
    console.error('Example: $env:LOAD_TEST_CONFIRM=1; npx tsx scripts/supplier-load-test.ts');
    process.exit(2);
  }

  const { url, key } = requireEnv();
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runId = `${Date.now().toString(36)}`;
  console.log(`  runId=${runId}`);
  console.log(`  supabase=${url.replace(/^https?:\/\//, '').split('.')[0]}…`);

  try {
    const suppliers = await pickSuppliers(admin, SUPPLIER_COUNT);
    const categoryId = await pickCategoryId(admin);
    console.log(`  using ${suppliers.length} active suppliers, category=${categoryId.slice(0, 8)}…`);

    const created = await runLadder(admin, suppliers, categoryId, runId);
    await runEditDelete(admin, categoryId, runId, created);
    await runMixedBurst(admin, suppliers, categoryId, runId);

    console.log('\n=== Cleanup ===');
    await cleanup(admin, runId);
    console.log('\nDone.');
  } catch (err) {
    console.error('\nFAILED:', err instanceof Error ? err.message : err);
    console.log('\n=== Emergency cleanup ===');
    try {
      await cleanup(admin, runId);
    } catch (cleanupErr) {
      console.error('Cleanup also failed:', cleanupErr instanceof Error ? cleanupErr.message : cleanupErr);
    }
    process.exit(1);
  }
}

main();
