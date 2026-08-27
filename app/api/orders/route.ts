import { NextResponse, type NextRequest } from 'next/server';
import {
  createManualOrder,
  getCustomerOrders,
  getOrdersForAdmin,
} from '@/lib/server/orders/order-service';
import { requireAdmin, requireCustomer } from '@/lib/server/auth/get-session';
import type { OrderStatus, PaymentStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (customerId) {
      const auth = await requireCustomer();
      if (!auth.ok) return auth.response;
      if (customerId !== auth.session.profile.id) {
        return NextResponse.json(
          { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      }
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = (Math.max(1, page) - 1) * limit;
      const result = await getCustomerOrders(customerId, { limit, offset });
      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = (searchParams.get('status') as OrderStatus) || undefined;
    const paymentStatus = (searchParams.get('paymentStatus') as PaymentStatus) || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const search = searchParams.get('search') || undefined;
    const convertedOnly = searchParams.get('convertedOnly') === 'true';

    const result = await getOrdersForAdmin({ page, limit, status, paymentStatus, supplierId, search, convertedOnly });
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const result = await createManualOrder(body, idempotencyKey);

    if (!result.success) {
      const status = result.error?.code === 'IDEMPOTENCY_IN_PROGRESS' ? 409 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
