import { NextResponse, type NextRequest } from 'next/server';
import { adminNegotiateRfq, supplierOwnsRfqItems } from '@/lib/server/rfq/rfq-service';
import { requireAdminOrSupplierOnRfq } from '@/lib/server/auth/get-session';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdminOrSupplierOnRfq(params.id, supplierOwnsRfqItems);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await adminNegotiateRfq(
      {
        rfqId: params.id,
        items: body.items,
      },
      {
        isAdmin: auth.isAdmin,
        supplierId: auth.isAdmin ? null : auth.session.supplier?.id ?? null,
      }
    );

    if (!result.success) {
      const status =
        result.error?.code === 'FORBIDDEN'
          ? 403
          : result.error?.code === 'DATABASE_MISCONFIGURED'
            ? 503
            : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
