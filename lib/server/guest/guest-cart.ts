import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { aggregateCartTotals, priceCartLine } from '@/lib/server/cart/cart-line-pricing';
import type { CartItemWithProduct, CustomerCartData } from '@/lib/server/cart/cart-service';

type ProductRow = {
  id: string;
  name: string;
  supplier_id?: string | null;
  selling_price: number;
  discount: number | null;
  gst_rate: number | null;
  gst_included: boolean | null;
  moq: number | null;
  min_order_value: number | null;
  ribbon_label: string | null;
  approval_status: string;
  publication_status: string;
  archive_status: string;
  category?: { name?: string } | null;
  images?: { image_url: string; is_primary?: boolean; sort_order?: number }[] | null;
};

function formatGuestItems(
  rows: { id: string; product_id: string; quantity: number; added_at: string; product: ProductRow | null }[]
): CustomerCartData {
  const items: CartItemWithProduct[] = [];
  const aggregateLines: {
    itemTotal: number;
    lineGst: number;
    lineGrandTotal: number;
    isAvailable: boolean;
  }[] = [];

  for (const item of rows) {
    const p = item.product;
    if (!p) continue;

    const isAvailable =
      p.publication_status === 'published' &&
      p.archive_status === 'active' &&
      p.approval_status === 'approved';

    const priced = priceCartLine(
      {
        selling_price: p.selling_price || 0,
        discount: p.discount || 0,
        gst_rate: p.gst_rate || 0,
        gst_included: p.gst_included || false,
      },
      item.quantity
    );
    const unitPrice = priced.actualUnitPrice;
    const itemTotal = priced.itemTotal;
    aggregateLines.push({
      itemTotal,
      lineGst: priced.lineGst,
      lineGrandTotal: priced.lineGrandTotal,
      isAvailable,
    });

    const primaryImg =
      p.images?.find((img) => img.is_primary)?.image_url || p.images?.[0]?.image_url || null;

    items.push({
      id: item.id,
      productId: item.product_id,
      quantity: item.quantity,
      addedAt: item.added_at,
      product: {
        id: p.id,
        name: p.name,
        supplierId: p.supplier_id ?? null,
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
      subtotalPerUnit: priced.subtotalPerUnit,
    });
  }

  const totals = aggregateCartTotals(aggregateLines);

  return {
    cartId: 'guest',
    items,
    itemCount: items.reduce((acc, curr) => acc + curr.quantity, 0),
    subtotal: totals.subtotal,
    totalGst: totals.totalGst,
    grandTotal: totals.grandTotal,
  };
}

const PRODUCT_SELECT = `
  id, name, supplier_id, selling_price, discount, gst_rate, gst_included, moq, min_order_value, ribbon_label,
  approval_status, publication_status, archive_status,
  category:categories(name),
  images:product_images(image_url, is_primary, sort_order)
`;

export async function getGuestCart(guestSessionId: string): Promise<ServerResult<CustomerCartData>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('guest_cart_items')
      .select(`id, product_id, quantity, added_at, product:products(${PRODUCT_SELECT})`)
      .eq('guest_session_id', guestSessionId)
      // Primary image is picked in JS — do not order/limit on product_images
      // via foreignTable here (PostgREST rejects embeds nested under guest_cart_items).
      .order('added_at', { ascending: false });

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: formatGuestItems((data || []) as any),
    };
  } catch (error) {
    console.error('[getGuestCart]', error);
    return { success: false, error: { message: 'Failed to load guest cart', code: 'INTERNAL_ERROR' } };
  }
}

export async function addToGuestCart(
  guestSessionId: string,
  productId: string,
  quantity: number
): Promise<ServerResult<{ added: boolean }>> {
  try {
    if (quantity < 1) {
      return { success: false, error: { message: 'Quantity must be at least 1', code: 'INVALID_QUANTITY' } };
    }

    const admin = createAdminClient();
    const { data: product, error: prodError } = await admin
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
        error: { message: 'This product is currently unavailable', code: 'UNAVAILABLE' },
      };
    }

    const moq = product.moq || 1;
    const { data: existing } = await admin
      .from('guest_cart_items')
      .select('quantity')
      .eq('guest_session_id', guestSessionId)
      .eq('product_id', productId)
      .maybeSingle();

    const projectedQty = (existing?.quantity || 0) + quantity;
    if (projectedQty < moq) {
      return {
        success: false,
        error: { message: `Minimum order quantity is ${moq}`, code: 'BELOW_MOQ' },
      };
    }

    const unit = Math.max(0, (product.selling_price || 0) - (product.discount || 0));
    if (product.min_order_value && unit * projectedQty < Number(product.min_order_value)) {
      return {
        success: false,
        error: {
          message: `Minimum order value for this product is ₹${Number(product.min_order_value).toLocaleString('en-IN')}`,
          code: 'BELOW_MIN_ORDER_VALUE',
        },
      };
    }

    const { error: rpcError } = await (admin as any).rpc('increment_guest_cart_item_quantity', {
      p_guest_session_id: guestSessionId,
      p_product_id: productId,
      p_delta: quantity,
      p_moq: moq,
    });

    if (rpcError) {
      if (rpcError.message?.includes('Below MOQ')) {
        return {
          success: false,
          error: { message: `Minimum order quantity is ${moq}`, code: 'BELOW_MOQ' },
        };
      }
      return { success: false, error: { message: rpcError.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { added: true } };
  } catch (error) {
    console.error('[addToGuestCart]', error);
    return { success: false, error: { message: 'Failed to add to cart', code: 'INTERNAL_ERROR' } };
  }
}

export async function updateGuestCartItemQuantity(
  guestSessionId: string,
  cartItemId: string,
  quantity: number
): Promise<ServerResult<{ updated: boolean }>> {
  try {
    if (quantity < 1) {
      return { success: false, error: { message: 'Quantity must be at least 1', code: 'INVALID_QUANTITY' } };
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('guest_cart_items')
      .select('id, guest_session_id, product:products(moq, min_order_value, selling_price, discount)')
      .eq('id', cartItemId)
      .maybeSingle();

    if (error || !row || row.guest_session_id !== guestSessionId) {
      return { success: false, error: { message: 'Cart item not found', code: 'NOT_FOUND' } };
    }

    const p = row.product as {
      moq?: number;
      min_order_value?: number | null;
      selling_price?: number;
      discount?: number | null;
    } | null;
    const moq = p?.moq || 1;
    if (quantity < moq) {
      return { success: false, error: { message: `Minimum order quantity is ${moq}`, code: 'BELOW_MOQ' } };
    }

    if (p?.min_order_value) {
      const unit = Math.max(0, (p.selling_price || 0) - (p.discount || 0));
      if (unit * quantity < Number(p.min_order_value)) {
        return {
          success: false,
          error: {
            message: `Minimum order value for this product is ₹${Number(p.min_order_value).toLocaleString('en-IN')}`,
            code: 'BELOW_MIN_ORDER_VALUE',
          },
        };
      }
    }

    const { error: updErr } = await admin
      .from('guest_cart_items')
      .update({ quantity })
      .eq('id', cartItemId);

    if (updErr) {
      return { success: false, error: { message: updErr.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateGuestCartItemQuantity]', error);
    return { success: false, error: { message: 'Failed to update item', code: 'INTERNAL_ERROR' } };
  }
}

export async function removeGuestCartItem(
  guestSessionId: string,
  cartItemId: string
): Promise<ServerResult<{ removed: boolean }>> {
  try {
    const admin = createAdminClient();
    const { error: delErr } = await admin
      .from('guest_cart_items')
      .delete()
      .eq('id', cartItemId)
      .eq('guest_session_id', guestSessionId);

    if (delErr) {
      return { success: false, error: { message: delErr.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { removed: true } };
  } catch (error) {
    console.error('[removeGuestCartItem]', error);
    return { success: false, error: { message: 'Failed to remove item', code: 'INTERNAL_ERROR' } };
  }
}

export async function clearGuestCart(guestSessionId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('guest_cart_items').delete().eq('guest_session_id', guestSessionId);
  } catch {
    /* non-blocking */
  }
}
