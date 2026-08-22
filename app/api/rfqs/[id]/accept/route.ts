import { NextResponse, type NextRequest } from 'next/server';
import { adminAcceptRfq, supplierOwnsRfqItems } from '@/lib/server/rfq/rfq-service';
import { requireAdminOrSupplierOnRfq } from '@/lib/server/auth/get-session';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrSupplierOnRfq(params.id, supplierOwnsRfqItems);
    if (!auth.ok) return auth.response;

    const result = await adminAcceptRfq(params.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
