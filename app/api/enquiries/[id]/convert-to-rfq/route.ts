import { NextResponse, type NextRequest } from 'next/server';
import { createRfqFromEnquiry } from '@/lib/server/rfq/rfq-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Idempotency-Key header is required', code: 'IDEMPOTENCY_REQUIRED' },
        },
        { status: 400 }
      );
    }
    const result = await createRfqFromEnquiry(
      {
        enquiryId: params.id,
        ...body,
      },
      idempotencyKey
    );

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
