import { NextResponse } from 'next/server';
import {
  getAdminDashboardMetrics,
  getAdminRecentActivity,
  getNeedsAttentionItems,
} from '@/lib/server/admin/dashboard-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

/** Never serve a static/cached snapshot of dashboard counts */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const [metricsResult, activityResult, attentionResult] = await Promise.all([
      getAdminDashboardMetrics(),
      getAdminRecentActivity(10),
      getNeedsAttentionItems(25),
    ]);

    if (!metricsResult.success) {
      return NextResponse.json(metricsResult, { status: 400 });
    }

    if (!activityResult.success) {
      return NextResponse.json(activityResult, { status: 400 });
    }

    if (!attentionResult.success) {
      return NextResponse.json(attentionResult, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          metrics: metricsResult.data,
          activity: activityResult.data.activity,
          attention: attentionResult.data.items,
          dataSource: 'live' as const,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/admin/dashboard]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
