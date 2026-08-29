import { createAdminClient } from '@/lib/supabase/admin';
import { isUniqueViolation } from '@/lib/server/db/rpc-errors';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PENDING_POLL_MS = 50;
const PENDING_MAX_WAITS = 40; // ~2s

export type IdempotencyScope =
  | 'convert_rfq_to_order'
  | 'convert_enquiry_to_order'
  | 'create_rfq_from_enquiry'
  | 'submit_rfq_from_cart'
  | 'create_enquiry'
  | 'create_manual_order'
  | 'create_supplier_product'
  | 'submit_supplier_product_update'
  | 'upload_product_image';

type HandlerResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('status') ||
    msg.includes('null value in column "response"') ||
    msg.includes('schema cache')
  );
}

/**
 * Insert-first idempotency: claim the key before running the handler.
 * Concurrent duplicates wait for the completed response or get IDEMPOTENCY_IN_PROGRESS.
 * Falls back to legacy response-only rows until migration 20260827000032 is applied.
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  scope: IdempotencyScope,
  key: string | null | undefined,
  handler: () => Promise<HandlerResult<T>>
): Promise<HandlerResult<T>> {
  if (!key?.trim()) {
    return handler();
  }

  const fullKey = `${scope}:${key.trim()}`;
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();

  let claimed = false;

  const modernInsert = await (admin as any).from('idempotency_keys').insert({
    key: fullKey,
    scope,
    status: 'in_progress',
    response: null,
    created_at: new Date().toISOString(),
  });

  if (!modernInsert.error) {
    claimed = true;
  } else if (isUniqueViolation(modernInsert.error)) {
    // Contended — wait for completed response below
  } else if (isMissingColumnError(modernInsert.error)) {
    // Pre-migration schema: claim with sentinel response payload
    const legacyInsert = await (admin as any).from('idempotency_keys').insert({
      key: fullKey,
      scope,
      response: { __pending: true },
      created_at: new Date().toISOString(),
    });
    if (!legacyInsert.error) {
      claimed = true;
    } else if (!isUniqueViolation(legacyInsert.error)) {
      return {
        success: false,
        error: {
          message: legacyInsert.error.message || 'Idempotency claim failed',
          code: 'DATABASE_ERROR',
        },
      };
    }
  } else {
    return {
      success: false,
      error: {
        message: modernInsert.error.message || 'Idempotency claim failed',
        code: 'DATABASE_ERROR',
      },
    };
  }

  if (!claimed) {
    for (let i = 0; i < PENDING_MAX_WAITS; i++) {
      const { data: existing } = await (admin as any)
        .from('idempotency_keys')
        .select('status, response, created_at')
        .eq('key', fullKey)
        .gte('created_at', cutoff)
        .maybeSingle();

      if (!existing) {
        const retry = await (admin as any).from('idempotency_keys').insert({
          key: fullKey,
          scope,
          status: 'in_progress',
          response: null,
          created_at: new Date().toISOString(),
        });
        if (!retry.error) {
          claimed = true;
          break;
        }
        if (isMissingColumnError(retry.error)) {
          const legacyRetry = await (admin as any).from('idempotency_keys').insert({
            key: fullKey,
            scope,
            response: { __pending: true },
            created_at: new Date().toISOString(),
          });
          if (!legacyRetry.error) {
            claimed = true;
            break;
          }
        }
        await sleep(PENDING_POLL_MS);
        continue;
      }

      const pending =
        existing.status === 'in_progress' ||
        (existing.response &&
          typeof existing.response === 'object' &&
          (existing.response as { __pending?: boolean }).__pending === true);

      if (!pending && existing.response) {
        return existing.response as HandlerResult<T>;
      }

      await sleep(PENDING_POLL_MS);
    }

    if (!claimed) {
      return {
        success: false,
        error: {
          message: 'A matching request is already in progress. Retry shortly.',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        },
      };
    }
  }

  try {
    const result = await handler();

    if (result.success) {
      const updated = await (admin as any)
        .from('idempotency_keys')
        .update({
          status: 'completed',
          response: result,
        })
        .eq('key', fullKey);

      if (updated.error && isMissingColumnError(updated.error)) {
        await (admin as any)
          .from('idempotency_keys')
          .update({ response: result })
          .eq('key', fullKey);
      }
    } else {
      await (admin as any).from('idempotency_keys').delete().eq('key', fullKey);
    }

    return result;
  } catch (error) {
    await (admin as any).from('idempotency_keys').delete().eq('key', fullKey);
    throw error;
  }
}

/** Prune expired idempotency keys (best-effort, non-blocking). */
export async function pruneIdempotencyKeys(): Promise<void> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();
    await (admin as any).from('idempotency_keys').delete().lt('created_at', cutoff);
  } catch {
    /* non-blocking */
  }
}
