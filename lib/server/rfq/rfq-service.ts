import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomerCart, clearCustomerCart } from '@/lib/server/cart/cart-service';
import { getBusinessSettings } from '@/lib/server/settings/settings-service';
import {
  negotiateRfqSchema,
  rejectRfqSchema,
  submitRfqSchema,
  editRfqSchema,
} from '@/lib/validation/rfq.schema';
import { convertEnquiryToRfqSchema } from '@/lib/validation/enquiry.schema';
import { calculatePricing, roundCurrency } from '@/lib/server/pricing/calculate-price';
import { ensureCustomerFromGuest } from '@/lib/server/auth/ensure-customer-from-guest';
import { isProfileIdentityComplete } from '@/lib/server/auth/profile-complete';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { RfqStatus } from '@/types/database';
import { mapRpcError } from '@/lib/server/db/rpc-errors';
import { sanitizePostgrestSearch } from '@/lib/server/db/sanitize-search';
import {
  allowedFrom,
  RFQ_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { withIdempotency } from '@/lib/server/db/idempotency';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';
import { notifySuppliersForRfq } from '@/lib/server/email/supplier-notifications';

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
 * Submits RFQ(s) from the customer's active cart — one RFQ per supplier group.
 * Enforces Minimum RFQ Value (cart total) and snapshots delivery address & item prices.
 */
export async function submitRfqFromCart(
  customerId: string,
  formData: unknown,
  idempotencyKey?: string | null
): Promise<
  ServerResult<{
    rfqId: string;
    rfqNumber: string;
    rfqs: Array<{ rfqId: string; rfqNumber: string; supplierKey: string }>;
  }>
> {
  return withIdempotency('submit_rfq_from_cart', idempotencyKey, async () => {
  try {
    const validated = submitRfqSchema.safeParse(formData);
    if (!validated.success) {
      const issue = validated.error.errors[0];
      const path = issue?.path?.length ? issue.path.join('.') + ': ' : '';
      return {
        success: false,
        error: {
          message: `${path}${issue?.message || 'Invalid RFQ payload'}`,
          code: 'VALIDATION_ERROR',
        },
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

    const settingsRes = await getBusinessSettings();
    const settings = settingsRes.success ? settingsRes.data : null;

    const minRfqValue = settings?.minimumRfqValue || 500000;
    const currency = settings?.currency || 'INR';

    const cartRes = await getCustomerCart(customerId);
    if (!cartRes.success) return cartRes;

    const cart = cartRes.data;
    if (!cart.items || cart.items.length === 0) {
      return {
        success: false,
        error: { message: 'Your RFQ cart is empty. Add products to submit an RFQ.', code: 'EMPTY_CART' },
      };
    }

    const availableItems = cart.items.filter((item) => item.product.isAvailable);
    if (availableItems.length === 0) {
      return {
        success: false,
        error: {
          message: 'None of the products in your RFQ cart are currently available for RFQ.',
          code: 'PRODUCTS_UNAVAILABLE',
        },
      };
    }

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

    // Group by supplier (null → platform)
    const groupsMap = new Map<string, typeof availableItems>();
    for (const item of availableItems) {
      const key = item.product.supplierId || 'platform';
      const list = groupsMap.get(key) || [];
      list.push(item);
      groupsMap.set(key, list);
    }

    const groupsPayload: Array<{
      rfq_number: string;
      supplier_key: string;
      original_total: number;
      items: Array<{
        product_id: string;
        product_name_snapshot: string;
        original_quantity: number;
        original_unit_price: number;
      }>;
    }> = [];

    for (const [supplierKey, items] of groupsMap) {
      const groupTotal = Math.round(items.reduce((a, i) => a + i.itemTotal, 0) * 100) / 100;
      groupsPayload.push({
        rfq_number: await getNextRfqNumber(adminClient),
        supplier_key: supplierKey,
        original_total: groupTotal,
        items: items.map((item) => ({
          product_id: item.productId,
          product_name_snapshot: item.product.name,
          original_quantity: item.quantity,
          original_unit_price: item.product.actualUnitPrice,
        })),
      });
    }

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'submit_rfqs_from_cart_atomic',
      {
        p_customer_id: customerId,
        p_delivery_address: addressSnapshot,
        p_customer_message: customerMessage || null,
        p_groups: groupsPayload,
      }
    );

    if (!rpcError) {
      const rows = Array.isArray(rpcRows) ? rpcRows : rpcRows ? [rpcRows] : [];
      if (rows.length === 0 || !rows[0]?.rfq_id) {
        return {
          success: false,
          error: { message: 'Failed to create RFQ', code: 'DATABASE_ERROR' },
        };
      }
      const rfqs = rows.map((row: any) => ({
        rfqId: row.rfq_id as string,
        rfqNumber: (row.rfq_number as string) || '',
        supplierKey: (row.supplier_key as string) || 'platform',
      }));
      invalidateAdminCaches();
      void Promise.all(rfqs.map((r) => notifySuppliersForRfq(r.rfqId)));
      return {
        success: true,
        data: {
          rfqId: rfqs[0].rfqId,
          rfqNumber: rfqs[0].rfqNumber,
          rfqs,
        },
      };
    }

    const {
      isRpcMissing,
      allowUnsafeDbFallback,
      databaseMisconfiguredError,
    } = await import('@/lib/server/db/production-guards');

    if (isRpcMissing(rpcError, 'submit_rfqs_from_cart_atomic')) {
      if (!allowUnsafeDbFallback()) {
        return databaseMisconfiguredError('Split RFQ submit');
      }
      // Dev-only fallback: create one RFQ per group then clear cart
      const created: Array<{ rfqId: string; rfqNumber: string; supplierKey: string }> = [];
      for (const group of groupsPayload) {
        const { data: rfq, error: rfqError } = await adminClient
          .from('rfqs')
          .insert({
            rfq_number: group.rfq_number,
            customer_id: customerId,
            status: 'submitted',
            delivery_address_snapshot: addressSnapshot,
            customer_message: customerMessage || null,
            original_total: group.original_total,
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
        const { error: itemsError } = await adminClient.from('rfq_items').insert(
          group.items.map((item) => ({
            rfq_id: rfq.id,
            product_id: item.product_id,
            product_name_snapshot: item.product_name_snapshot,
            original_quantity: item.original_quantity,
            original_unit_price: item.original_unit_price,
            final_quantity: null,
            final_unit_price: null,
          }))
        );
        if (itemsError) {
          await adminClient.from('rfqs').delete().eq('id', rfq.id);
          return {
            success: false,
            error: { message: 'Failed to record RFQ line items', code: 'DATABASE_ERROR' },
          };
        }
        created.push({
          rfqId: rfq.id,
          rfqNumber: group.rfq_number,
          supplierKey: group.supplier_key,
        });
      }
      await clearCustomerCart(customerId);
      invalidateAdminCaches();
      void Promise.all(created.map((r) => notifySuppliersForRfq(r.rfqId)));
      return {
        success: true,
        data: {
          rfqId: created[0].rfqId,
          rfqNumber: created[0].rfqNumber,
          rfqs: created,
        },
      };
    }

    return { success: false, error: mapRpcError(rpcError) };
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
 * Supports multi-line conversion without dropping extra line items.
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

    const {
      enquiryId,
      quantity,
      productId: clientProductId,
      items: clientItems,
      deliveryAddress,
    } = validated.data;
    const adminClient = createAdminClient();

    const { data: enquiry, error: enquiryError } = await adminClient
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single();

    if (enquiryError || !enquiry) {
      return { success: false, error: { message: 'Enquiry not found', code: 'NOT_FOUND' } };
    }

    // Determine items to convert
    let rawItems: Array<{ productId: string; quantity: number }> = [];

    if (clientItems && clientItems.length > 0) {
      rawItems = clientItems;
    } else if (Array.isArray(enquiry.line_items) && enquiry.line_items.length > 0) {
      rawItems = enquiry.line_items
        .filter((li: any) => Boolean(li.product_id || li.productId))
        .map((li: any) => ({
          productId: String(li.product_id || li.productId),
          quantity: Math.max(1, Number(li.quantity) || quantity || 1),
        }));
    } else {
      const resolvedProductId = enquiry.product_id || clientProductId;
      if (!resolvedProductId) {
        return {
          success: false,
          error: { message: 'Select a product before creating an RFQ from this enquiry', code: 'VALIDATION_ERROR' },
        };
      }
      rawItems = [{ productId: resolvedProductId, quantity: quantity || 1 }];
    }

    if (rawItems.length === 0) {
      return {
        success: false,
        error: { message: 'Select at least one product before creating an RFQ', code: 'VALIDATION_ERROR' },
      };
    }

    const productIds = rawItems.map((i) => i.productId);
    const { data: products, error: prodError } = await adminClient
      .from('products')
      .select('id, name, selling_price, discount, gst_rate, gst_included, moq')
      .in('id', productIds);

    if (prodError || !products || products.length === 0) {
      return { success: false, error: { message: 'One or more products not found', code: 'NOT_FOUND' } };
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let originalTotal = 0;
    const processedItems: Array<{
      product_id: string;
      product_name_snapshot: string;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const item of rawItems) {
      const product = productMap.get(item.productId);
      if (!product) {
        return { success: false, error: { message: `Product ${item.productId} not found`, code: 'NOT_FOUND' } };
      }

      const effectiveQty = Math.max(item.quantity, product.moq || 1);
      const priced = calculatePricing({
        supplier_price: Number(product.selling_price || 0),
        profit_type: 'fixed',
        profit_value: 0,
        discount: Number(product.discount || 0),
        gst_rate: Number(product.gst_rate ?? 0),
        gst_included: Boolean(product.gst_included ?? false),
        quantity: effectiveQty,
      });

      const unitPrice = priced.discounted_unit_price;
      const lineTotal = roundCurrency(effectiveQty * unitPrice);
      originalTotal += lineTotal;

      processedItems.push({
        product_id: product.id,
        product_name_snapshot: product.name,
        quantity: effectiveQty,
        unit_price: unitPrice,
      });
    }

    originalTotal = roundCurrency(originalTotal);

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

    const addressSnapshot = deliveryAddress || {
      address_line_1: 'To be confirmed',
      address_line_2: null,
      city: 'TBD',
      state: 'TBD',
      postal_code: '000000',
      country: enquiry.country || 'India',
    };

    const rfqNumber = await getNextRfqNumber(adminClient);

    // Try multi-item atomic RPC
    let rpcSuccess = false;
    let createdRfqId = '';
    let createdRfqNumber = '';

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'create_rfq_from_enquiry_atomic',
      {
        p_enquiry_id: enquiryId,
        p_customer_id: customerId,
        p_rfq_number: rfqNumber,
        p_delivery_address: addressSnapshot,
        p_customer_message: enquiry.message,
        p_original_total: originalTotal,
        p_items: processedItems,
      }
    );

    if (!rpcError) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (row?.rfq_id) {
        rpcSuccess = true;
        createdRfqId = row.rfq_id;
        createdRfqNumber = row.rfq_number || rfqNumber;
      }
    } else if (processedItems.length === 1) {
      // Try single-item RPC fallback for backward compatibility
      const single = processedItems[0];
      const { data: sRows, error: sErr } = await (adminClient as any).rpc(
        'create_rfq_from_enquiry_atomic',
        {
          p_enquiry_id: enquiryId,
          p_customer_id: customerId,
          p_rfq_number: rfqNumber,
          p_delivery_address: addressSnapshot,
          p_customer_message: enquiry.message,
          p_original_total: originalTotal,
          p_product_id: single.product_id,
          p_product_name_snapshot: single.product_name_snapshot,
          p_quantity: single.quantity,
          p_unit_price: single.unit_price,
        }
      );
      if (!sErr) {
        const sRow = Array.isArray(sRows) ? sRows[0] : sRows;
        if (sRow?.rfq_id) {
          rpcSuccess = true;
          createdRfqId = sRow.rfq_id;
          createdRfqNumber = sRow.rfq_number || rfqNumber;
        }
      }
    }

    if (rpcSuccess && createdRfqId) {
      invalidateAdminCaches();
      void notifySuppliersForRfq(createdRfqId);

      return {
        success: true,
        data: { rfqId: createdRfqId, rfqNumber: createdRfqNumber },
      };
    }

    const {
      isRpcMissing,
      allowUnsafeDbFallback,
      databaseMisconfiguredError,
    } = await import('@/lib/server/db/production-guards');

    if (isRpcMissing(rpcError, 'create_rfq_from_enquiry_atomic')) {
      if (!allowUnsafeDbFallback()) {
        return databaseMisconfiguredError('Enquiry to RFQ conversion');
      }

      // Dev-only fallback
      const { data: rfq, error: rfqErr } = await adminClient
        .from('rfqs')
        .insert({
          rfq_number: rfqNumber,
          customer_id: customerId,
          enquiry_id: enquiryId,
          status: 'submitted',
          delivery_address_snapshot: addressSnapshot,
          customer_message: enquiry.message,
          original_total: originalTotal,
          final_total: null,
        })
        .select()
        .single();

      if (rfqErr || !rfq) {
        return { success: false, error: { message: rfqErr?.message || 'Failed to create RFQ', code: 'DATABASE_ERROR' } };
      }

      const itemInserts = processedItems.map((item) => ({
        rfq_id: rfq.id,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        original_quantity: item.quantity,
        original_unit_price: item.unit_price,
        final_quantity: null,
        final_unit_price: null,
      }));

      const { error: itemsErr } = await adminClient.from('rfq_items').insert(itemInserts);
      if (itemsErr) {
        await adminClient.from('rfqs').delete().eq('id', rfq.id);
        return { success: false, error: { message: 'Failed to create RFQ items', code: 'DATABASE_ERROR' } };
      }

      await adminClient
        .from('enquiries')
        .update({ status: 'converted_to_rfq', updated_at: new Date().toISOString() })
        .eq('id', enquiryId);

      invalidateAdminCaches();
      void notifySuppliersForRfq(rfq.id);

      return {
        success: true,
        data: { rfqId: rfq.id, rfqNumber },
      };
    }

    return { success: false, error: mapRpcError(rpcError) };
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
 * Admin edits RFQ line items, adds/removes products, adjusts prices, and updates customer details.
 * Atomically updates totals and enforces >= 1 line item rule.
 */
export async function adminEditRfq(
  formData: unknown
): Promise<ServerResult<{ updated: boolean; rfqId: string }>> {
  try {
    const validated = editRfqSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { rfqId, items, deliveryAddress, customerMessage, contact } = validated.data;
    const adminClient = createAdminClient();

    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .select('id, customer_id, status, delivery_address_snapshot, customer_message, original_total, final_total')
      .eq('id', rfqId)
      .single();

    if (rfqError || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    if (rfq.status === 'converted_to_order' || rfq.status === 'rejected') {
      return {
        success: false,
        error: { message: `RFQ cannot be edited in ${rfq.status} status`, code: 'INVALID_STATUS' },
      };
    }

    if (!items || items.length === 0) {
      return {
        success: false,
        error: { message: 'RFQ must contain at least one product line', code: 'VALIDATION_ERROR' },
      };
    }

    // Update customer contact if provided
    if (contact && rfq.customer_id) {
      const profilePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (contact.fullName) profilePatch.full_name = contact.fullName.trim();
      if (contact.email) profilePatch.email = contact.email.trim().toLowerCase();
      if (contact.phone) profilePatch.phone = contact.phone.trim();
      if ('companyName' in contact && (contact as any).companyName) {
        profilePatch.company_name = (contact as any).companyName.trim();
      }

      await adminClient
        .from('profiles')
        .update(profilePatch as any)
        .eq('id', rfq.customer_id);
    }

    // Batch fetch product info
    const productIds = items.map((i) => i.productId).filter((id): id is string => Boolean(id));
    let productMap = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: products } = await adminClient
        .from('products')
        .select('id, name, selling_price, discount, gst_rate, gst_included, moq')
        .in('id', productIds);
      if (products) {
        productMap = new Map(products.map((p) => [p.id, p]));
      }
    }

    const processedItems = items.map((item) => {
      const product = item.productId ? productMap.get(item.productId) : null;
      const qty = item.quantity ?? item.originalQuantity ?? 1;
      let unitPrice = item.unitPrice ?? item.originalUnitPrice;
      if (unitPrice === undefined && product) {
        const priced = calculatePricing({
          supplier_price: Number(product.selling_price || 0),
          profit_type: 'fixed',
          profit_value: 0,
          discount: Number(product.discount || 0),
          gst_rate: Number(product.gst_rate ?? 0),
          gst_included: Boolean(product.gst_included ?? false),
          quantity: qty,
        });
        unitPrice = priced.discounted_unit_price;
      }
      return {
        id: item.id || null,
        product_id: item.productId || null,
        product_name_snapshot: item.productNameSnapshot || product?.name || 'Product',
        original_quantity: qty,
        original_unit_price: roundCurrency(unitPrice ?? 0),
        final_quantity: item.finalQuantity || null,
        final_unit_price: item.finalUnitPrice !== undefined && item.finalUnitPrice !== null ? roundCurrency(item.finalUnitPrice) : null,
      };
    });

    const { error: rpcError } = await (adminClient as any).rpc('edit_rfq_atomic', {
      p_rfq_id: rfqId,
      p_items: processedItems,
      p_delivery_address: deliveryAddress ?? null,
      p_customer_message: customerMessage ?? null,
    });

    if (!rpcError) {
      invalidateAdminCaches();
      return { success: true, data: { updated: true, rfqId } };
    }

    const { isRpcMissing, allowUnsafeDbFallback, databaseMisconfiguredError } = await import(
      '@/lib/server/db/production-guards'
    );

    if (isRpcMissing(rpcError, 'edit_rfq_atomic')) {
      if (!allowUnsafeDbFallback()) {
        return databaseMisconfiguredError('RFQ editing');
      }

      // Dev-only fallback
      const keepIds: string[] = [];
      let origSubtotal = 0;
      let finalSubtotal = 0;
      let hasFinal = false;

      for (const item of processedItems) {
        const origPrice = Number(item.original_unit_price);
        const origQty = Number(item.original_quantity);
        const finalPrice = item.final_unit_price !== null ? Number(item.final_unit_price) : null;
        const finalQty = item.final_quantity !== null ? Number(item.final_quantity) : null;

        origSubtotal += origQty * origPrice;
        if (finalPrice !== null) {
          hasFinal = true;
          finalSubtotal += (finalQty ?? origQty) * finalPrice;
        } else {
          finalSubtotal += (finalQty ?? origQty) * origPrice;
        }

        if (item.id) {
          await adminClient
            .from('rfq_items')
            .update({
              product_id: item.product_id,
              product_name_snapshot: item.product_name_snapshot,
              original_quantity: origQty,
              original_unit_price: origPrice,
              final_quantity: finalQty,
              final_unit_price: finalPrice,
            })
            .eq('id', item.id)
            .eq('rfq_id', rfqId);
          keepIds.push(item.id);
        } else {
          const { data: inserted } = await adminClient
            .from('rfq_items')
            .insert({
              rfq_id: rfqId,
              product_id: item.product_id,
              product_name_snapshot: item.product_name_snapshot,
              original_quantity: origQty,
              original_unit_price: origPrice,
              final_quantity: finalQty,
              final_unit_price: finalPrice,
            })
            .select('id')
            .single();
          if (inserted?.id) keepIds.push(inserted.id);
        }
      }

      // Delete removed lines
      if (keepIds.length > 0) {
        await adminClient
          .from('rfq_items')
          .delete()
          .eq('rfq_id', rfqId)
          .not('id', 'in', `(${keepIds.join(',')})`);
      }

      const updateHeader: Record<string, unknown> = {
        original_total: roundCurrency(origSubtotal),
        final_total: hasFinal || rfq.final_total !== null ? roundCurrency(finalSubtotal) : null,
        updated_at: new Date().toISOString(),
      };
      if (deliveryAddress) updateHeader.delivery_address_snapshot = deliveryAddress;
      if (customerMessage !== undefined) updateHeader.customer_message = customerMessage;

      await adminClient.from('rfqs').update(updateHeader as any).eq('id', rfqId);

      invalidateAdminCaches();
      return { success: true, data: { updated: true, rfqId } };
    }

    return { success: false, error: mapRpcError(rpcError) };
  } catch (error) {
    console.error('[adminEditRfq] Error:', error);
    return { success: false, error: { message: 'Failed to edit RFQ', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Retrieve single RFQ detail with full items and authorization checks.
 */
export async function getRfqDetail(
  rfqId: string,
  options?: { customerId?: string; supplierId?: string; isAdmin?: boolean }
): Promise<ServerResult<{ rfq: any }>> {
  try {
    const adminClient = createAdminClient();
    const { data: rfq, error } = await adminClient
      .from('rfqs')
      .select(`
        *,
        customer:profiles!rfqs_customer_id_fkey(id, full_name, email, phone),
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
            name,
            selling_price,
            moq,
            supplier_id
          )
        )
      `)
      .eq('id', rfqId)
      .maybeSingle();

    if (error || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    if (!options?.isAdmin) {
      if (options?.customerId && rfq.customer_id !== options.customerId) {
        return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
      }
      if (options?.supplierId) {
        const ownsAny = (rfq.items || []).some(
          (itm: any) => (itm.product as any)?.supplier_id === options.supplierId
        );
        if (!ownsAny) {
          return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
        }
      }
    }

    return { success: true, data: { rfq } };
  } catch (error) {
    console.error('[getRfqDetail] Error:', error);
    return { success: false, error: { message: 'Failed to fetch RFQ detail', code: 'INTERNAL_ERROR' } };
  }
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
 * Negotiates RFQ line items. Admin may touch any line; suppliers only their own product lines.
 * Uses atomic RPC that recomputes final_total from ALL lines.
 */
export async function adminNegotiateRfq(
  formData: unknown,
  options?: { supplierId?: string | null; isAdmin?: boolean }
): Promise<ServerResult<{ negotiated: boolean }>> {
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
    const {
      isRpcMissing,
      allowUnsafeDbFallback,
      databaseMisconfiguredError,
    } = await import('@/lib/server/db/production-guards');

    const itemIds = items.map((i) => i.rfqItemId);
    const { data: existingItems, error: existingError } = await adminClient
      .from('rfq_items')
      .select('id, final_unit_price, original_unit_price, product_id, product:products(supplier_id)')
      .eq('rfq_id', rfqId)
      .in('id', itemIds);

    if (existingError) {
      return { success: false, error: { message: existingError.message, code: 'DATABASE_ERROR' } };
    }

    if (!options?.isAdmin && options?.supplierId) {
      for (const row of existingItems || []) {
        const supplierId = (row.product as { supplier_id?: string } | null)?.supplier_id;
        if (supplierId !== options.supplierId) {
          return {
            success: false,
            error: {
              message: 'Suppliers may only negotiate their own RFQ line items',
              code: 'FORBIDDEN',
            },
          };
        }
      }
    }

    const priceById = new Map<string, number>();
    for (const row of existingItems || []) {
      const existing =
        row.final_unit_price != null
          ? Number(row.final_unit_price)
          : Number(row.original_unit_price ?? 0);
      priceById.set(row.id, existing);
    }

    const payload = items.map((item) => ({
      rfq_item_id: item.rfqItemId,
      final_quantity: item.finalQuantity,
      final_unit_price:
        item.finalUnitPrice !== undefined
          ? item.finalUnitPrice
          : (priceById.get(item.rfqItemId) ?? 0),
    }));

    const { error: rpcError } = await (adminClient as any).rpc('negotiate_rfq_items_atomic', {
      p_rfq_id: rfqId,
      p_items: payload,
    });

    if (!rpcError) {
      invalidateAdminCaches();
      return { success: true, data: { negotiated: true } };
    }

    if (isRpcMissing(rpcError, 'negotiate_rfq_items_atomic')) {
      if (!allowUnsafeDbFallback()) {
        return databaseMisconfiguredError('RFQ negotiate');
      }
    } else {
      return { success: false, error: mapRpcError(rpcError) };
    }

    // Dev-only fallback (legacy multi-step)
    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .select('id, status')
      .eq('id', rfqId)
      .single();

    if (rfqError || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    for (const item of items) {
      const unitPrice =
        item.finalUnitPrice !== undefined
          ? item.finalUnitPrice
          : (priceById.get(item.rfqItemId) ?? 0);
      await adminClient
        .from('rfq_items')
        .update({
          final_quantity: item.finalQuantity,
          final_unit_price: unitPrice,
        })
        .eq('id', item.rfqItemId)
        .eq('rfq_id', rfqId);
    }

    const { data: allLines } = await adminClient
      .from('rfq_items')
      .select('final_quantity, original_quantity, final_unit_price, original_unit_price')
      .eq('rfq_id', rfqId);

    let calculatedFinalTotal = 0;
    for (const row of allLines || []) {
      const qty = Number(row.final_quantity ?? row.original_quantity ?? 0);
      const unit = Number(row.final_unit_price ?? row.original_unit_price ?? 0);
      calculatedFinalTotal += Math.round(qty * unit * 100) / 100;
    }
    calculatedFinalTotal = Math.round(calculatedFinalTotal * 100) / 100;

    const targetStatus: RfqStatus = rfq.status === 'submitted' ? 'under_review' : rfq.status;
    if (targetStatus !== rfq.status) {
      const allowed = allowedFrom(RFQ_TRANSITIONS, targetStatus);
      await transitionStatus(adminClient, 'rfqs', rfqId, 'status', targetStatus, allowed, {
        final_total: calculatedFinalTotal,
      });
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
    return { success: true, data: { negotiated: true } };
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
 * Admin hard deletes an RFQ.
 */
export async function adminDeleteRfq(rfqId: string): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('rfqs').delete().eq('id', rfqId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();
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
        customer_message,
        created_at,
        updated_at,
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
            moq,
            supplier:suppliers(id, company_name)
          )
        )
      `, { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.search) {
      const q = sanitizePostgrestSearch(params.search);
      if (q) {
        query = query.or(`rfq_number.ilike.%${q}%,customer_message.ilike.%${q}%`);
      }
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

async function getSupplierProductIds(
  adminClient: ReturnType<typeof createAdminClient>,
  supplierId: string
): Promise<string[]> {
  const { data: supplierProducts } = await adminClient
    .from('products')
    .select('id')
    .eq('supplier_id', supplierId);

  return (supplierProducts || []).map((p: { id: string }) => p.id);
}

export async function getSupplierRfqs(
  supplierId: string,
  params: { page?: number; limit?: number; search?: string }
): Promise<
  ServerResult<{
    rfqs: Array<{
      id: string;
      rfq_number: string;
      status: string;
      rejection_reason: string | null;
      created_at: string;
      updated_at: string;
      item_count: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }>
> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const offset = (page - 1) * limit;

    const productIds = await getSupplierProductIds(adminClient, supplierId);
    if (productIds.length === 0) {
      return { success: true, data: { rfqs: [], total: 0, page, limit } };
    }

    let query = adminClient
      .from('rfqs')
      .select(
        `
        id,
        rfq_number,
        status,
        rejection_reason,
        created_at,
        updated_at,
        rfq_items!inner(id)
      `,
        { count: 'exact' }
      )
      .in('rfq_items.product_id', productIds);

    const search = params.search?.trim();
    if (search) {
      const q = sanitizePostgrestSearch(search);
      if (q) {
        query = query.ilike('rfq_number', `%${q}%`);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    const rfqs = (data || []).map((row: any) => ({
      id: row.id,
      rfq_number: row.rfq_number,
      status: row.status,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_count: Array.isArray(row.rfq_items) ? row.rfq_items.length : 0,
    }));

    return { success: true, data: { rfqs, total: count || 0, page, limit } };
  } catch (error) {
    console.error('[getSupplierRfqs] Error:', error);
    return { success: false, error: { message: 'Failed to fetch supplier RFQs', code: 'INTERNAL_ERROR' } };
  }
}

export async function getSupplierRfqDetail(
  supplierId: string,
  rfqId: string
): Promise<
  ServerResult<{
    id: string;
    rfq_number: string;
    status: string;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    items: Array<{
      id: string;
      product_id: string;
      product_name_snapshot: string;
      original_quantity: number;
      original_unit_price: number;
      final_quantity: number | null;
      final_unit_price: number | null;
      sku: string | null;
    }>;
  }>
> {
  try {
    const adminClient = createAdminClient();
    const productIds = await getSupplierProductIds(adminClient, supplierId);
    if (productIds.length === 0) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .select('id, rfq_number, status, rejection_reason, created_at, updated_at')
      .eq('id', rfqId)
      .maybeSingle();

    if (rfqError || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    const { data: items, error: itemsError } = await adminClient
      .from('rfq_items')
      .select(
        'id, product_id, product_name_snapshot, original_quantity, original_unit_price, final_quantity, final_unit_price, product:products(sku)'
      )
      .eq('rfq_id', rfqId)
      .in('product_id', productIds);

    if (itemsError) {
      return { success: false, error: { message: itemsError.message, code: 'DATABASE_ERROR' } };
    }

    if (!items || items.length === 0) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    return {
      success: true,
      data: {
        ...rfq,
        items: items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          original_quantity: item.original_quantity,
          original_unit_price: item.original_unit_price,
          final_quantity: item.final_quantity,
          final_unit_price: item.final_unit_price,
          sku: item.product?.sku || null,
        })),
      },
    };
  } catch (error) {
    console.error('[getSupplierRfqDetail] Error:', error);
    return { success: false, error: { message: 'Failed to fetch RFQ detail', code: 'INTERNAL_ERROR' } };
  }
}
