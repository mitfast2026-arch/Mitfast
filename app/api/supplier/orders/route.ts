import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSupplier } from '@/lib/server/auth/get-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const adminClient = createAdminClient();

    const { data: orderItems, error: itemsError } = await adminClient
      .from('order_items')
      .select('id, product_id, product_name_snapshot, quantity, created_at, order:orders(id, order_number, status, created_at, updated_at)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (itemsError) throw itemsError;

    const orderMap = new Map<string, any>();
    for (const item of orderItems || []) {
      const order = (item as any).order;
      if (!order) continue;
      if (!orderMap.has(order.id)) {
        orderMap.set(order.id, {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items: [],
        });
      }
      orderMap.get(order.id).items.push({
        id: item.id,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        quantity: item.quantity,
      });
    }

    let orders = Array.from(orderMap.values());

    if (search) {
      orders = orders.filter((o) => o.order_number?.toLowerCase().includes(search));
    }

    return NextResponse.json({ success: true, data: { orders } });
  } catch (err: any) {
    console.error('Supplier Orders GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
