import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  uploadCategoryImageFile,
  removeCategoryImage,
} from '@/lib/server/categories/category-service';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Image file is required', code: 'VALIDATION_ERROR' },
        },
        { status: 400 }
      );
    }

    const result = await uploadCategoryImageFile(params.id, file);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/categories/[id]/image] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await removeCategoryImage(params.id);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[DELETE /api/categories/[id]/image] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
      },
      { status: 500 }
    );
  }
}
