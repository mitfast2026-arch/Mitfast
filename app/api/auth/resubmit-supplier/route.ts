import { NextResponse, type NextRequest } from 'next/server';

/** @deprecated Prefer PUT /api/supplier/profile with `{ resubmit: true }`. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId: _supplierId, ...formData } = body;
    const origin = request.nextUrl.origin;
    const cookie = request.headers.get('cookie') || '';
    const res = await fetch(`${origin}/api/supplier/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify({ ...formData, resubmit: true }),
    });
    const json = await res.json();
    return NextResponse.json(json, {
      status: res.status,
      headers: {
        Deprecation: 'true',
        Link: '</api/supplier/profile>; rel="successor-version"',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
