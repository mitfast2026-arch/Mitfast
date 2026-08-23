import { NextResponse } from 'next/server';
import { getApprovalCenterCounts } from '@/lib/server/admin/dashboard-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await getApprovalCenterCounts();
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
