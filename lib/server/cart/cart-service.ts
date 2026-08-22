import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  addedAt: string;
  product: {
    id: string;
    name: string;
    sellingPrice: number;
    discount: number;
    gstRate: number;
    gstIncluded: boolean;
    moq: number;
    minOrderValue: number | null;
    actualUnitPrice: number;
    ribbonLabel: string | null;
    isAvailable: boolean; // true if published + active + approved
    categoryName: string;
    primaryImage: string | null;
  };
  itemTotal: number;
}

export interface CustomerCartData {
  cartId: string;
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
}

/**
 * Gets or creates the customer's active cart with product snapshots and pricing.
 */
export async function getCustomerCart(customerId: string): Promise<ServerResult<CustomerCartData>> {
  try {
    const adminClient = createAdminClient();

    // 1. Ensure cart exists
    let { data: cart } = await adminClient
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: createError } = await adminClient
        .from('carts')
        .insert({ customer_id: customerId })
        .select('id')
        .single();

      if (createError || !newCart) {
        return { success: false, error: { message: 'Failed to initialize RFQ workspace', code: 'DATABASE_ERROR' } };
      }
      cart = newCart;
    }

    // 2. Fetch cart items with product and images
    const { data: cartItems, error: itemsError } = await adminClient
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        added_at,
        product:products(
          id,
          name,
          selling_price,
          discount,
          gst_rate,
          gst_included,
          moq,
          min_order_value,
          ribbon_label,
          approval_status,
          publication_status,
          archive_status,
          category:categories(name),
          images:product_images(image_url, is_primary, sort_order)
        )
      `)
      .eq('cart_id', cart.id)
      .order('added_at', { ascending: false });

    if (itemsError) {
      return { success: false, error: { message: itemsError.message, code: 'DATABASE_ERROR' } };
    }

    let subtotal = 0;
    const formattedItems: CartItemWithProduct[] = [];

    for (const item of (cartItems || [])) {
      const p = item.product as any;
      if (!p) continue;

      const isAvailable =
        p.publication_status === 'published' &&
        p.archive_status === 'active' &&
        p.approval_status === 'approved';

      const priced = calculatePricing({
        supplier_price: p.selling_price || 0,
        profit_type: 'fixed',
        profit_value: 0,
        discount: p.discount || 0,
        gst_rate: p.gst_rate || 0,
        gst_included: p.gst_included || false,
        quantity: item.quantity,
      });
      const unitPrice = priced.discounted_unit_price;
      const itemTotal = priced.subtotal;
      if (isAvailable) {
        subtotal += itemTotal;
      }

      const primaryImg =
        p.images?.find((img: any) => img.is_primary)?.image_url ||
        p.images?.[0]?.image_url ||
        null;

      formattedItems.push({
        id: item.id,
        productId: item.product_id,
        quantity: item.quantity,
        addedAt: item.added_at,
        product: {
          id: p.id,
          name: p.name,
          sellingPrice: p.selling_price,
          discount: p.discount || 0,
          gstRate: p.gst_rate || 0,
          gstIncluded: p.gst_included || false,
          moq: p.moq || 1,
          minOrderValue: p.min_order_value ?? null,
          actualUnitPrice: unitPrice,
          ribbonLabel: p.ribbon_label,
          isAvailable,
          categoryName: p.category?.name || 'General',
          primaryImage: primaryImg,
        },
        itemTotal,
      });
    }

    return {
      success: true,
      data: {
        cartId: cart.id,
        items: formattedItems,
        itemCount: formattedItems.reduce((acc, curr) => acc + curr.quantity, 0),
        subtotal: Math.round(subtotal * 100) / 100,
      },
    };
  } catch (error) {
    console.error('[getCustomerCart] Error:', error);
    return { success: false, error: { message: 'Failed to retrieve RFQ workspace', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Adds a product to the customer's cart or updates quantity if already present.
 */
export async function addToCart(
  customerId: string,
  productId: string,
  quantity: number
): Promise<ServerResult<{ added: boolean }>> {
  try {
    if (quantity < 1) {
      return { success: false, error: { message: 'Quantity must be at least 1', code: 'INVALID_QUANTITY' } };
    }

    const adminClient = createAdminClient();

    // Verify product is published, active, approved
    const { data: product, error: prodError } = await adminClient
      .from('products')
      .select('id, approval_status, publication_status, archive_status, moq, min_order_value, selling_price, discount')
      .eq('id', productId)
      .single();

    if (prodError || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    if (
      product.publication_status !== 'published' ||
      product.archive_status !== 'active' ||
      product.approval_status !== 'approved'
    ) {
      return {
        success: false,
        error: { message: 'This product is currently unavailable for RFQ', code: 'UNAVAILABLE' },
      };
    }

    // Get or create cart
    const cartRes = await getCustomerCart(customerId);
    if (!cartRes.success) return cartRes;

    const cartId = cartRes.data.cartId;

    // Check existing item
    const { data: existingItem } = await adminClient
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existingItem) {
      const nextQty = existingItem.quantity + quantity;
      if (nextQty < (product.moq || 1)) {
        return { success: false, error: { message: `Minimum order quantity is ${product.moq}`, code: 'BELOW_MOQ' } };
      }
      const unit = Math.max(0, (product.selling_price || 0) - (product.discount || 0));
      if (product.min_order_value && unit * nextQty < Number(product.min_order_value)) {
        return { success: false, error: { message: `Minimum order value for this product is ₹${Number(product.min_order_value).toLocaleString('en-IN')}`, code: 'BELOW_MIN_ORDER_VALUE' } };
      }
      await adminClient
        .from('cart_items')
        .update({ quantity: nextQty })
        .eq('id', existingItem.id);
    } else {
      if (quantity < (product.moq || 1)) {
        return { success: false, error: { message: `Minimum order quantity is ${product.moq}`, code: 'BELOW_MOQ' } };
      }
      const unit = Math.max(0, (product.selling_price || 0) - (product.discount || 0));
      if (product.min_order_value && unit * quantity < Number(product.min_order_value)) {
        return { success: false, error: { message: `Minimum order value for this product is ₹${Number(product.min_order_value).toLocaleString('en-IN')}`, code: 'BELOW_MIN_ORDER_VALUE' } };
      }
      await adminClient.from('cart_items').insert({
        cart_id: cartId,
        product_id: productId,
        quantity,
      });
    }

    return { success: true, data: { added: true } };
  } catch (error) {
    console.error('[addToCart] Error:', error);
    return { success: false, error: { message: 'Failed to add line item to RFQ workspace', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Updates the quantity of a cart item. Requires ownership via customerId.
 */
export async function updateCartItemQuantity(
  customerId: string,
  cartItemId: string,
  quantity: number
): Promise<ServerResult<{ updated: boolean }>> {
  try {
    if (quantity < 1) {
      return { success: false, error: { message: 'Quantity must be at least 1', code: 'INVALID_QUANTITY' } };
    }

    const adminClient = createAdminClient();
    const { data: row, error: fetchError } = await adminClient
      .from('cart_items')
      .select('id, quantity, cart:carts!inner(customer_id), product:products(moq, min_order_value, selling_price, discount)')
      .eq('id', cartItemId)
      .single();

    if (fetchError || !row) {
      return { success: false, error: { message: 'RFQ line item not found', code: 'NOT_FOUND' } };
    }

    const cartOwner = (row.cart as { customer_id?: string } | null)?.customer_id;
    if (!cartOwner || cartOwner !== customerId) {
      return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
    }

    const p = row.product as any;
    if (p && quantity < (p.moq || 1)) {
      return { success: false, error: { message: `Minimum order quantity is ${p.moq}`, code: 'BELOW_MOQ' } };
    }
    if (p?.min_order_value) {
      const unit = Math.max(0, (p.selling_price || 0) - (p.discount || 0));
      if (unit * quantity < Number(p.min_order_value)) {
        return { success: false, error: { message: `Minimum order value for this product is ₹${Number(p.min_order_value).toLocaleString('en-IN')}`, code: 'BELOW_MIN_ORDER_VALUE' } };
      }
    }

    const { error } = await adminClient
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateCartItemQuantity] Error:', error);
    return { success: false, error: { message: 'Failed to update item', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Removes an item from the customer's cart. Requires ownership via customerId.
 */
export async function removeCartItem(
  customerId: string,
  cartItemId: string
): Promise<ServerResult<{ removed: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { data: row, error: fetchError } = await adminClient
      .from('cart_items')
      .select('id, cart:carts!inner(customer_id)')
      .eq('id', cartItemId)
      .single();

    if (fetchError || !row) {
      return { success: false, error: { message: 'RFQ line item not found', code: 'NOT_FOUND' } };
    }

    const cartOwner = (row.cart as { customer_id?: string } | null)?.customer_id;
    if (!cartOwner || cartOwner !== customerId) {
      return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
    }

    const { error } = await adminClient.from('cart_items').delete().eq('id', cartItemId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { removed: true } };
  } catch (error) {
    console.error('[removeCartItem] Error:', error);
    return { success: false, error: { message: 'Failed to remove item', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Clears all items from the customer's cart.
 */
export async function clearCustomerCart(customerId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { data: cart } = await adminClient
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (cart) {
      await adminClient.from('cart_items').delete().eq('cart_id', cart.id);
    }
  } catch {
    // Non-blocking cleanup
  }
}
