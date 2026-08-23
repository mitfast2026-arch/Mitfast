import { NextResponse, type NextRequest } from 'next/server';
import { restoreCategory } from '@/lib/server/categories/category-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await restoreCategory(params.id);
    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
