import { NextResponse, type NextRequest } from 'next/server';
import { convertRfqToOrder } from '@/lib/server/orders/order-service';
import { getServerSession, unauthorizedResponse, forbiddenResponse } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    if (session.profile.role !== 'admin' && session.profile.role !== 'customer') {
      return forbiddenResponse();
    }

    if (session.profile.role === 'customer') {
      const adminClient = createAdminClient();
      const { data: rfq } = await adminClient
        .from('rfqs')
        .select('customer_id')
        .eq('id', params.id)
        .maybeSingle();
      if (!rfq || rfq.customer_id !== session.profile.id) {
        return forbiddenResponse();
      }
    }

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Idempotency-Key header is required',
            code: 'IDEMPOTENCY_REQUIRED',
          },
        },
        { status: 400 }
      );
    }
    const result = await convertRfqToOrder({ rfqId: params.id }, idempotencyKey);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
