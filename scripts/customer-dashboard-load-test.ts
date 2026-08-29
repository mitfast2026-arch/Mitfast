/**
 * Free-tier-safe customer dashboard load test (localhost/staging only).
 *
 * Max 20 concurrent workers; tags [LOADTEST:<runId>] and always cleans up.
 *
 *   $env:LOAD_TEST_CONFIRM=1; $env:TEST_BASE_URL='http://localhost:3000'; npx tsx scripts/customer-dashboard-load-test.ts
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
const MAX_VUS = clampInt(process.env.MAX_VUS, 20, 5, 20);
const TARGET_OPS = clampInt(process.env.TARGET_OPS, 40, 10, 80);
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
    const ok = res.status < 500 && (res.status < 400 || res.status === 401 || res.status === 403);
    // dashboard pages / APIs should be 200 for authenticated customer
    const authOk = res.status === 200 || res.status === 204;
    return {
      op: path,
      ms: performance.now() - start,
      ok: authOk,
      status: res.status,
      error: authOk ? undefined : `HTTP_${res.status}`,
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error('Missing Supabase env');

  const health = await fetch(`${BASE}/api/settings`).catch(() => null);
  if (!health || !health.ok) throw new Error(`Dev server not reachable at ${BASE}`);

  const projectRef = new URL(url).hostname.split('.')[0];
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID().slice(0, 8);
  const email = `loadtest.customer.${runId}@mitfast.test`;
  const password = `LoadCust!${runId}Aa1`;
  let userId: string | null = null;

  console.log(`\n=== Customer dashboard load test ===`);
  console.log(`  base=${BASE} runId=${runId} maxVUs=${MAX_VUS} ops=${TARGET_OPS}`);

  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: `${MARKER_PREFIX}${runId}] Customer` },
    });
    if (createErr || !created.user) throw new Error(createErr?.message || 'createUser failed');
    userId = created.user.id;

    await admin.from('profiles').upsert(
      {
        user_id: userId,
        role: 'customer',
        full_name: `${MARKER_PREFIX}${runId}] Customer`,
        email,
        phone: '',
      },
      { onConflict: 'user_id' }
    );

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr || !signed.session) throw new Error(signErr?.message || 'signIn failed');
    const cookie = cookieHeaderFromSession(signed.session, projectRef);

    const paths = [
      '/customer/dashboard',
      '/api/customer/badge-counts',
      '/api/customer/addresses',
      '/api/customer/enquiries?limit=4',
      '/api/customer/profile',
    ];

    const jobs = Array.from({ length: TARGET_OPS }, (_, i) => paths[i % paths.length]);
    const wall = performance.now();
    const timings = await mapPool(jobs, MAX_VUS, async (path) => hit(cookie, path));
    const wallSec = (performance.now() - wall) / 1000;
    const summary = summarize('customer-dashboard', timings, wallSec);
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
      throw new Error(`Aborting: error rate ${(summary.errRate * 100).toFixed(1)}% > 5%`);
    }
    console.log('\nPASS — customer dashboard load test');
    return summary;
  } finally {
    if (userId) {
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
      console.log('  cleanup: ephemeral customer removed');
    }
  }
}

main().catch((err) => {
  console.error('\nFAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
