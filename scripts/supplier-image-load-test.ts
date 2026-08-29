/**
 * Concurrent product image upload load test (localhost/staging only).
 *
 * Creates seed products via service role, then hammers POST /api/products/{id}/images
 * through authenticated supplier sessions.
 *
 * Safety:
 * - Requires LOAD_TEST_CONFIRM=1
 * - Refuses production URLs
 * - Caps concurrency
 * - Always cleans products + ephemeral suppliers
 *
 * Run (dev server + Tigris env required):
 *   $env:LOAD_TEST_CONFIRM=1; npm run test:supplier-image-load
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import sharp from 'sharp';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(process.cwd(), '.env.development.local'), override: true });

const CONFIRM = process.env.LOAD_TEST_CONFIRM === '1';
const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPPLIER_COUNT = clampInt(process.env.SUPPLIER_COUNT, 3, 2, 5);
const MAX_CONCURRENCY = clampInt(process.env.MAX_CONCURRENCY, 20, 5, 40);
const IMAGES_PER_PRODUCT = clampInt(process.env.IMAGES_PER_PRODUCT, 4, 1, 8);
const MARKER_PREFIX = '[LOADTEST:';

type Timing = { op: string; ms: number; ok: boolean; error?: string; code?: string };
type Agent = { supplierId: string; cookie: string; userId: string; productId: string };

function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(label: string, timings: Timing[]) {
  const ms = timings.map((t) => t.ms).sort((a, b) => a - b);
  const ok = timings.filter((t) => t.ok).length;
  const fail = timings.length - ok;
  return {
    label,
    count: timings.length,
    ok,
    fail,
    errRate: timings.length ? fail / timings.length : 0,
    p50: pct(ms, 50),
    p95: pct(ms, 95),
    p99: pct(ms, 99),
    max: ms[ms.length - 1] || 0,
  };
}

function printSummary(row: ReturnType<typeof summarize> & { wallSec?: number }) {
  const thr =
    row.wallSec && row.wallSec > 0 ? ` | thr=${(row.count / row.wallSec).toFixed(1)} ops/s` : '';
  console.log(
    `  ${row.label.padEnd(28)} n=${String(row.count).padStart(4)} ok=${row.ok} fail=${row.fail} err=${(row.errRate * 100).toFixed(1)}%` +
      ` | p50=${row.p50.toFixed(0)}ms p95=${row.p95.toFixed(0)}ms p99=${row.p99.toFixed(0)}ms max=${row.max.toFixed(0)}ms${thr}`
  );
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function toBase64Url(str: string) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function cookieHeaderFromSession(session: Session, projectRef: string): string {
  const COOKIE = `sb-${projectRef}-auth-token`;
  const MAX_CHUNK = 3180;
  const value = `base64-${toBase64Url(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type || 'bearer',
      user: session.user,
    })
  )}`;
  if (value.length <= MAX_CHUNK) return `${COOKIE}=${value}`;
  const parts: string[] = [];
  let i = 0;
  let offset = 0;
  while (offset < value.length) {
    parts.push(`${COOKIE}.${i}=${value.slice(offset, offset + MAX_CHUNK)}`);
    offset += MAX_CHUNK;
    i += 1;
  }
  return parts.join('; ');
}

function assertSafeBaseUrl(url: string) {
  if (/vercel\.app/i.test(url) || (/mitfast\.com/i.test(url) && !/staging/i.test(url))) {
    throw new Error(`Refusing image load test against production-like URL: ${url}`);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url) && !/staging/i.test(url)) {
    throw new Error(`TEST_BASE_URL must be localhost or staging (got ${url})`);
  }
}

/** Small valid JPEG generated with Sharp (realistic upload payload). */
async function tinyJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function timed(op: string, fn: () => Promise<void>): Promise<Timing> {
  const start = performance.now();
  try {
    await fn();
    return { op, ms: performance.now() - start, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const codeMatch = message.match(/\[([A-Z0-9_]+)\]/);
    return { op, ms: performance.now() - start, ok: false, error: message, code: codeMatch?.[1] };
  }
}

async function uploadImage(
  cookie: string,
  productId: string,
  fileName: string,
  isPrimary: boolean,
  jpeg: Buffer
) {
  const fd = new FormData();
  const blob = new Blob([jpeg], { type: 'image/jpeg' });
  fd.append('file', blob, fileName);
  fd.append('isPrimary', isPrimary ? 'true' : 'false');
  const uploadId = randomUUID();
  fd.append('uploadId', uploadId);

  const res = await fetch(`${BASE}/api/products/${productId}/images`, {
    method: 'POST',
    headers: { Cookie: cookie, 'X-Upload-Id': uploadId },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(`[${json.error?.code || `HTTP_${res.status}`}] ${json.error?.message || res.statusText}`);
  }
}

async function main() {
  if (!CONFIRM) {
    console.error('Refusing to run without LOAD_TEST_CONFIRM=1');
    process.exit(1);
  }
  assertSafeBaseUrl(BASE);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error('Missing Supabase env');

  try {
    const health = await fetch(`${BASE}/api/settings`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (e) {
    throw new Error(`Dev server not reachable at ${BASE}: ${e instanceof Error ? e.message : e}`);
  }

  const projectRef = new URL(url).hostname.split('.')[0];
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID().slice(0, 8);
  const agents: Agent[] = [];
  const password = `LoadImg!${runId}Aa1`;

  console.log(`\n=== Supplier image upload load test ===`);
  console.log(
    `  base=${BASE} runId=${runId} suppliers=${SUPPLIER_COUNT} images/product=${IMAGES_PER_PRODUCT} concurrency=${MAX_CONCURRENCY}`
  );

  try {
    const { data: cat } = await admin.from('categories').select('id').limit(1).maybeSingle();
    if (!cat?.id) throw new Error('No categories');

    for (let i = 0; i < SUPPLIER_COUNT; i++) {
      const email = `loadtest.img.${runId}.${i}@mitfast.test`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'supplier', full_name: `Img Load ${i}` },
      });
      if (createErr || !created.user) throw new Error(createErr?.message || 'createUser failed');

      await admin.from('profiles').upsert(
        {
          user_id: created.user.id,
          role: 'supplier',
          full_name: `Img Load ${i}`,
          email,
          phone: '',
        },
        { onConflict: 'user_id' }
      );

      const { data: supplier, error: supErr } = await admin
        .from('suppliers')
        .insert({
          user_id: created.user.id,
          company_name: `${MARKER_PREFIX}${runId}] ImgSupplier ${i}`,
          status: 'active',
          email,
          contact_person: `Img Contact ${i}`,
          phone: '0000000000',
          country: 'India',
        } as any)
        .select('id')
        .single();
      if (supErr || !supplier) throw new Error(supErr?.message || 'supplier insert failed');

      const { data: product, error: prodErr } = await admin
        .from('products')
        .insert({
          supplier_id: supplier.id,
          category_id: cat.id,
          name: `${MARKER_PREFIX}${runId}] ImgProduct ${i}`,
          description: 'image load test',
          sku: `IMG-${runId}-${i}`,
          stock_quantity: 0,
          moq: 100,
          suggested_moq: 100,
          supplier_price: 10,
          profit_type: 'percentage',
          profit_value: 15,
          selling_price: 11.5,
          discount: 0,
          gst_rate: 18,
          gst_included: false,
          approval_status: 'pending',
          publication_status: 'unpublished',
          archive_status: 'active',
          is_draft: false,
        })
        .select('id')
        .single();
      if (prodErr || !product) throw new Error(prodErr?.message || 'product insert failed');

      await admin.from('product_approval_requests').insert({
        product_id: product.id,
        request_type: 'new_product',
        proposed_data: { name: product.id },
        status: 'pending',
      });

      const client = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signed, error: signErr } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr || !signed.session) throw new Error(signErr?.message || 'signIn failed');

      agents.push({
        supplierId: supplier.id,
        cookie: cookieHeaderFromSession(signed.session, projectRef),
        userId: created.user.id,
        productId: product.id,
      });
    }

    const sampleJpeg = await tinyJpeg();

    // Concurrent uploads within max images
    const jobs: { agent: Agent; idx: number }[] = [];
    for (const agent of agents) {
      for (let i = 0; i < IMAGES_PER_PRODUCT; i++) {
        jobs.push({ agent, idx: i });
      }
    }

    const wall = performance.now();
    const timings = await mapPool(jobs, MAX_CONCURRENCY, async ({ agent, idx }) => {
      return timed('upload', () =>
        uploadImage(agent.cookie, agent.productId, `lt-${idx}.jpg`, idx === 0, sampleJpeg)
      );
    });
    printSummary({
      ...summarize(`upload@${MAX_CONCURRENCY}`, timings),
      wallSec: (performance.now() - wall) / 1000,
    });
    const failures = timings.filter((t) => !t.ok);
    if (failures.length) {
      console.log('  sample failures:');
      for (const f of failures.slice(0, 5)) {
        console.log(`    - ${f.error}`);
      }
    }

    // Over-limit probe: try one more upload per product (expect MAX_IMAGES for some)
    const overJobs = agents.map((agent) => ({ agent }));
    const overTimings = await mapPool(overJobs, Math.min(MAX_CONCURRENCY, overJobs.length), async ({ agent }) => {
      return timed('over-limit', async () => {
        try {
          await uploadImage(agent.cookie, agent.productId, 'over.jpg', false, sampleJpeg);
          // If max is > IMAGES_PER_PRODUCT this may succeed — that's ok
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('MAX_IMAGES') || msg.includes('Maximum')) return;
          throw err;
        }
      });
    });
    printSummary(summarize('over-limit-probe', overTimings));

    // Count images vs orphans (pending://reserve should be 0)
    for (const agent of agents) {
      const { data: imgs, count } = await admin
        .from('product_images')
        .select('id, image_url, storage_path', { count: 'exact' })
        .eq('product_id', agent.productId);
      const pending = (imgs || []).filter((i) => (i.image_url || '').startsWith('pending://'));
      console.log(
        `  product ${agent.productId.slice(0, 8)}… images=${count ?? imgs?.length ?? 0} pending_placeholders=${pending.length}`
      );
      if (pending.length > 0) {
        throw new Error(`Found ${pending.length} orphan placeholder image rows`);
      }
    }

    const errRate = timings.filter((t) => !t.ok).length / timings.length;
    const p95 = summarize('x', timings).p95;
    if (errRate > 0.15) throw new Error(`Upload error rate too high: ${(errRate * 100).toFixed(1)}%`);
    console.log(`\nPASS — image load test (p95=${p95.toFixed(0)}ms err=${(errRate * 100).toFixed(1)}%)`);
  } finally {
    const marker = `${MARKER_PREFIX}${runId}]`;
    const { data: products } = await admin.from('products').select('id').ilike('name', `${marker}%`);
    const ids = (products || []).map((p) => p.id);
    if (ids.length) {
      const { data: imgs } = await admin
        .from('product_images')
        .select('storage_path')
        .in('product_id', ids);
      // Best-effort: delete DB rows (Tigris objects cleaned by product delete path if used)
      await admin.from('product_images').delete().in('product_id', ids);
      await admin.from('product_approval_requests').delete().in('product_id', ids);
      await admin.from('products').delete().in('id', ids);
      console.log(`  cleanup: products=${ids.length} image_paths=${imgs?.length ?? 0}`);
    }
    for (const a of agents) {
      await admin.from('suppliers').delete().eq('id', a.supplierId);
      await admin.from('profiles').delete().eq('user_id', a.userId);
      await admin.auth.admin.deleteUser(a.userId);
    }
    console.log(`  cleanup: agents=${agents.length}`);
  }
}

main().catch((err) => {
  console.error('\nFAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
