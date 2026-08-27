import { NextResponse, type NextRequest } from 'next/server';
import { convertEnquiryToOrder } from '@/lib/server/orders/order-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const result = await convertEnquiryToOrder(body, idempotencyKey);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
