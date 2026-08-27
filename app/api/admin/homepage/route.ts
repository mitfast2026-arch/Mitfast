import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { getHomepageAdminBundle } from '@/lib/server/homepage/homepage-cms-service';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await getHomepageAdminBundle();
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[GET /api/admin/homepage]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
