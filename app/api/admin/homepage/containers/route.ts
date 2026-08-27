import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  resetContainersImage,
  uploadContainersImage,
} from '@/lib/server/homepage/homepage-cms-service';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const action = String(form.get('action') || 'upload');

    if (action === 'reset') {
      const result = await resetContainersImage();
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    const file = form.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { success: false, error: { message: 'file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await uploadContainersImage(file as File);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[POST /api/admin/homepage/containers]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
