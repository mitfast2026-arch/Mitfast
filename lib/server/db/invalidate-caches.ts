import { invalidateDashboardMetricsCache } from '@/lib/server/admin/dashboard-service';
import { invalidateServerSettings } from '@/lib/server/settings/settings-service';

/** Call after admin mutations that affect dashboard KPIs or settings. */
export function invalidateAdminCaches(): void {
  invalidateDashboardMetricsCache();
}

export function invalidateSettingsCaches(): void {
  invalidateServerSettings();
}
