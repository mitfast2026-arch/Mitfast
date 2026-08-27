import { NextResponse, type NextRequest } from 'next/server';
import { getBusinessSettings, updateBusinessSettings } from '@/lib/server/settings/settings-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const result = await getBusinessSettings();
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, {
      headers: {
        // Settings change only via admin panel — safe to cache publicly.
        // stale-while-revalidate means users never wait for stale data.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const result = await updateBusinessSettings(body);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
