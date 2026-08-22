import { NextResponse } from 'next/server';
import { getApprovalCenterCounts } from '@/lib/server/admin/dashboard-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await getApprovalCenterCounts();
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
