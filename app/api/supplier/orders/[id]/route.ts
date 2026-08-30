import { NextRequest, NextResponse } from 'next/server';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { getSupplierOrderDetail, markSupplierOrderContacted } from '@/lib/server/orders/order-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const result = await getSupplierOrderDetail(supplierId, params.id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: { message: result.error.message } },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: { order: result.data } });
  } catch (err: any) {
    console.error('Supplier order detail GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    let contacted = true;

    try {
      const body = await request.json();
      if (typeof body.contacted === 'boolean') {
        contacted = body.contacted;
      }
    } catch {
      // Body optional; defaults to true
    }

    const result = await markSupplierOrderContacted(supplierId, params.id, contacted);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: { message: result.error.message } },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: any) {
    console.error('Supplier order update error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
