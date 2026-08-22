import { NextResponse, type NextRequest } from 'next/server';
import { adminNegotiateRfq, supplierOwnsRfqItems } from '@/lib/server/rfq/rfq-service';
import { requireAdminOrSupplierOnRfq } from '@/lib/server/auth/get-session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrSupplierOnRfq(params.id, supplierOwnsRfqItems);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await adminNegotiateRfq({
      rfqId: params.id,
      items: body.items,
    });

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
