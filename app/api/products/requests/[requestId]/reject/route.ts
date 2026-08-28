import { NextResponse, type NextRequest } from 'next/server';

/** @deprecated Prefer POST /api/products/[id]/reject — accepts product or request id. */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const origin = request.nextUrl.origin;
    const cookie = request.headers.get('cookie') || '';
    const body = await request.text();
    const res = await fetch(`${origin}/api/products/${params.requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        cookie,
      },
      body,
    });
    const json = await res.json();
    return NextResponse.json(json, {
      status: res.status,
      headers: {
        Deprecation: 'true',
        Link: '</api/products/[id]/reject>; rel="successor-version"',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
