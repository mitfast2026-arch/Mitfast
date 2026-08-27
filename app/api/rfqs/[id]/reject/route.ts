import { NextResponse, type NextRequest } from 'next/server';
import { adminRejectRfq } from '@/lib/server/rfq/rfq-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

/** Reject RFQ header — admin only (prevents cross-supplier control). */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await adminRejectRfq({
      rfqId: params.id,
      rejectionReason: body.rejectionReason,
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
