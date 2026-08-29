import { NextResponse, type NextRequest } from 'next/server';
import { adminAcceptRfq } from '@/lib/server/rfq/rfq-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

/** Accept RFQ header — admin only (prevents cross-supplier control). */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
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
