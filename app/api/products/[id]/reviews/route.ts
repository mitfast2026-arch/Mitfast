import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession, requireCustomer } from '@/lib/server/auth/get-session';
import { getProductReviews, upsertProductReview } from '@/lib/server/reviews/review-service';
import { assertRateLimit } from '@/lib/server/db/rate-limit';

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const productId = params.id;

  try {
    const session = await getServerSession();
    const customerId = session?.profile?.role === 'customer' ? session.profile.id : null;

    const result = await getProductReviews(productId, customerId);

    if (!result.success) {
      const status = result.error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[GET /api/products/:id/reviews] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const productId = params.id;

  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const customerId = auth.session.profile.id;

    // Rate limiting: 10 review submissions / minute per customer
    const rateLimit = await assertRateLimit({
      scope: 'review_write',
      key: customerId,
      windowSeconds: 60,
      maxHits: 10,
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Too many review attempts. Please wait a minute and try again.',
            code: 'RATE_LIMITED',
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await upsertProductReview(customerId, productId, body);

    if (!result.success) {
      let status = 400;
      if (result.error.code === 'NOT_ELIGIBLE') status = 403;
      else if (result.error.code === 'NOT_FOUND') status = 404;
      else if (result.error.code === 'INTERNAL_ERROR' || result.error.code === 'DATABASE_ERROR') status = 500;

      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, {
      status: result.data.isUpdated ? 200 : 201,
    });
  } catch (error) {
    console.error('[POST /api/products/:id/reviews] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return POST(request, props);
}
