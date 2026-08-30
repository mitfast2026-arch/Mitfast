import { NextResponse, type NextRequest } from 'next/server';
import { trackStorefrontProductView } from '@/lib/server/products/storefront-detail';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const productId = params.id;

    // Extract visitor identifier from header or IP
    const visitorHeader = request.headers.get('x-visitor-id')?.trim();
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anon';
    const sampleKey =
      visitorHeader && visitorHeader.length >= 8 ? `${visitorHeader}:${clientIp}` : clientIp;

    const result = await trackStorefrontProductView(productId, sampleKey);

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND'
          ? 404
          : result.error.code === 'VALIDATION_ERROR'
            ? 400
            : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/products/[id]/view] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
