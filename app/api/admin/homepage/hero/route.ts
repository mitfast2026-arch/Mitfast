import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  saveHeroSlides,
  type HeroSlideInput,
} from '@/lib/server/homepage/homepage-cms-service';

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const slides = (body?.slides || []) as HeroSlideInput[];
    if (!Array.isArray(slides)) {
      return NextResponse.json(
        { success: false, error: { message: 'slides array required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await saveHeroSlides(slides);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[PUT /api/admin/homepage/hero]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
