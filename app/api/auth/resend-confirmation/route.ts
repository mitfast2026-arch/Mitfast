import { NextResponse, type NextRequest } from 'next/server';

/** Resend OTP — proxies to /api/auth/otp/send (Resend → Brevo). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
