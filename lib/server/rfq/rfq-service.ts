import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomerCart, clearCustomerCart } from '@/lib/server/cart/cart-service';
import { getBusinessSettings } from '@/lib/server/settings/settings-service';
import { negotiateRfqSchema, rejectRfqSchema, submitRfqSchema } from '@/lib/validation/rfq.schema';
import { convertEnquiryToRfqSchema } from '@/lib/validation/enquiry.schema';
import { ensureCustomerFromGuest } from '@/lib/server/auth/ensure-customer-from-guest';
import { isProfileIdentityComplete } from '@/lib/server/auth/profile-complete';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { RfqStatus } from '@/types/database';
import { mapRpcError } from '@/lib/server/db/rpc-errors';
import {
  allowedFrom,
  ENQUIRY_TRANSITIONS,
  RFQ_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { withIdempotency } from '@/lib/server/db/idempotency';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';

export async function getNextRfqNumber(adminClient: any): Promise<string> {
  try {
    const { data, error } = await adminClient.rpc('generate_rfq_number');
    if (!error && data && typeof data === 'string') {
      return data;
    }
  } catch {
    // fallback
  }
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timeSuffix = Date.now().toString().slice(-4);
  return `RFQ-${dateStr}-${timeSuffix}${randomSuffix}`;
}

/**
 * Submits an RFQ from the customer's active cart.
 * Enforces Minimum RFQ Value from business settings and snapshots delivery address & item prices.
 */
export async function submitRfqFromCart(
  customerId: string,
  formData: unknown,
  idempotencyKey?: string | null
): Promise<ServerResult<{ rfqId: string; rfqNumber: string }>> {
  return withIdempotency('submit_rfq_from_cart', idempotencyKey, async () => {
  try {
    const validated = submitRfqSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { customerMessage, deliveryAddress: customAddress, contact } = validated.data;
    const adminClient = createAdminClient();

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, phone, role')
      .eq('id', customerId)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: { message: 'Customer profile not found', code: 'NOT_FOUND' },
      };
    }

    if (contact) {
      const { error: contactUpdateError } = await adminClient
        .from('profiles')
        .update({
          full_name: contact.fullName.trim(),
          email: contact.email.trim().toLowerCase(),
          phone: contact.phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (contactUpdateError) {
        return {
          success: false,
          error: { message: contactUpdateError.message, code: 'PROFILE_ERROR' },
        };
      }

      profile.full_name = contact.fullName.trim();
      profile.email = contact.email.trim().toLowerCase();
      profile.phone = contact.phone.trim();
    }

    if (!isProfileIdentityComplete(profile)) {
      return {
        success: false,
        error: {
          message: 'Name, email, and phone are required before submitting an RFQ.',
          code: 'INCOMPLETE_PROFILE',
        },
      };
    }

    // 1. Fetch business settings to check minimum RFQ value (cached)
    const settingsRes = await getBusinessSettings();
    const settings = settingsRes.success ? settingsRes.data : null;

    const minRfqValue = settings?.minimumRfqValue || 500000;
    const currency = settings?.currency || 'INR';

    // 2. Fetch customer cart
    const cartRes = await getCustomerCart(customerId);
    if (!cartRes.success) return cartRes;

    const cart = cartRes.data;
    if (!cart.items || cart.items.length === 0) {
      return {
        success: false,
        error: { message: 'Your RFQ cart is empty. Add products to submit an RFQ.', code: 'EMPTY_CART' },
      };
    }

    // 3. Verify all products are available and re-evaluate server-side prices
    const availableItems = cart.items.filter(item => item.product.isAvailable);
    if (availableItems.length === 0) {
      return {
        success: false,
        error: { message: 'None of the products in your RFQ cart are currently available for RFQ.', code: 'PRODUCTS_UNAVAILABLE' },
      };
    }

    // Recalculate original total strictly server-side
    const originalTotal = availableItems.reduce((acc, item) => acc + item.itemTotal, 0);

    for (const item of availableItems) {
      if (item.quantity < (item.product.moq || 1)) {
        return {
          success: false,
          error: { message: `${item.product.name} is below MOQ (${item.product.moq})`, code: 'BELOW_MOQ' },
        };
      }
      if (item.product.minOrderValue && item.itemTotal < item.product.minOrderValue) {
        return {
          success: false,
          error: {
            message: `${item.product.name} is below its minimum order value of ₹${item.product.minOrderValue.toLocaleString('en-IN')}`,
            code: 'BELOW_MIN_ORDER_VALUE',
          },
        };
      }
    }

    const roundedOriginalTotal = Math.round(originalTotal * 100) / 100;

    // 4. Validate Minimum RFQ Value rule
    if (roundedOriginalTotal < minRfqValue) {
      const formattedMin = minRfqValue.toLocaleString('en-IN');
      const formattedTotal = roundedOriginalTotal.toLocaleString('en-IN');
      return {
        success: false,
        error: {
          message: `Minimum required RFQ value is ${currency} ${formattedMin}. Your current total is ${currency} ${formattedTotal}. Please increase quantities or add more items.`,
          code: 'BELOW_MINIMUM_RFQ_VALUE',
        },
      };
    }

    // 5. Resolve delivery address snapshot
    let addressSnapshot: any = customAddress;
    if (!addressSnapshot) {
      const { data: savedAddr } = await adminClient
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (savedAddr) {
        addressSnapshot = {
          address_line_1: savedAddr.address_line_1,
          address_line_2: savedAddr.address_line_2,
          city: savedAddr.city,
          state: savedAddr.state,
          postal_code: savedAddr.postal_code,
          country: savedAddr.country,
        };
      } else {
        return {
          success: false,
          error: { message: 'Please provide a delivery address for your RFQ.', code: 'MISSING_ADDRESS' },
        };
      }
    }

    // 6. Generate collision-free RFQ number
    const rfqNumber = await getNextRfqNumber(adminClient);

    // 7–9. Prefer atomic RPC; fall back to multi-step until migration applied
    const rfqItemPayload = availableItems.map((item) => ({
      product_id: item.productId,
      product_name_snapshot: item.product.name,
      original_quantity: item.quantity,
      original_unit_price: item.product.actualUnitPrice,
    }));

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'submit_rfq_from_cart_atomic',
      {
        p_customer_id: customerId,
        p_rfq_number: rfqNumber,
        p_delivery_address: addressSnapshot,
        p_customer_message: customerMessage || null,
        p_original_total: roundedOriginalTotal,
        p_items: rfqItemPayload,
      }
    );

    if (!rpcError) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row?.rfq_id) {
        return {
          success: false,
          error: { message: 'Failed to create RFQ', code: 'DATABASE_ERROR' },
        };
      }
      invalidateAdminCaches();
      return {
        success: true,
        data: {
          rfqId: row.rfq_id,
          rfqNumber: row.rfq_number || rfqNumber,
        },
      };
    }

    const rpcMissing =
      rpcError.code === 'PGRST202' ||
      rpcError.message?.includes('Could not find the function') ||
      rpcError.message?.includes('submit_rfq_from_cart_atomic');

    if (!rpcMissing) {
      return { success: false, error: mapRpcError(rpcError) };
    }

    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .insert({
        rfq_number: rfqNumber,
        customer_id: customerId,
        status: 'submitted',
        delivery_address_snapshot: addressSnapshot,
        customer_message: customerMessage || null,
        original_total: roundedOriginalTotal,
        final_total: null,
      })
      .select()
      .single();

    if (rfqError || !rfq) {
      return {
        success: false,
        error: { message: rfqError?.message || 'Failed to create RFQ', code: 'DATABASE_ERROR' },
      };
    }

    const rfqItemRows = availableItems.map((item) => ({
      rfq_id: rfq.id,
      product_id: item.productId,
      product_name_snapshot: item.product.name,
      original_quantity: item.quantity,
      original_unit_price: item.product.actualUnitPrice,
      final_quantity: null,
      final_unit_price: null,
    }));

    const { error: itemsError } = await adminClient.from('rfq_items').insert(rfqItemRows);
    if (itemsError) {
      await adminClient.from('rfqs').delete().eq('id', rfq.id);
      return {
        success: false,
        error: { message: 'Failed to record RFQ line items', code: 'DATABASE_ERROR' },
      };
    }

    await clearCustomerCart(customerId);
    invalidateAdminCaches();

    return {
      success: true,
      data: {
        rfqId: rfq.id,
        rfqNumber,
      },
    };
  } catch (error) {
    console.error('[submitRfqFromCart] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error submitting RFQ', code: 'INTERNAL_ERROR' },
    };
  }
  });
}

/**
 * Admin converts a qualified enquiry into an RFQ for price negotiation.
 * Bypasses cart/minimum-RFQ rules — this is an internal sales step.
 */
export async function createRfqFromEnquiry(
  formData: unknown,
  idempotencyKey?: string | null
): Promise<ServerResult<{ rfqId: string; rfqNumber: string }>> {
  return withIdempotency('create_rfq_from_enquiry', idempotencyKey, async () => {
  try {
    const validated = convertEnquiryToRfqSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { enquiryId, quantity, productId: clientProductId, deliveryAddress } = validated.data;
    const adminClient = createAdminClient();

    const { data: enquiry, error: enquiryError } = await adminClient
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single();

    if (enquiryError || !enquiry) {
      return { success: false, error: { message: 'Enquiry not found', code: 'NOT_FOUND' } };
    }

    const resolvedProductId = enquiry.product_id || clientProductId;
    if (!resolvedProductId) {
      return {
        success: false,
        error: { message: 'Select a product before creating an RFQ from this enquiry', code: 'VALIDATION_ERROR' },
      };
    }

    const { data: product, error: prodError } = await adminClient
      .from('products')
      .select('id, name, selling_price, moq')
      .eq('id', resolvedProductId)
      .single();

    if (prodError || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    if (quantity < (product.moq || 1)) {
      return {
        success: false,
        error: { message: `Quantity must be at least MOQ (${product.moq})`, code: 'BELOW_MOQ' },
      };
    }

    let customerId = enquiry.customer_id;
    if (!customerId) {
      const country = enquiry.country || deliveryAddress?.country || 'India';
      const provisioned = await ensureCustomerFromGuest({
        email: enquiry.guest_email,
        phone: enquiry.guest_phone,
        fullName: enquiry.guest_name,
        deliveryAddress: deliveryAddress || {
          address_line_1: 'To be confirmed',
          city: 'TBD',
          state: 'TBD',
          postal_code: '000000',
          country,
        },
      });
      if (!provisioned.success) return provisioned;
      customerId = provisioned.data.customerId;
    }

    const unitPrice = Number(product.selling_price || 0);
    const originalTotal = Math.round(quantity * unitPrice * 100) / 100;

    const addressSnapshot = deliveryAddress || {
      address_line_1: 'To be confirmed',
      address_line_2: null,
      city: 'TBD',
      state: 'TBD',
      postal_code: '000000',
      country: enquiry.country || 'India',
    };

    const rfqNumber = await getNextRfqNumber(adminClient);

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'create_rfq_from_enquiry_atomic',
      {
        p_enquiry_id: enquiryId,
        p_customer_id: customerId,
        p_rfq_number: rfqNumber,
        p_delivery_address: addressSnapshot,
        p_customer_message: enquiry.message,
        p_original_total: originalTotal,
        p_product_id: product.id,
        p_product_name_snapshot: product.name,
        p_quantity: quantity,
        p_unit_price: unitPrice,
      }
    );

    if (rpcError) {
      return { success: false, error: mapRpcError(rpcError) };
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.rfq_id) {
      return { success: false, error: { message: 'Failed to create RFQ', code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: { rfqId: row.rfq_id, rfqNumber: row.rfq_number || rfqNumber },
    };
  } catch (error) {
    console.error('[createRfqFromEnquiry] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error creating RFQ from enquiry', code: 'INTERNAL_ERROR' },
    };
  }
  });
}

/**
 * True when the supplier manufactures at least one product line on the RFQ.
 */
export async function supplierOwnsRfqItems(supplierId: string, rfqId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data: products } = await adminClient
    .from('products')
    .select('id')
    .eq('supplier_id', supplierId);

  const productIds = (products || []).map((p: { id: string }) => p.id);
  if (productIds.length === 0) return false;

  const { data: items } = await adminClient
    .from('rfq_items')
    .select('id')
    .eq('rfq_id', rfqId)
    .in('product_id', productIds)
    .limit(1);

  return (items || []).length > 0;
}

/**
 * Admin (or authorized supplier) negotiates an RFQ — quantities and optional unit prices.
 * Preserves original request values and computes final_total.
 * When finalUnitPrice is omitted, existing DB price is retained (supplier quantity negotiate).
 */
export async function adminNegotiateRfq(formData: unknown): Promise<ServerResult<{ negotiated: boolean }>> {
  try {
    const validated = negotiateRfqSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { rfqId, items } = validated.data;
    const adminClient = createAdminClient();

    // Verify RFQ exists
    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .select('id, status')
      .eq('id', rfqId)
      .single();

    if (rfqError || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    const itemIds = items.map((i) => i.rfqItemId);
    const { data: existingItems } = await adminClient
      .from('rfq_items')
      .select('id, final_unit_price, original_unit_price')
      .eq('rfq_id', rfqId)
      .in('id', itemIds);

    const priceById = new Map<string, number>();
    for (const row of existingItems || []) {
      const existing =
        row.final_unit_price != null
          ? Number(row.final_unit_price)
          : Number(row.original_unit_price ?? 0);
      priceById.set(row.id, existing);
    }

    let calculatedFinalTotal = 0;

    // Update each item's final quantity and final unit price
    for (const item of items) {
      const unitPrice =
        item.finalUnitPrice !== undefined
          ? item.finalUnitPrice
          : (priceById.get(item.rfqItemId) ?? 0);
      const lineTotal = Math.round(item.finalQuantity * unitPrice * 100) / 100;
      calculatedFinalTotal += lineTotal;

      await adminClient
        .from('rfq_items')
        .update({
          final_quantity: item.finalQuantity,
          final_unit_price: unitPrice,
        })
        .eq('id', item.rfqItemId)
        .eq('rfq_id', rfqId);
    }

    calculatedFinalTotal = Math.round(calculatedFinalTotal * 100) / 100;

    // Update RFQ header with final total and status
    const targetStatus: RfqStatus = rfq.status === 'submitted' ? 'under_review' : rfq.status;
    if (targetStatus !== rfq.status) {
      const allowed = allowedFrom(RFQ_TRANSITIONS, targetStatus);
      const tr = await transitionStatus(adminClient, 'rfqs', rfqId, 'status', targetStatus, allowed, {
        final_total: calculatedFinalTotal,
      });
      if (!tr.ok) {
        await adminClient
          .from('rfqs')
          .update({ final_total: calculatedFinalTotal, updated_at: new Date().toISOString() })
          .eq('id', rfqId);
      }
    } else {
      await adminClient
        .from('rfqs')
        .update({
          final_total: calculatedFinalTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rfqId);
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: { negotiated: true },
    };
  } catch (error) {
    console.error('[adminNegotiateRfq] Error:', error);
    return { success: false, error: { message: 'Failed to save negotiation', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin accepts an RFQ.
 */
export async function adminAcceptRfq(rfqId: string): Promise<ServerResult<{ accepted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const allowed = allowedFrom(RFQ_TRANSITIONS, 'accepted');
    const result = await transitionStatus(adminClient, 'rfqs', rfqId, 'status', 'accepted', allowed);

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'RFQ cannot be accepted in its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { accepted: true } };
  } catch (error) {
    console.error('[adminAcceptRfq] Error:', error);
    return { success: false, error: { message: 'Failed to accept RFQ', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin rejects an RFQ (rejection reason required).
 */
export async function adminRejectRfq(formData: unknown): Promise<ServerResult<{ rejected: boolean }>> {
  try {
    const validated = rejectRfqSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { rfqId, rejectionReason } = validated.data;
    const adminClient = createAdminClient();

    const allowed = allowedFrom(RFQ_TRANSITIONS, 'rejected');
    const result = await transitionStatus(adminClient, 'rfqs', rfqId, 'status', 'rejected', allowed, {
      rejection_reason: rejectionReason,
    });

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'RFQ cannot be rejected in its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { rejected: true } };
  } catch (error) {
    console.error('[adminRejectRfq] Error:', error);
    return { success: false, error: { message: 'Failed to reject RFQ', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin hard deletes an RFQ (per spec Sections 46 & 109).
 */
export async function adminDeleteRfq(rfqId: string): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('rfqs').delete().eq('id', rfqId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[adminDeleteRfq] Error:', error);
    return { success: false, error: { message: 'Failed to delete RFQ', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Customer retrieves their own list of RFQs.
 */
export async function getCustomerRfqs(
  customerId: string,
  options?: { limit?: number; offset?: number }
): Promise<ServerResult<{ rfqs: any[]; total?: number }>> {
  try {
    const adminClient = createAdminClient();
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);

    const { data: rfqs, count, error } = await adminClient
      .from('rfqs')
      .select(`
        id,
        rfq_number,
        status,
        original_total,
        final_total,
        rejection_reason,
        delivery_address_snapshot,
        created_at,
        items:rfq_items(
          id,
          product_id,
          product_name_snapshot,
          original_quantity,
          original_unit_price,
          final_quantity,
          final_unit_price,
          product:products(sku)
        )
      `, { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: { rfqs: rfqs || [], total: count ?? undefined },
    };
  } catch (error) {
    console.error('[getCustomerRfqs] Error:', error);
    return { success: false, error: { message: 'Failed to fetch customer RFQs', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin retrieves paginated, searchable, filtered RFQs.
 */
export async function getRfqsForAdmin(params: {
  page?: number;
  limit?: number;
  status?: RfqStatus;
  search?: string;
}): Promise<ServerResult<{ rfqs: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('rfqs')
      .select(`
        *,
        customer:profiles(id, full_name, email, phone),
        enquiry:enquiries(id, guest_name, guest_email, guest_phone, country, company_name, enquiry_type),
        items:rfq_items(
          id,
          product_id,
          product_name_snapshot,
          original_quantity,
          original_unit_price,
          final_quantity,
          final_unit_price,
          product:products(
            id,
            sku,
            supplier_price,
            selling_price,
            supplier:suppliers(id, company_name)
          )
        )
      `, { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.search) {
      query = query.or(
        `rfq_number.ilike.%${params.search}%,customer_message.ilike.%${params.search}%`
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data: rfqs, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: {
        rfqs: rfqs || [],
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getRfqsForAdmin] Error:', error);
    return { success: false, error: { message: 'Failed to fetch RFQs for admin', code: 'INTERNAL_ERROR' } };
  }
}
