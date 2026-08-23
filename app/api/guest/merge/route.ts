import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/server/auth/get-session';
import { mergeGuestStateIntoCustomer } from '@/lib/server/guest/merge-guest-state';

/** Merge guest cart/wishlist into the authenticated buyer account. Idempotent. */
export async function POST() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const result = await mergeGuestStateIntoCustomer(auth.session.profile.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/guest/merge]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
