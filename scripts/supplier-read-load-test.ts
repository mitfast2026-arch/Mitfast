/**
 * Free-tier-safe authenticated supplier READ load test (localhost/staging only).
 *
 * Hits orders, RFQs, products, and supplier stats. Max 25 concurrent workers.
 * Tags [LOADTEST:<runId>] and always cleans up.
 *
 *   $env:LOAD_TEST_CONFIRM=1; $env:TEST_BASE_URL='http://localhost:3000'; npx tsx scripts/supplier-read-load-test.ts
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type Session } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(process.cwd(), '.env.development.local'), override: true });

const CONFIRM = process.env.LOAD_TEST_CONFIRM === '1';
const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const MAX_VUS = clampInt(process.env.MAX_VUS, 25, 5, 25);
const TARGET_OPS = clampInt(process.env.TARGET_OPS, 50, 20, 100);
const MARKER_PREFIX = '[LOADTEST:';

type Timing = { op: string; ms: number; ok: boolean; error?: string; status?: number };

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

function summarize(label: string, timings: Timing[], wallSec: number) {
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
    rps: wallSec > 0 ? timings.length / wallSec : 0,
  };
}

function printSummary(row: ReturnType<typeof summarize>) {
  console.log(
    `  ${row.label.padEnd(28)} n=${String(row.count).padStart(4)} ok=${row.ok} fail=${row.fail} err=${(row.errRate * 100).toFixed(1)}%` +
      ` | p50=${row.p50.toFixed(0)}ms p95=${row.p95.toFixed(0)}ms p99=${row.p99.toFixed(0)}ms | rps=${row.rps.toFixed(2)}`
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
  return `${COOKIE}=${value}`;
}

function assertSafeBaseUrl(url: string) {
  if (/mitfast-b2b(\.|-)/i.test(url) && !/staging/i.test(url)) {
    throw new Error(`Refusing production-like URL: ${url}`);
  }
  if (/vercel\.app/i.test(url) && !/staging/i.test(url)) {
    throw new Error(`Refusing vercel.app without staging: ${url}`);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url) && !/staging/i.test(url)) {
    throw new Error(`TEST_BASE_URL must be localhost or staging (got ${url})`);
  }
}

async function hit(cookie: string, path: string): Promise<Timing> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
    const ok = res.status === 200 || res.status === 204;
    return {
      op: path.split('?')[0],
      ms: performance.now() - start,
      ok,
      status: res.status,
      error: ok ? undefined : `HTTP_${res.status}`,
    };
  } catch (err) {
    return {
      op: path,
      ms: performance.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  if (!CONFIRM) {
    console.error('Refusing to run without LOAD_TEST_CONFIRM=1');
    process.exit(1);
  }
  assertSafeBaseUrl(BASE);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !anon || !service) throw new Error('Missing Supabase env');

  const health = await fetch(`${BASE}/api/settings`).catch(() => null);
  if (!health || !health.ok) throw new Error(`Dev server not reachable at ${BASE}`);

  const projectRef = new URL(url).hostname.split('.')[0];
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID().slice(0, 8);
  const email = `loadtest.sread.${runId}@mitfast.test`;
  const password = `LoadSup!${runId}Aa1`;
  let userId: string | null = null;
  let supplierId: string | null = null;

  console.log(`\n=== Supplier READ load test ===`);
  console.log(`  base=${BASE} runId=${runId} maxVUs=${MAX_VUS} ops=${TARGET_OPS}`);

  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: `${MARKER_PREFIX}${runId}] SRead` },
    });
    if (createErr || !created.user) throw new Error(createErr?.message || 'createUser failed');
    userId = created.user.id;

    await admin.from('profiles').upsert(
      {
        user_id: userId,
        role: 'supplier',
        full_name: `${MARKER_PREFIX}${runId}] SRead`,
        email,
        phone: '',
      },
      { onConflict: 'user_id' }
    );

    const { data: supplier, error: supErr } = await admin
      .from('suppliers')
      .insert({
        user_id: userId,
        company_name: `${MARKER_PREFIX}${runId}] SRead Co`,
        status: 'active',
        email,
        contact_person: 'LoadTest',
        phone: '0000000000',
        country: 'India',
      } as any)
      .select('id')
      .single();
    if (supErr || !supplier) throw new Error(supErr?.message || 'supplier insert failed');
    supplierId = supplier.id;

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr || !signed.session) throw new Error(signErr?.message || 'signIn failed');
    const cookie = cookieHeaderFromSession(signed.session, projectRef);

    const paths = [
      `/api/suppliers/${supplierId}/stats`,
      '/api/supplier/orders?limit=50',
      '/api/supplier/rfqs?limit=50',
      '/api/supplier/products?limit=20',
      '/api/supplier/enquiries?limit=20',
    ];

    const jobs = Array.from({ length: TARGET_OPS }, (_, i) => paths[i % paths.length]);
    const wall = performance.now();
    const timings = await mapPool(jobs, MAX_VUS, async (path) => hit(cookie, path));
    const wallSec = (performance.now() - wall) / 1000;
    const summary = summarize('supplier-reads', timings, wallSec);
    printSummary(summary);

    const byPath = new Map<string, Timing[]>();
    for (const t of timings) {
      const list = byPath.get(t.op) || [];
      list.push(t);
      byPath.set(t.op, list);
    }
    for (const [path, list] of byPath) {
      printSummary(summarize(path.slice(0, 28), list, wallSec));
    }

    if (summary.errRate > 0.05) {
      const fails = timings.filter((t) => !t.ok).slice(0, 5);
      for (const f of fails) console.log(`    fail ${f.op} ${f.error}`);
      throw new Error(`Aborting: error rate ${(summary.errRate * 100).toFixed(1)}% > 5%`);
    }
    console.log('\nPASS — supplier READ load test');
  } finally {
    if (supplierId) await admin.from('suppliers').delete().eq('id', supplierId);
    if (userId) {
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
    console.log('  cleanup: ephemeral supplier removed');
  }
}

main().catch((err) => {
  console.error('\nFAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
