import { createAdminClient } from '@/lib/supabase/admin';
import { isRpcMissing } from '@/lib/server/db/production-guards';

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

  return { ok: true };
}
