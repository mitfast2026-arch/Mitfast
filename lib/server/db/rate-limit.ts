import { createAdminClient } from '@/lib/supabase/admin';
import { isRpcMissing } from '@/lib/server/db/production-guards';

let pruneScheduled = false;

/**
 * Best-effort prune of old rate-limit rows (non-blocking, at most once per process tick).
 */
function maybePruneRateLimitLog(): void {
  if (pruneScheduled) return;
  pruneScheduled = true;
  queueMicrotask(async () => {
    try {
      const admin = createAdminClient();
      await (admin as any).rpc('prune_api_rate_limit_log', {
        p_older_than: '7 days',
      });
    } catch {
      /* non-blocking */
    } finally {
      // Allow another prune attempt after ~5 minutes of process uptime activity
      setTimeout(() => {
        pruneScheduled = false;
      }, 5 * 60 * 1000);
    }
  });
}

/**
 * Postgres-backed rate limit (advisory lock RPC). Fail-open only in non-production
 * when the RPC is missing so local/dev still works before migrations.
 */
export async function assertRateLimit(options: {
  scope: string;
  key: string;
  windowSeconds: number;
  maxHits: number;
}): Promise<{ ok: true } | { ok: false; code: 'RATE_LIMITED' | 'DATABASE_MISCONFIGURED' }> {
  const admin = createAdminClient();
  const { data, error } = await (admin as any).rpc('try_record_rate_limit', {
    p_scope: options.scope,
    p_key: options.key,
    p_window_seconds: options.windowSeconds,
    p_max_hits: options.maxHits,
  });

  if (error) {
    if (isRpcMissing(error, 'try_record_rate_limit')) {
      if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
        return { ok: false, code: 'DATABASE_MISCONFIGURED' };
      }
      return { ok: true };
    }
    console.error('[assertRateLimit]', error);
    return { ok: false, code: 'RATE_LIMITED' };
  }

  if (data === false) {
    return { ok: false, code: 'RATE_LIMITED' };
  }

  // Occasionally prune old log rows so advisory-lock COUNT stays cheap under spikes
  if (Math.random() < 0.02) {
    maybePruneRateLimitLog();
  }

  return { ok: true };
}

export function rateLimitedResponse(message = 'Too many requests. Retry shortly.') {
  return {
    success: false as const,
    error: { message, code: 'RATE_LIMITED' as const },
  };
}
