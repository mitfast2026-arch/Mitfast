import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type AdminClient = SupabaseClient<Database>;

export type TransitionResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: 'NOT_FOUND' | 'INVALID_STATUS' };

/**
 * Atomic single-row status transition: UPDATE … WHERE status IN (allowedFrom).
 * Zero rows updated → INVALID_STATUS (concurrent transition won).
 */
export async function transitionStatus<T extends Record<string, unknown>>(
  adminClient: AdminClient,
  table: keyof Database['public']['Tables'] & string,
  id: string,
  statusColumn: string,
  newStatus: string,
  allowedFrom: string[],
  extraFields?: Record<string, unknown>
): Promise<TransitionResult<T>> {
  const payload: Record<string, unknown> = {
    [statusColumn]: newStatus,
    updated_at: new Date().toISOString(),
    ...extraFields,
  };

  const { data, error } = await (adminClient as any)
    .from(table)
    .update(payload)
    .eq('id', id)
    .in(statusColumn, allowedFrom)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { ok: false, reason: 'INVALID_STATUS' };
  }

  return { ok: true, row: data as T };
}

/** FSM transition maps (locked business rules). */
export const SUPPLIER_TRANSITIONS: Record<string, string[]> = {
  active: ['pending', 'archived'],
  rejected: ['pending'],
  archived: ['active'],
  pending: ['rejected'],
};

export const RFQ_TRANSITIONS: Record<string, string[]> = {
  under_review: ['submitted'],
  accepted: ['submitted', 'under_review'],
  rejected: ['submitted', 'under_review'],
  converted_to_order: ['accepted'],
};

export const ENQUIRY_TRANSITIONS: Record<string, string[]> = {
  contacted: ['new'],
  converted_to_rfq: ['new', 'contacted'],
  converted_to_order: ['new', 'contacted'],
  closed: ['new', 'contacted'],
};

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  packing: ['accepted'],
  dispatched: ['packing'],
  cancelled: ['accepted', 'packing'],
};

export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  payment_done: ['payment_required'],
};

export const PRODUCT_APPROVAL_TRANSITIONS: Record<string, string[]> = {
  approved: ['pending', 'update_pending'],
  rejected: ['pending', 'update_pending'],
  update_pending: ['approved'],
};

export const PRODUCT_PUBLICATION_TRANSITIONS: Record<string, string[]> = {
  published: ['unpublished'],
  unpublished: ['published'],
};

export function allowedFrom(
  transitions: Record<string, string[]>,
  targetStatus: string
): string[] {
  return transitions[targetStatus] ?? [];
}
