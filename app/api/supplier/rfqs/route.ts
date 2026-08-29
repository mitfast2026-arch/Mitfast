import { NextRequest, NextResponse } from 'next/server';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { getSupplierRfqs } from '@/lib/server/rfq/rfq-service';
import { SUPPLIER_PORTAL_LIST_LIMIT } from '@/lib/client/portal-nav-prefetch';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || String(SUPPLIER_PORTAL_LIST_LIMIT), 10))
    );

    const result = await getSupplierRfqs(supplierId, { page, limit, search });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: any) {
    console.error('Supplier RFQs GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
