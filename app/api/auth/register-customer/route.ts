import { NextResponse } from 'next/server';

/** Password customer registration disabled — use Google or email OTP + /api/auth/complete-profile. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Password registration is disabled. Use Google or email OTP.',
        code: 'DEPRECATED',
      },
    },
    { status: 410 }
  );
}
