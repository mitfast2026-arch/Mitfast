import { NextResponse, type NextRequest } from 'next/server';
import { updateCategory } from '@/lib/server/categories/category-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await updateCategory({ categoryId: params.id, ...body });
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
