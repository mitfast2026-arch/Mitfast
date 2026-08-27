import { createAdminClient } from '@/lib/supabase/admin';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type IdempotencyScope =
  | 'convert_rfq_to_order'
  | 'convert_enquiry_to_order'
  | 'create_rfq_from_enquiry'
  | 'submit_rfq_from_cart';

/**
 * Returns cached response if key exists and is fresh; otherwise runs handler and stores result.
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  scope: IdempotencyScope,
  key: string | null | undefined,
  handler: () => Promise<{ success: true; data: T } | { success: false; error: { message: string; code: string } }>
): Promise<{ success: true; data: T } | { success: false; error: { message: string; code: string } }> {
  if (!key?.trim()) {
    return handler();
  }

  const fullKey = `${scope}:${key.trim()}`;
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();

  const { data: existing } = await (admin as any)
    .from('idempotency_keys')
    .select('response, created_at')
    .eq('key', fullKey)
    .gte('created_at', cutoff)
    .maybeSingle();

  if (existing?.response) {
    return existing.response as Awaited<ReturnType<typeof handler>>;
  }

  const result = await handler();

  if (result.success) {
    await (admin as any)
      .from('idempotency_keys')
      .upsert(
        {
          key: fullKey,
          scope,
          response: result,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
  }

  return result;
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
