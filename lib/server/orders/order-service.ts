import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';
import { getBusinessSettings } from '@/lib/server/settings/settings-service';
import {
  convertEnquiryToOrderSchema,
  convertRfqToOrderSchema,
  createManualOrderSchema,
  editOrderSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
} from '@/lib/validation/order.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { OrderStatus, PaymentStatus } from '@/types/database';
import { generateTrackingToken } from '@/lib/server/tracking';
import { ensureCustomerFromGuest } from '@/lib/server/auth/ensure-customer-from-guest';
import { mapRpcError } from '@/lib/server/db/rpc-errors';
import {
  allowedFrom,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { withIdempotency } from '@/lib/server/db/idempotency';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';

export async function getNextOrderNumber(adminClient: any): Promise<string> {
  try {
    const { data, error } = await adminClient.rpc('generate_order_number');
    if (!error && data && typeof data === 'string') {
      return data;
    }
  } catch {
    // fallback to timestamp-based unique identifier
  }
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timeSuffix = Date.now().toString().slice(-4);
  return `ORD-${dateStr}-${timeSuffix}${randomSuffix}`;
}

/**
 * Admin converts an accepted RFQ into a confirmed Order.
 * Snapshots all negotiated item details, delivery address, supplier references, and currency.
 */
export async function convertRfqToOrder(
  formData: unknown,
  idempotencyKey?: string | null
): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
  return withIdempotency('convert_rfq_to_order', idempotencyKey, async () => {
  try {
    const validated = convertRfqToOrderSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { rfqId } = validated.data;
    const adminClient = createAdminClient();

    // 1. Fetch RFQ header and items
    const { data: rfq, error: rfqError } = await adminClient
      .from('rfqs')
      .select(`
        *,
        items:rfq_items(
          *,
          product:products(
            id,
            name,
            gst_rate,
            gst_included,
            discount,
            supplier_id,
            supplier:suppliers(id, company_name)
          )
        )
      `)
      .eq('id', rfqId)
      .single();

    if (rfqError || !rfq) {
      return { success: false, error: { message: 'RFQ not found', code: 'NOT_FOUND' } };
    }

    if (rfq.status !== 'accepted') {
      return {
        success: false,
        error: { message: 'RFQ must be accepted before converting to an order', code: 'INVALID_STATUS' },
      };
    }

    // 2. Fetch business currency (cached)
    const settingsRes = await getBusinessSettings();
    const currencyCode = settingsRes.success && settingsRes.data ? settingsRes.data.currency : 'INR';

    // 3. Generate Order Number
    const orderNumber = await getNextOrderNumber(adminClient);

    // 4. Calculate items and totals
    let orderSubtotal = 0;
    let orderTotal = 0;
    const orderItemRows: any[] = [];

    for (const item of ((rfq as any)?.items || [])) {
      const qty = item.final_quantity ?? item.original_quantity;
      const unitPrice = item.final_unit_price ?? item.original_unit_price;
      const p = item.product as any;

      const gstRate = p?.gst_rate ?? 18;
      const gstIncluded = p?.gst_included ?? false;
      const discount = 0; // Negotiated price is already final net price

      const linePricing = calculatePricing({
        supplier_price: unitPrice,
        profit_type: 'fixed',
        profit_value: 0,
        discount: 0,
        gst_rate: gstRate,
        gst_included: gstIncluded,
        quantity: qty,
      });

      orderSubtotal += linePricing.subtotal;
      orderTotal += linePricing.total;

      orderItemRows.push({
        product_id: item.product_id,
        supplier_id: p?.supplier_id || null,
        product_name_snapshot: item.product_name_snapshot || p?.name || 'Item',
        supplier_name_snapshot: p?.supplier?.company_name || 'Supplier',
        quantity: qty,
        unit_price: unitPrice,
        currency_code: currencyCode,
        gst_rate: gstRate,
        gst_included: gstIncluded,
        discount: 0,
        subtotal: linePricing.subtotal,
        gst_amount: linePricing.total_gst_amount,
        total: linePricing.total,
      });
    }

    orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    orderTotal = Math.round(orderTotal * 100) / 100;

    const trackingToken = generateTrackingToken();

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'convert_rfq_to_order_atomic',
      {
        p_rfq_id: rfqId,
        p_order_number: orderNumber,
        p_tracking_token: trackingToken,
        p_subtotal: orderSubtotal,
        p_total: orderTotal,
        p_order_items: orderItemRows,
      }
    );

    if (rpcError) {
      const mapped = mapRpcError(rpcError);
      return { success: false, error: mapped };
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.order_id) {
      return {
        success: false,
        error: { message: 'Failed to create order', code: 'DATABASE_ERROR' },
      };
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: {
        orderId: row.order_id,
        orderNumber: row.order_number || orderNumber,
        trackingToken: row.tracking_token || trackingToken,
      },
    };
  } catch (error) {
    console.error('[convertRfqToOrder] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error converting RFQ to order', code: 'INTERNAL_ERROR' },
    };
  }
  });
}

/**
 * Admin converts an enquiry directly into an Order.
 */
export async function convertEnquiryToOrder(
  formData: unknown,
  idempotencyKey?: string | null
): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
  return withIdempotency('convert_enquiry_to_order', idempotencyKey, async () => {
  try {
    const validated = convertEnquiryToOrderSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const {
      enquiryId,
      customerId: requestedCustomerId,
      productId: clientProductId,
      quantity,
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

    let customerId = requestedCustomerId || enquiry.customer_id;
    if (!customerId) {
      const provisioned = await ensureCustomerFromGuest({
        email: enquiry.guest_email,
        phone: enquiry.guest_phone,
        fullName: enquiry.guest_name,
        deliveryAddress,
      });
      if (!provisioned.success) return provisioned;
      customerId = provisioned.data.customerId;
    }

    // Authoritative product: enquiry.product_id, fallback only when enquiry has none
    const resolvedProductId = enquiry.product_id || clientProductId;
    if (!resolvedProductId) {
      return {
        success: false,
        error: { message: 'Enquiry has no linked product; provide productId', code: 'VALIDATION_ERROR' },
      };
    }

    const [{ data: product, error: prodError }, settingsRes] = await Promise.all([
      adminClient
        .from('products')
        .select('*, supplier:suppliers(id, company_name)')
        .eq('id', resolvedProductId)
        .single(),
      getBusinessSettings(),
    ]);

    if (prodError || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    if (quantity < (product.moq || 1)) {
      return {
        success: false,
        error: { message: `Quantity must be at least MOQ (${product.moq})`, code: 'BELOW_MOQ' },
      };
    }

    const currencyCode = settingsRes.success && settingsRes.data ? settingsRes.data.currency : 'INR';

    // Re-read price/GST from DB — never trust client price fields
    const linePricing = calculatePricing({
      supplier_price: product.selling_price,
      profit_type: 'fixed',
      profit_value: 0,
      discount: product.discount || 0,
      gst_rate: product.gst_rate ?? 18,
      gst_included: product.gst_included ?? false,
      quantity,
    });

    const unitPrice = linePricing.discounted_unit_price;
    const gstRate = product.gst_rate ?? 18;
    const gstIncluded = product.gst_included ?? false;
    const discount = product.discount || 0;

    const orderNumber = await getNextOrderNumber(adminClient);
    const trackingToken = generateTrackingToken();

    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'convert_enquiry_to_order_atomic',
      {
        p_enquiry_id: enquiryId,
        p_customer_id: customerId,
        p_order_number: orderNumber,
        p_tracking_token: trackingToken,
        p_delivery_address: deliveryAddress,
        p_subtotal: linePricing.subtotal,
        p_total: linePricing.total,
        p_product_id: product.id,
        p_supplier_id: product.supplier_id,
        p_product_name_snapshot: product.name,
        p_supplier_name_snapshot: (product.supplier as any)?.company_name || 'Supplier',
        p_quantity: quantity,
        p_unit_price: unitPrice,
        p_currency_code: currencyCode,
        p_gst_rate: gstRate,
        p_gst_included: gstIncluded,
        p_discount: discount,
        p_line_subtotal: linePricing.subtotal,
        p_gst_amount: linePricing.total_gst_amount,
        p_line_total: linePricing.total,
      }
    );

    if (rpcError) {
      const mapped = mapRpcError(rpcError);
      return { success: false, error: mapped };
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.order_id) {
      return { success: false, error: { message: 'Failed to create order', code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: {
        orderId: row.order_id,
        orderNumber: row.order_number || orderNumber,
        trackingToken: row.tracking_token || trackingToken,
      },
    };
  } catch (error) {
    console.error('[convertEnquiryToOrder] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error converting enquiry to order', code: 'INTERNAL_ERROR' },
    };
  }
  });
}

/**
 * Admin creates an order manually from scratch.
 */
export async function createManualOrder(
  formData: unknown,
  idempotencyKey?: string | null
): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
  return withIdempotency('create_manual_order', idempotencyKey, async () => {
  try {
    const validated = createManualOrderSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { customerId, deliveryAddress, items } = validated.data;
    const adminClient = createAdminClient();

    // Verify customer profile exists
    const { data: customer, error: custError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      return { success: false, error: { message: 'Customer profile not found', code: 'NOT_FOUND' } };
    }

    const settingsRes = await getBusinessSettings();
    const currencyCode = settingsRes.success && settingsRes.data ? settingsRes.data.currency : 'INR';

    let orderSubtotal = 0;
    let orderTotal = 0;
    const itemRows: any[] = [];

    // Batch fetch all required products in a single round trip
    const productIds = Array.from(new Set(items.map(i => i.productId)));
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, name, supplier_id, moq, selling_price, discount, gst_rate, gst_included, supplier:suppliers(company_name)')
      .in('id', productIds);

    if (productsError || !products) {
      return { success: false, error: { message: 'Failed to retrieve products for order', code: 'DATABASE_ERROR' } };
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return { success: false, error: { message: `Product ID ${item.productId} not found`, code: 'NOT_FOUND' } };
      }

      if (item.quantity < (product.moq || 1)) {
        return {
          success: false,
          error: {
            message: `${product.name} is below MOQ (${product.moq})`,
            code: 'BELOW_MOQ',
          },
        };
      }

      // Admin may set negotiated unitPrice; GST defaults from live product unless explicitly provided
      const gstRate = item.gstRate ?? product.gst_rate ?? 18;
      const gstIncluded = item.gstIncluded ?? product.gst_included ?? false;
      const discount = item.discount ?? 0;
      const unitPrice = item.unitPrice;

      const pricing = calculatePricing({
        supplier_price: unitPrice,
        profit_type: 'fixed',
        profit_value: 0,
        discount,
        gst_rate: gstRate,
        gst_included: gstIncluded,
        quantity: item.quantity,
      });

      orderSubtotal += pricing.subtotal;
      orderTotal += pricing.total;

      itemRows.push({
        product_id: product.id,
        supplier_id: product.supplier_id,
        product_name_snapshot: product.name,
        supplier_name_snapshot: (product.supplier as any)?.company_name || 'Supplier',
        quantity: item.quantity,
        unit_price: unitPrice,
        currency_code: currencyCode,
        gst_rate: gstRate,
        gst_included: gstIncluded,
        discount,
        subtotal: pricing.subtotal,
        gst_amount: pricing.total_gst_amount,
        total: pricing.total,
      });
    }

    orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    orderTotal = Math.round(orderTotal * 100) / 100;

    const orderNumber = await getNextOrderNumber(adminClient);

    const trackingToken = generateTrackingToken();
    const { data: rpcRows, error: rpcError } = await (adminClient as any).rpc(
      'create_manual_order_atomic',
      {
        p_customer_id: customerId,
        p_order_number: orderNumber,
        p_tracking_token: trackingToken,
        p_delivery_address: deliveryAddress,
        p_subtotal: orderSubtotal,
        p_total: orderTotal,
        p_order_items: itemRows,
      }
    );

    if (!rpcError) {
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row?.order_id) {
        return { success: false, error: { message: 'Failed to create order header', code: 'DATABASE_ERROR' } };
      }
      invalidateAdminCaches();
      return {
        success: true,
        data: {
          orderId: row.order_id,
          orderNumber: row.order_number || orderNumber,
          trackingToken: row.tracking_token || trackingToken,
        },
      };
    }

    const rpcMissing =
      rpcError.code === 'PGRST202' ||
      rpcError.message?.includes('Could not find the function') ||
      rpcError.message?.includes('create_manual_order_atomic');

    if (!rpcMissing) {
      return { success: false, error: mapRpcError(rpcError) };
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: 'accepted',
        payment_status: 'payment_required',
        delivery_address_snapshot: deliveryAddress,
        subtotal: orderSubtotal,
        total: orderTotal,
        tracking_token: trackingToken,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: { message: 'Failed to create order header', code: 'DATABASE_ERROR' } };
    }

    const rowsWithOrderId = itemRows.map((r) => ({ ...r, order_id: order.id }));
    const { error: itemsError } = await adminClient.from('order_items').insert(rowsWithOrderId);
    if (itemsError) {
      await adminClient.from('orders').delete().eq('id', order.id);
      return { success: false, error: { message: 'Failed to create order items', code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber,
        trackingToken: order.tracking_token || trackingToken,
      },
    };
  } catch (error) {
    console.error('[createManualOrder] Error:', error);
    return { success: false, error: { message: 'Failed to create order', code: 'INTERNAL_ERROR' } };
  }
  });
}

/**
 * Admin updates order status (non-linear: can move forward or backward per Section 55).
 */
export async function updateOrderStatus(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updateOrderStatusSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { orderId, status } = validated.data;
    const adminClient = createAdminClient();

    const allowed = allowedFrom(ORDER_STATUS_TRANSITIONS, status);
    if (allowed.length === 0) {
      return { success: false, error: { message: 'Invalid order status transition', code: 'INVALID_STATUS' } };
    }

    const result = await transitionStatus(
      adminClient,
      'orders',
      orderId,
      'status',
      status,
      allowed
    );

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'Order status cannot be changed from its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateOrderStatus] Error:', error);
    return { success: false, error: { message: 'Failed to update order status', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin updates payment status ('payment_required' -> 'payment_done').
 */
export async function updatePaymentStatus(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updatePaymentStatusSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { orderId, paymentStatus } = validated.data;
    const adminClient = createAdminClient();

    const allowed = allowedFrom(PAYMENT_TRANSITIONS, paymentStatus);
    if (allowed.length === 0) {
      return { success: false, error: { message: 'Invalid payment status transition', code: 'INVALID_STATUS' } };
    }

    const result = await transitionStatus(
      adminClient,
      'orders',
      orderId,
      'payment_status',
      paymentStatus,
      allowed
    );

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'Payment status cannot be changed from its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updatePaymentStatus] Error:', error);
    return { success: false, error: { message: 'Failed to update payment status', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin edits live order lines (qty / unit price) and recalculates totals.
 */
export async function editOrder(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = editOrderSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { orderId, items, deliveryAddress } = validated.data;
    const adminClient = createAdminClient();

    const pricedItems: Array<Record<string, unknown>> = [];

    // Sort by orderItemId for consistent lock ordering inside the RPC
    const sortedItems = [...items].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));

    for (const item of sortedItems) {
      const priced = calculatePricing({
        supplier_price: item.unitPrice,
        profit_type: 'fixed',
        profit_value: 0,
        discount: item.discount,
        gst_rate: item.gstRate,
        gst_included: item.gstIncluded,
        quantity: item.quantity,
      });

      pricedItems.push({
        order_item_id: item.orderItemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        gst_rate: item.gstRate,
        gst_included: item.gstIncluded,
        discount: item.discount,
        subtotal: priced.subtotal,
        gst_amount: priced.total_gst_amount,
        total: priced.total,
      });
    }

    const { error: rpcError } = await (adminClient as any).rpc('edit_order_atomic', {
      p_order_id: orderId,
      p_items: pricedItems,
      p_delivery_address: deliveryAddress ?? null,
    });

    if (!rpcError) {
      invalidateAdminCaches();
      return { success: true, data: { updated: true } };
    }

    const rpcMissing =
      rpcError.code === 'PGRST202' ||
      rpcError.message?.includes('Could not find the function') ||
      rpcError.message?.includes('edit_order_atomic');

    if (!rpcMissing) {
      return { success: false, error: mapRpcError(rpcError) };
    }

    const { data: existing } = await adminClient
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (!existing) {
      return { success: false, error: { message: 'Order not found', code: 'NOT_FOUND' } };
    }
    if (existing.status === 'cancelled' || existing.status === 'dispatched') {
      return {
        success: false,
        error: { message: 'Dispatched or cancelled orders cannot be edited', code: 'INVALID_STATUS' },
      };
    }

    let orderSubtotal = 0;
    let orderTotal = 0;
    for (const item of pricedItems) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const gstRate = Number(item.gst_rate);
      const gstIncluded = Boolean(item.gst_included);
      const discount = Number(item.discount);
      const subtotal = Number(item.subtotal);
      const gstAmount = Number(item.gst_amount);
      const total = Number(item.total);
      const orderItemId = String(item.order_item_id);

      orderSubtotal += subtotal || 0;
      orderTotal += total || 0;
      await adminClient
        .from('order_items')
        .update({
          quantity,
          unit_price: unitPrice,
          gst_rate: gstRate,
          gst_included: gstIncluded,
          discount,
          subtotal,
          gst_amount: gstAmount,
          total,
        })
        .eq('id', orderItemId)
        .eq('order_id', orderId);
    }

    const header: Record<string, unknown> = {
      subtotal: Math.round(orderSubtotal * 100) / 100,
      total: Math.round(orderTotal * 100) / 100,
      updated_at: new Date().toISOString(),
    };
    if (deliveryAddress) header.delivery_address_snapshot = deliveryAddress;

    await (adminClient.from('orders') as any).update(header).eq('id', orderId);

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[editOrder] Error:', error);
    return { success: false, error: { message: 'Failed to edit order', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Customer retrieves their orders.
 * Zero supplier references or supplier prices exposed (Defense-in-depth).
 */
export async function getCustomerOrders(
  customerId: string,
  options?: { limit?: number; offset?: number }
): Promise<ServerResult<{ orders: any[]; total?: number }>> {
  try {
    const adminClient = createAdminClient();
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);

    const { data: orders, count, error } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        delivery_address_snapshot,
        subtotal,
        total,
        created_at,
        items:order_items(
          id,
          product_id,
          product_name_snapshot,
          quantity,
          unit_price,
          currency_code,
          gst_rate,
          gst_included,
          discount,
          subtotal,
          gst_amount,
          total
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
      data: { orders: orders || [], total: count ?? undefined },
    };
  } catch (error) {
    console.error('[getCustomerOrders] Error:', error);
    return { success: false, error: { message: 'Failed to fetch customer orders', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin retrieves paginated, searchable, filtered orders.
 */
export async function getOrdersForAdmin(params: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  supplierId?: string;
  search?: string;
  convertedOnly?: boolean;
}): Promise<ServerResult<{ orders: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('orders')
      .select(`
        *,
        customer:profiles(id, full_name, email, phone),
        enquiry:enquiries(id, guest_name, guest_email, guest_phone, country, enquiry_type),
        rfq:rfqs(id, rfq_number, enquiry_id),
        items:order_items(
          *,
          supplier:suppliers(id, company_name)
        )
      `, { count: 'exact' });

    if (params.convertedOnly) {
      query = query.or('enquiry_id.not.is.null,rfq_id.not.is.null');
    }

    if (params.status) query = query.eq('status', params.status);
    if (params.paymentStatus) query = query.eq('payment_status', params.paymentStatus);
    if (params.search) query = query.ilike('order_number', `%${params.search}%`);

    query = query.order('created_at', { ascending: false });

    const { data: orders, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: {
        orders: orders || [],
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getOrdersForAdmin] Error:', error);
    return { success: false, error: { message: 'Failed to fetch orders for admin', code: 'INTERNAL_ERROR' } };
  }
}
