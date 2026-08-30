import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  saveCarouselSlots,
  type CarouselSlotInput,
} from '@/lib/server/homepage/homepage-cms-service';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const slots = (body?.slots || []) as CarouselSlotInput[];
    if (!Array.isArray(slots)) {
      return NextResponse.json(
        { success: false, error: { message: 'slots array required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await saveCarouselSlots(slots);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[PUT /api/admin/homepage/products]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
