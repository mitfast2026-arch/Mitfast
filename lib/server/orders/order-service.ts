import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';
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

/**
 * Admin converts an accepted RFQ into a confirmed Order.
 * Snapshots all negotiated item details, delivery address, supplier references, and currency.
 */
export async function convertRfqToOrder(formData: unknown): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
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
        error: { message: 'RFQ must be accepted before converting to a production order', code: 'INVALID_STATUS' },
      };
    }

    // 2. Fetch business currency
    const { data: settings } = await adminClient
      .from('business_settings')
      .select('currency')
      .single();
    const currencyCode = settings?.currency || 'INR';

    // 3. Generate Order Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

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

    // 5. Create Order Header
    const trackingToken = generateTrackingToken();
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: rfq.customer_id,
        rfq_id: rfq.id,
        status: 'accepted',
        payment_status: 'payment_required',
        delivery_address_snapshot: rfq.delivery_address_snapshot,
        subtotal: orderSubtotal,
        total: orderTotal,
        tracking_token: trackingToken,
      })
      .select()
      .single();

    if (orderError || !order) {
      return {
        success: false,
        error: { message: orderError?.message || 'Failed to create order', code: 'DATABASE_ERROR' },
      };
    }

    // 6. Insert Order Items
    const rowsWithOrderId = orderItemRows.map(r => ({ ...r, order_id: order.id }));
    const { error: itemsInsertError } = await adminClient.from('order_items').insert(rowsWithOrderId);

    if (itemsInsertError) {
      return {
        success: false,
        error: { message: 'Failed to record order items', code: 'DATABASE_ERROR' },
      };
    }

    // 7. Update RFQ Status to 'converted_to_order'
    await adminClient
      .from('rfqs')
      .update({
        status: 'converted_to_order',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rfqId);

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber,
        trackingToken: order.tracking_token || trackingToken,
      },
    };
  } catch (error) {
    console.error('[convertRfqToOrder] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error converting RFQ to order', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin converts an enquiry directly into an Order.
 */
export async function convertEnquiryToOrder(formData: unknown): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
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

    const { data: product, error: prodError } = await adminClient
      .from('products')
      .select('*, supplier:suppliers(id, company_name)')
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

    const { data: settings } = await adminClient
      .from('business_settings')
      .select('currency')
      .single();
    const currencyCode = settings?.currency || 'INR';

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

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

    const trackingToken = generateTrackingToken();
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        enquiry_id: enquiryId,
        status: 'accepted',
        payment_status: 'payment_required',
        delivery_address_snapshot: deliveryAddress,
        subtotal: linePricing.subtotal,
        total: linePricing.total,
        tracking_token: trackingToken,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: { message: 'Failed to create order', code: 'DATABASE_ERROR' } };
    }

    await adminClient.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      supplier_id: product.supplier_id,
      product_name_snapshot: product.name,
      supplier_name_snapshot: (product.supplier as any)?.company_name || 'Supplier',
      quantity,
      unit_price: unitPrice,
      currency_code: currencyCode,
      gst_rate: gstRate,
      gst_included: gstIncluded,
      discount,
      subtotal: linePricing.subtotal,
      gst_amount: linePricing.total_gst_amount,
      total: linePricing.total,
    });

    await adminClient
      .from('enquiries')
      .update({
        status: 'converted_to_order',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enquiryId);

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber,
        trackingToken: order.tracking_token || trackingToken,
      },
    };
  } catch (error) {
    console.error('[convertEnquiryToOrder] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error converting enquiry to order', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin creates an order manually from scratch.
 */
export async function createManualOrder(formData: unknown): Promise<ServerResult<{ orderId: string; orderNumber: string; trackingToken: string }>> {
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

    const { data: settings } = await adminClient
      .from('business_settings')
      .select('currency')
      .single();
    const currencyCode = settings?.currency || 'INR';

    let orderSubtotal = 0;
    let orderTotal = 0;
    const itemRows: any[] = [];

    for (const item of items) {
      const { data: product } = await adminClient
        .from('products')
        .select('id, name, supplier_id, moq, selling_price, discount, gst_rate, gst_included, supplier:suppliers(company_name)')
        .eq('id', item.productId)
        .single();

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

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

    const trackingToken = generateTrackingToken();
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

    const rowsWithOrderId = itemRows.map(r => ({ ...r, order_id: order.id }));
    await adminClient.from('order_items').insert(rowsWithOrderId);

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

    const { error } = await adminClient
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

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

    const { error } = await adminClient
      .from('orders')
      .update({
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

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

    const { data: existing } = await adminClient
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (!existing) {
      return { success: false, error: { message: 'Order not found', code: 'NOT_FOUND' } };
    }
    if (existing.status === 'cancelled' || existing.status === 'dispatched') {
      return { success: false, error: { message: 'Dispatched or cancelled orders cannot be edited', code: 'INVALID_STATUS' } };
    }

    let orderSubtotal = 0;
    let orderTotal = 0;

    for (const item of items) {
      const { data: line } = await adminClient
        .from('order_items')
        .select('*')
        .eq('id', item.orderItemId)
        .eq('order_id', orderId)
        .maybeSingle();

      if (!line) continue;

      const priced = calculatePricing({
        supplier_price: item.unitPrice,
        profit_type: 'fixed',
        profit_value: 0,
        discount: item.discount,
        gst_rate: item.gstRate,
        gst_included: item.gstIncluded,
        quantity: item.quantity,
      });

      orderSubtotal += priced.subtotal;
      orderTotal += priced.total;

      await adminClient
        .from('order_items')
        .update({
          quantity: item.quantity,
          unit_price: item.unitPrice,
          gst_rate: item.gstRate,
          gst_included: item.gstIncluded,
          discount: item.discount,
          subtotal: priced.subtotal,
          gst_amount: priced.total_gst_amount,
          total: priced.total,
        })
        .eq('id', line.id);
    }

    const header: Record<string, any> = {
      subtotal: Math.round(orderSubtotal * 100) / 100,
      total: Math.round(orderTotal * 100) / 100,
      updated_at: new Date().toISOString(),
    };
    if (deliveryAddress) header.delivery_address_snapshot = deliveryAddress;

    await (adminClient.from('orders') as any).update(header).eq('id', orderId);

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
export async function getCustomerOrders(customerId: string): Promise<ServerResult<{ orders: any[] }>> {
  try {
    const adminClient = createAdminClient();

    const { data: orders, error } = await adminClient
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
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: { orders: orders || [] },
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
        items:order_items(
          *,
          supplier:suppliers(id, company_name)
        )
      `, { count: 'exact' });

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
