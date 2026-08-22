import { NextResponse, type NextRequest } from 'next/server';
import {
  submitRfqFromCart,
  getCustomerRfqs,
  getRfqsForAdmin,
} from '@/lib/server/rfq/rfq-service';
import { requireAdmin, requireCustomer } from '@/lib/server/auth/get-session';
import type { RfqStatus } from '@/types/database';

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
      const result = await getCustomerRfqs(customerId);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = (searchParams.get('status') as RfqStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await getRfqsForAdmin({ page, limit, status, search });
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
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { customerId: _ignored, ...rfqData } = body;

    const result = await submitRfqFromCart(auth.session.profile.id, rfqData);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
