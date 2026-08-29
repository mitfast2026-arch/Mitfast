/**
 * HTTP-layer supplier product write load test (localhost/staging only).
 *
 * Exercises POST /api/products, update-request, idempotency, and reorder
 * through the Next.js API (not raw PostgREST).
 *
 * Safety:
 * - Requires LOAD_TEST_CONFIRM=1
 * - Refuses production / vercel.app URLs
 * - Caps concurrency (default 25, hard max 40)
 * - Tags [LOADTEST:<runId>] and always cleans up
 * - Aborts if error rate > 15%
 *
 * Run (dev server must be up):
 *   $env:LOAD_TEST_CONFIRM=1; npm run test:supplier-http-load
 *
 * Optional:
 *   TEST_BASE_URL=http://localhost:3000
 *   MAX_CONCURRENCY=25
 *   TARGET_OPS=200
 *   SUPPLIER_COUNT=3
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(process.cwd(), '.env.development.local'), override: true });

const CONFIRM = process.env.LOAD_TEST_CONFIRM === '1';
const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPPLIER_COUNT = clampInt(process.env.SUPPLIER_COUNT, 3, 2, 5);
const MAX_CONCURRENCY = clampInt(process.env.MAX_CONCURRENCY, 25, 5, 40);
const TARGET_OPS = clampInt(process.env.TARGET_OPS, 200, 20, 1000);
const MARKER_PREFIX = '[LOADTEST:';

type Timing = { op: string; ms: number; ok: boolean; error?: string; code?: string };
type Agent = { supplierId: string; cookie: string; email: string; userId: string };

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

async function timed(op: string, fn: () => Promise<{ code?: string } | void>): Promise<Timing> {
  const start = performance.now();
  try {
    const meta = await fn();
    return { op, ms: performance.now() - start, ok: true, code: meta?.code };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const codeMatch = message.match(/\[([A-Z0-9_]+)\]/);
    return {
      op,
      ms: performance.now() - start,
      ok: false,
      error: message,
      code: codeMatch?.[1],
    };
  }
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
  if (/vercel\.app/i.test(url) || /mitfast\.com/i.test(url)) {
    throw new Error(`Refusing HTTP load test against production-like URL: ${url}`);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url) && !/staging/i.test(url)) {
    throw new Error(`TEST_BASE_URL must be localhost or staging (got ${url})`);
  }
}

async function apiJson(
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const code = json.error?.code || `HTTP_${res.status}`;
    throw new Error(`[${code}] ${json.error?.message || res.statusText}`);
  }
  return json;
}

async function pickCategoryId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from('categories').select('id').limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('No categories found');
  return data.id;
}

async function createEphemeralAgents(
  admin: SupabaseClient,
  url: string,
  anon: string,
  projectRef: string,
  runId: string,
  count: number
): Promise<Agent[]> {
  const agents: Agent[] = [];
  const password = `LoadTest!${runId.slice(0, 8)}Aa1`;

  for (let i = 0; i < count; i++) {
    const email = `loadtest.supplier.${runId}.${i}@mitfast.test`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: `LoadTest Supplier ${i}` },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || 'Failed to create auth user');
    }

    await admin.from('profiles').upsert(
      {
        user_id: created.user.id,
        role: 'supplier',
        full_name: `LoadTest Supplier ${i}`,
        email,
        phone: '',
      },
      { onConflict: 'user_id' }
    );

    const { data: supplier, error: supErr } = await admin
      .from('suppliers')
      .insert({
        user_id: created.user.id,
        company_name: `${MARKER_PREFIX}${runId}] Supplier ${i}`,
        status: 'active',
        email,
        contact_person: `LoadTest Contact ${i}`,
        phone: '0000000000',
        country: 'India',
      } as any)
      .select('id')
      .single();

    if (supErr || !supplier) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(supErr?.message || 'Failed to create supplier');
    }

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signErr } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signed.session) {
      throw new Error(signErr?.message || 'signIn failed');
    }

    agents.push({
      supplierId: supplier.id,
      cookie: cookieHeaderFromSession(signed.session, projectRef),
      email,
      userId: created.user.id,
    });
  }

  return agents;
}

async function cleanup(admin: SupabaseClient, runId: string, agents: Agent[]) {
  const marker = `${MARKER_PREFIX}${runId}]`;
  const { data: products } = await admin.from('products').select('id').ilike('name', `${marker}%`);
  const ids = (products || []).map((p) => p.id);
  if (ids.length) {
    await admin.from('product_approval_requests').delete().in('product_id', ids);
    await admin.from('product_specifications').delete().in('product_id', ids);
    await admin.from('product_images').delete().in('product_id', ids);
    await admin.from('products').delete().in('id', ids);
    console.log(`  cleanup: removed ${ids.length} products`);
  }

  for (const a of agents) {
    await admin.from('suppliers').delete().eq('id', a.supplierId);
    await admin.from('profiles').delete().eq('user_id', a.userId);
    await admin.auth.admin.deleteUser(a.userId);
  }
  console.log(`  cleanup: removed ${agents.length} ephemeral suppliers`);
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
  if (!url || !anon || !service) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE_KEY');
  }

  // Health check
  try {
    const health = await fetch(`${BASE}/api/settings`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (e) {
    throw new Error(
      `Dev server not reachable at ${BASE}. Start with npm run dev. (${e instanceof Error ? e.message : e})`
    );
  }

  const projectRef = new URL(url).hostname.split('.')[0];
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID().slice(0, 8);
  const categoryId = await pickCategoryId(admin);
  let agents: Agent[] = [];

  console.log(`\n=== Supplier HTTP load test ===`);
  console.log(`  base=${BASE} runId=${runId} concurrency=${MAX_CONCURRENCY} ops=${TARGET_OPS}`);

  try {
    agents = await createEphemeralAgents(admin, url, anon, projectRef, runId, SUPPLIER_COUNT);
    console.log(`  agents=${agents.length}`);

    // Phase A: concurrent creates
    const createJobs = Array.from({ length: Math.min(TARGET_OPS, 80) }, (_, i) => i);
    const wallA = performance.now();
    const createTimings = await mapPool(createJobs, MAX_CONCURRENCY, async (i) => {
      const agent = agents[i % agents.length];
      return timed('create', async () => {
        await apiJson(
          agent.cookie,
          'POST',
          '/api/products',
          {
            name: `${MARKER_PREFIX}${runId}] HTTP-S${i % agents.length}-P${i}`,
            description: 'http load test product',
            categoryId,
            sku: `HTTP-${runId}-${i}`,
            suggestedMoq: 100,
            supplierPrice: 10 + (i % 5),
            specifications: [{ spec_name: 'Material', spec_value: 'Steel', sort_order: 0 }],
          },
          { 'Idempotency-Key': randomUUID() }
        );
      });
    });
    printSummary({
      ...summarize('create@http', createTimings),
      wallSec: (performance.now() - wallA) / 1000,
    });
    if (createTimings.filter((t) => !t.ok).length / createTimings.length > 0.15) {
      throw new Error('Aborting: create error rate too high');
    }

    // Phase B: idempotent duplicate create
    const agent0 = agents[0];
    const idemKey = randomUUID();
    const payload = {
      name: `${MARKER_PREFIX}${runId}] IDEMPOTENT`,
      description: 'idempotency probe',
      categoryId,
      sku: `HTTP-IDEM-${runId}`,
      suggestedMoq: 100,
      supplierPrice: 11,
    };
    const wallB = performance.now();
    const idemTimings = await mapPool([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 10, async () => {
      return timed('idempotent-create', async () => {
        await apiJson(agent0.cookie, 'POST', '/api/products', payload, {
          'Idempotency-Key': idemKey,
        });
      });
    });
    printSummary({
      ...summarize('idempotent-create', idemTimings),
      wallSec: (performance.now() - wallB) / 1000,
    });
    const { data: idemProducts } = await admin
      .from('products')
      .select('id')
      .eq('sku', `HTTP-IDEM-${runId}`);
    console.log(`  idempotent product count (expect 1): ${idemProducts?.length ?? 0}`);

    // Phase C: concurrent update-requests on shared edit pool
    const { data: editPool } = await admin
      .from('products')
      .select('id, supplier_id')
      .ilike('name', `${MARKER_PREFIX}${runId}]%`)
      .limit(20);
    if (editPool && editPool.length >= 2) {
      const wallC = performance.now();
      const updateTimings = await mapPool(editPool, Math.min(MAX_CONCURRENCY, editPool.length), async (p, i) => {
        const agent = agents.find((a) => a.supplierId === p.supplier_id) || agents[0];
        return timed('update-request', async () => {
          await apiJson(
            agent.cookie,
            'POST',
            `/api/products/${p.id}/update-request`,
            {
              productId: p.id,
              name: `${MARKER_PREFIX}${runId}] edited-${i}`,
              categoryId,
              description: 'http load edit',
              suggestedMoq: 150,
              supplierPrice: 12.5,
            },
            { 'Idempotency-Key': randomUUID() }
          );
        });
      });
      printSummary({
        ...summarize('update-request@http', updateTimings),
        wallSec: (performance.now() - wallC) / 1000,
      });
    } else {
      console.log('  SKIP update-request — not enough products');
    }

    // Phase D: concurrent reorder (if images exist — usually none; seed 2 placeholders)
    const target = editPool?.[0];
    if (target) {
      const agent = agents.find((a) => a.supplierId === target.supplier_id) || agents[0];
      const imgIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const { data: img } = await admin
          .from('product_images')
          .insert({
            product_id: target.id,
            image_url: `https://example.com/loadtest/${runId}/${i}.webp`,
            sort_order: i,
            is_primary: i === 0,
          })
          .select('id')
          .single();
        if (img?.id) imgIds.push(img.id);
      }
      if (imgIds.length === 2) {
        const wallD = performance.now();
        const reorderTimings = await mapPool([0, 1, 2, 3, 4], 5, async (i) => {
          const order = i % 2 === 0 ? imgIds : [...imgIds].reverse();
          return timed('reorder', async () => {
            await apiJson(agent.cookie, 'PATCH', `/api/products/${target.id}/images`, {
              orderedImageIds: order,
            });
          });
        });
        printSummary({
          ...summarize('reorder@http', reorderTimings),
          wallSec: (performance.now() - wallD) / 1000,
        });
      }
    }

    console.log('\nPASS — supplier HTTP load test completed');
  } finally {
    await cleanup(admin, runId, agents);
  }
}

main().catch((err) => {
  console.error('\nFAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
