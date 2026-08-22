import { NextResponse, type NextRequest } from 'next/server';
import { editOrder } from '@/lib/server/orders/order-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await editOrder({
      orderId: params.id,
      ...body,
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
