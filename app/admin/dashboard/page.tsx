'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Mail,
  Package,
  ShoppingCart,
  AlertCircle,
  Database,
} from 'lucide-react';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { onDashboardChanged } from '@/components/portal/ApprovalsCountContext';
import {
  HeroKpiCard,
  KpiCard,
  DataTable,
  StatusPill,
  SkeletonCard,
  SkeletonTableRows,
  EmptyState,
  ChartCard,
  PortalBarChart,
  PortalPieChart,
  type DataTableColumn,
} from '@/components/portal/ds';
import { selectChart } from '@/lib/portal/chart-selection';

type AttentionItem = {
  id: string;
  type: string;
  typeLabel: string;
  entity: string;
  party: string;
  timestamp: string;
  href: string;
  status: 'pending' | 'in_progress';
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  entityId: string;
};

type DashboardMetrics = {
  pendingItemsCount: number;
  pendingSuppliersCount: number;
  totalProducts: number;
  totalSuppliers: number;
  newEnquiriesCount: number;
  pendingRfqsCount: number;
  activeOrdersCount: number;
  productsAwaitingApprovalCount: number;
  dataSource: 'live';
};

type DashboardPayload = {
  metrics: DashboardMetrics;
  activity: ActivityItem[];
  attention: AttentionItem[];
  dataSource: 'live';
};

const SHOW_DATA_SOURCE_BADGE =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'staging' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'development';

function formatTime(ts?: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    default:
      return status.replace(/_/g, ' ');
  }
}

function activityHref(type: string) {
  if (
    type === 'supplier_registered' ||
    type === 'product_submitted' ||
    type === 'product_update_submitted'
  ) {
    return '/admin/approvals';
  }
  if (type === 'new_rfq' || type === 'rfq_accepted') return '/admin/rfqs';
  if (type === 'order_created') return '/admin/orders';
  if (type === 'new_enquiry') return '/admin/enquiries';
  return '/admin/dashboard';
}

function activityTone(type: string): 'pending' | 'completed' | 'in_progress' {
  if (type === 'order_created' || type === 'rfq_accepted') return 'completed';
  if (
    type === 'supplier_registered' ||
    type === 'product_submitted' ||
    type === 'product_update_submitted' ||
    type === 'new_enquiry' ||
    type === 'new_rfq'
  ) {
    return 'pending';
  }
  return 'in_progress';
}

function dedupeActivities(items: ActivityItem[]): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === item.type &&
      prev.entityId === item.entityId &&
      prev.title === item.title
    ) {
      continue;
    }
    out.push(item);
  }
  return out;
}

function liveNumber(value: number | undefined | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function AdminDashboardPage() {
  const cached = peekPortalCache<DashboardPayload>('/api/admin/dashboard');
  const [data, setData] = useState<DashboardPayload | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (showLoading = true) => {
    const existing = peekPortalCache<DashboardPayload>('/api/admin/dashboard');
    if (existing) {
      setData(existing.data);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const dashRes = await cachedApiGet<DashboardPayload>('/api/admin/dashboard', {
        force: showLoading && !existing,
      });

      if (dashRes.ok) {
        setData(dashRes.data);
        markPortalContentReady('/admin/dashboard');
      } else {
        // Do not keep stale numbers on failed refresh when we had no cache
        if (!existing) setData(null);
        setLoadError(dashRes.message || 'Failed to load live dashboard data');
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      if (!peekPortalCache('/api/admin/dashboard')) setData(null);
      setLoadError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    return onDashboardChanged(() => {
      void loadDashboard(false);
    });
  }, [loadDashboard]);

  useEffect(() => {
    const onFocus = () => {
      // Skip network when portal cache is still fresh (<45s) — same data, fewer Function hits
      const existing = peekPortalCache<DashboardPayload>('/api/admin/dashboard');
      if (existing && !existing.stale) return;
      void loadDashboard(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDashboard]);

  const metrics = data?.metrics;
  const attention = data?.attention || [];
  const activities = useMemo(
    () => dedupeActivities(data?.activity || []).slice(0, 8),
    [data?.activity]
  );

  const pendingItemsCount = liveNumber(metrics?.pendingItemsCount);
  const newEnquiriesCount = liveNumber(metrics?.newEnquiriesCount);
  const productsAwaitingApprovalCount = liveNumber(metrics?.productsAwaitingApprovalCount);
  const activeOrdersCount = liveNumber(metrics?.activeOrdersCount);
  const pendingRfqsCount = liveNumber(metrics?.pendingRfqsCount);
  const pendingSuppliersCount = liveNumber(metrics?.pendingSuppliersCount);

  /** Distinct live queue buckets — no double-counting a "Pending" aggregate */
  const operationsMix = useMemo(
    () => [
      { name: 'Enquiries', value: newEnquiriesCount },
      { name: 'Approvals', value: productsAwaitingApprovalCount },
      { name: 'RFQs', value: pendingRfqsCount },
      { name: 'Orders', value: activeOrdersCount },
      { name: 'Suppliers', value: pendingSuppliersCount },
    ],
    [
      newEnquiriesCount,
      productsAwaitingApprovalCount,
      pendingRfqsCount,
      activeOrdersCount,
      pendingSuppliersCount,
    ]
  );

  const mixWithValues = operationsMix.filter((d) => d.value > 0);
  const chartType = selectChart({
    kind: 'compare',
    categoryCount: mixWithValues.length || operationsMix.length,
  });

  const attentionColumns: DataTableColumn<AttentionItem>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (item) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-portal-text">{item.typeLabel}</span>
          <StatusPill
            label={statusLabel(item.status)}
            tone={item.status === 'pending' ? 'warning' : 'neutral'}
          />
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (item) => (
        <span className="font-medium text-sm text-portal-text line-clamp-2" title={item.entity}>
          {item.entity}
        </span>
      ),
    },
    {
      key: 'party',
      header: 'Supplier / Customer',
      render: (item) => (
        <span className="text-sm text-portal-muted line-clamp-1" title={item.party}>
          {item.party}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (item) => (
        <span className="text-xs font-mono text-portal-muted whitespace-nowrap">
          {formatTime(item.timestamp)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      className: 'text-right',
      render: (item) => (
        <Link
          href={item.href}
          className="saas-btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          Review
          <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  if (loading && !data) {
    return (
      <div className="portal-dashboard space-y-4 w-full max-w-full min-w-0">
        <div className="h-10 w-56 saas-skeleton" />
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTableRows rows={4} />
      </div>
    );
  }

  return (
    <div className="portal-dashboard flex w-full max-w-full min-w-0 flex-col gap-3 sm:gap-4">
      <div className="shrink-0">
        <AdminPageHeader
          title="Dashboard"
          description="Review pending items, RFQs, and orders across MITFAST."
          actions={
            <>
              {SHOW_DATA_SOURCE_BADGE ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border border-portal-success/40 bg-portal-success-soft text-portal-success"
                  title="Dashboard numbers come from live Postgres COUNT queries"
                >
                  <Database className="w-3 h-3" aria-hidden />
                  Live
                </span>
              ) : null}
              {pendingItemsCount > 0 ? (
                <a href="#needs-attention" className="saas-btn-secondary gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-portal-warning" aria-hidden />
                  {pendingItemsCount} pending
                </a>
              ) : (
                <span className="saas-btn-secondary gap-2 pointer-events-none opacity-70">
                  <CheckCircle2 className="w-3.5 h-3.5 text-portal-success" />
                  Clear
                </span>
              )}
              <button
                type="button"
                onClick={() => loadDashboard(false)}
                className="saas-btn-ghost"
                title="Refresh live data"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          }
        />
      </div>

      {loadError ? (
        <div className="shrink-0 rounded-2xl border border-portal-danger/30 bg-portal-danger-soft px-4 py-3 text-sm text-portal-danger flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" className="saas-btn-secondary text-xs" onClick={() => loadDashboard()}>
            Retry
          </button>
        </div>
      ) : null}

      {/* Static KPI strip */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
        <HeroKpiCard
          label="Pending items"
          value={pendingItemsCount}
          subtext={
            pendingItemsCount === 0
              ? 'No data yet — queue is clear'
              : 'Live count of items needing action'
          }
          icon={AlertCircle}
          href="#needs-attention"
        />
        <KpiCard
          label="New Enquiries"
          value={newEnquiriesCount}
          subtext={newEnquiriesCount === 0 ? 'No data yet' : 'status = new'}
          icon={Mail}
          href="/admin/enquiries"
        />
        <KpiCard
          label="Products Awaiting Approval"
          value={productsAwaitingApprovalCount}
          subtext={
            productsAwaitingApprovalCount === 0 ? 'No data yet' : 'pending / update_pending'
          }
          icon={Package}
          href="/admin/approvals"
        />
        <KpiCard
          label="Active Orders"
          value={activeOrdersCount}
          subtext={activeOrdersCount === 0 ? 'No data yet' : 'accepted / packing'}
          icon={ShoppingCart}
          href="/admin/orders"
        />
      </div>

      {/* Mid row: chart + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start min-w-0">
        <div className="lg:col-span-7 min-w-0">
          <ChartCard title="Overview" subtitle="Pending items by category">
            {mixWithValues.length === 0 ? (
              <EmptyState label="No data yet — all queue counts are zero" className="py-6" />
            ) : chartType === 'bar' && mixWithValues.length > 5 ? (
              <PortalBarChart data={mixWithValues} height={180} />
            ) : (
              <PortalPieChart data={mixWithValues} />
            )}
          </ChartCard>
        </div>
        <aside className="lg:col-span-5 min-w-0">
          <div className="saas-panel p-4 flex flex-col">
            <div className="flex items-baseline justify-between gap-2 mb-2 shrink-0">
              <h2 className="type-section">Recent Activity</h2>
              <span className="text-xs text-portal-muted">Last 14 days</span>
            </div>

            <div>
              {activities.length === 0 ? (
                <EmptyState label="No data yet — no events in the last 14 days" className="py-6" />
              ) : (
                <ol className="relative border-l border-portal-border ml-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {activities.map((act) => {
                    const tone = activityTone(act.type);
                    return (
                      <li key={act.id} className="relative pl-4 pb-2.5 last:pb-0">
                        <span
                          className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-portal-panel ${
                            tone === 'pending'
                              ? 'bg-portal-warning'
                              : tone === 'completed'
                                ? 'bg-portal-success'
                                : 'bg-portal-muted'
                          }`}
                          aria-hidden
                        />
                        <Link
                          href={activityHref(act.type)}
                          className="block group rounded-xl -mx-1 px-2 py-1 hover:bg-portal-hover transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className="text-sm font-medium text-portal-text group-hover:text-portal-accent line-clamp-1"
                              title={act.title}
                            >
                              {act.title}
                            </span>
                            <span className="text-[11px] font-mono text-portal-muted whitespace-nowrap shrink-0 pt-0.5">
                              {formatTime(act.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-portal-muted mt-0.5 line-clamp-2 leading-relaxed">
                            {act.description}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Needs Attention */}
      <section id="needs-attention" className="flex flex-col saas-panel min-w-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 shrink-0 border-b border-portal-border">
          <div>
            <h2 className="type-section">Needs Attention</h2>
            <p className="type-desc">
              Live actionable rows
              {pendingItemsCount > attention.length
                ? ` · showing ${attention.length} of ${pendingItemsCount}`
                : ''}
            </p>
          </div>
          {pendingItemsCount > 0 ? (
            <StatusPill label={String(pendingItemsCount)} tone="warning" />
          ) : null}
        </div>

        <div>
          {attention.length === 0 ? (
            <div className="p-4">
              <EmptyState
                label="No data yet — nothing waiting for review"
                icon={CheckCircle2}
              />
            </div>
          ) : (
            <DataTable
              className="!rounded-none !border-0"
              columns={attentionColumns}
              rows={attention}
              emptyLabel="No data yet"
            />
          )}
        </div>
      </section>
    </div>
  );
}
