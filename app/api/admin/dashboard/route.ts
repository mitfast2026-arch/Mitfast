import { NextResponse } from 'next/server';
import { getAdminDashboardMetrics, getAdminRecentActivity } from '@/lib/server/admin/dashboard-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const [metricsResult, activityResult] = await Promise.all([
      getAdminDashboardMetrics(),
      getAdminRecentActivity(20),
    ]);

    if (!metricsResult.success) {
      return NextResponse.json(metricsResult, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics: metricsResult.data,
        activity: activityResult.success ? activityResult.data.activity : [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
