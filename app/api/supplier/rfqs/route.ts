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
    const adminClient = createAdminClient();

    const { data: supplierProducts } = await adminClient
      .from('products')
      .select('id')
      .eq('supplier_id', supplierId);

    const productIds: string[] = (supplierProducts || []).map((p: { id: string }) => p.id);

    if (productIds.length === 0) {
      return NextResponse.json({ success: true, data: { rfqs: [] } });
    }

    const { data: rfqItems, error: itemsError } = await adminClient
      .from('rfq_items')
      .select('id, rfq_id, product_id, product_name_snapshot, original_quantity, final_quantity, created_at, product:products(sku), rfq:rfqs(id, rfq_number, status, rejection_reason, created_at, updated_at)')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (itemsError) throw itemsError;

    const rfqMap = new Map<string, any>();
    for (const item of rfqItems || []) {
      const rfq = (item as any).rfq;
      if (!rfq) continue;
      if (!rfqMap.has(rfq.id)) {
        rfqMap.set(rfq.id, {
          id: rfq.id,
          rfq_number: rfq.rfq_number,
          status: rfq.status,
          rejection_reason: rfq.rejection_reason,
          created_at: rfq.created_at,
          updated_at: rfq.updated_at,
          items: [],
        });
      }
      rfqMap.get(rfq.id).items.push({
        id: item.id,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        original_quantity: item.original_quantity,
        final_quantity: item.final_quantity,
        sku: (item as any).product?.sku || null,
      });
    }

    let rfqs = Array.from(rfqMap.values());

    if (search) {
      rfqs = rfqs.filter((r) => r.rfq_number?.toLowerCase().includes(search));
    }

    return NextResponse.json({ success: true, data: { rfqs } });
  } catch (err: any) {
    console.error('Supplier RFQs GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
