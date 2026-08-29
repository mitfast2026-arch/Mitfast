import { NextRequest, NextResponse } from 'next/server';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { getSupplierRfqDetail } from '@/lib/server/rfq/rfq-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const result = await getSupplierRfqDetail(supplierId, params.id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: { message: result.error.message } },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: { rfq: result.data } });
  } catch (err: any) {
    console.error('Supplier RFQ detail GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
