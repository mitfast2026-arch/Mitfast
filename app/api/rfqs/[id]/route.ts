import { NextResponse, type NextRequest } from 'next/server';
import {
  getRfqDetail,
  adminEditRfq,
  adminDeleteRfq,
  supplierOwnsRfqItems,
} from '@/lib/server/rfq/rfq-service';
import {
  getServerSession,
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/server/auth/get-session';

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const role = session.profile.role;
    if (role === 'admin') {
      const result = await getRfqDetail(params.id, { isAdmin: true });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (role === 'customer') {
      const result = await getRfqDetail(params.id, { customerId: session.profile.id });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (role === 'supplier' && session.supplier?.id) {
      const owns = await supplierOwnsRfqItems(session.supplier.id, params.id);
      if (!owns) return forbiddenResponse();

      const result = await getRfqDetail(params.id, { supplierId: session.supplier.id });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    return forbiddenResponse();
  } catch (error) {
    console.error('[GET /api/rfqs/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await adminEditRfq({
      rfqId: params.id,
      ...body,
    });

    if (!result.success) {
      const status =
        result.error?.code === 'NOT_FOUND'
          ? 404
          : result.error?.code === 'DATABASE_MISCONFIGURED'
            ? 503
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PUT /api/rfqs/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await adminDeleteRfq(params.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[DELETE /api/rfqs/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
