import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/server/auth/get-session';
import { getCustomerBadgeCounts } from '@/lib/server/customer/badge-counts';

export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const result = await getCustomerBadgeCounts(auth.session.profile.id);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[GET /api/customer/badge-counts]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
