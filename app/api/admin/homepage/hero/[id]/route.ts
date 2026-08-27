import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { deleteHeroSlide } from '@/lib/server/homepage/homepage-cms-service';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'id required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await deleteHeroSlide(id);
    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[DELETE /api/admin/homepage/hero/[id]]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
