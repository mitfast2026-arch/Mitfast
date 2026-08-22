'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Building2,
  FileText,
  ShoppingCart,
  Mail,
  CheckSquare,
  Clock,
  RefreshCw,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';

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

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [approvalsData, setApprovalsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'products'>('suppliers');
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [dashRes, appRes] = await Promise.all([
        apiGet<{ metrics: any; activity: any[] }>('/api/admin/dashboard'),
        apiGet<{ pendingSuppliers: any[]; newProductRequests: any[]; productUpdateRequests: any[] }>(
          '/api/admin/approvals'
        ),
      ]);

      if (dashRes.ok) setData(dashRes.data);
      if (appRes.ok) setApprovalsData(appRes.data);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleApproveSupplier(supplierId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/suppliers/${supplierId}/approve`), {
      key: mutationKey(supplierId, 'approve-supplier'),
      onSuccess: () => {
        setApprovalsData((prev: any) => ({
          ...prev,
          pendingSuppliers: (prev?.pendingSuppliers || []).filter((s: any) => s.id !== supplierId),
        }));
        notifyApprovalsChanged();
      },
      onError: (msg) => setActionError(msg),
    });
  }

  async function handleApproveProduct(requestId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/products/requests/${requestId}/approve`), {
      key: mutationKey(requestId, 'approve-product'),
      onSuccess: () => {
        setApprovalsData((prev: any) => ({
          ...prev,
          newProductRequests: (prev?.newProductRequests || []).filter((r: any) => r.id !== requestId),
          productUpdateRequests: (prev?.productUpdateRequests || []).filter((r: any) => r.id !== requestId),
        }));
        notifyApprovalsChanged();
      },
      onError: (msg) => setActionError(msg),
    });
  }

  const metrics = data?.metrics || {};
  const activities = data?.activity || [];
  const suppliersQueue = approvalsData?.pendingSuppliers || [];
  const productsQueue = [
    ...(approvalsData?.newProductRequests || []),
    ...(approvalsData?.productUpdateRequests || []),
  ];
  const pendingApprovalsCount = suppliersQueue.length + (metrics.productsAwaitingApprovalCount || 0);

  const kpis = [
    { label: 'Products', value: metrics.totalProducts || 0, href: '/admin/products', icon: Package, meta: 'Active catalog' },
    { label: 'Suppliers', value: metrics.totalSuppliers || 0, href: '/admin/suppliers', icon: Building2, meta: 'Registered partners' },
    { label: 'Pending RFQs', value: metrics.pendingRfqsCount || 0, href: '/admin/rfqs', icon: FileText, meta: 'Awaiting quote' },
    { label: 'Active production orders', value: metrics.activeOrdersCount || 0, href: '/admin/orders', icon: ShoppingCart, meta: 'In production' },
  ];

  if (loading && !data) {
    return (
      <div className="space-y-6 w-full">
        <div className="h-10 w-64 bg-[#ECEEF0] rounded-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="saas-kpi-card h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 saas-panel h-80" />
          <div className="lg:col-span-5 saas-panel h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Operations overview</h1>
          <p className="type-subtitle">Catalog, partners, RFQs, orders, and the approval queue.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {pendingApprovalsCount > 0 && (
            <Link href="/admin/approvals" className="saas-btn-secondary gap-2">
              <AlertCircle className="w-4 h-4" />
              {pendingApprovalsCount} pending
            </Link>
          )}
          <button onClick={() => loadDashboard()} className="saas-btn-ghost" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 saas-panel p-6 sm:p-7 flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="type-kpi-label">New enquiries</div>
              <div className="type-kpi mt-2">{metrics.newEnquiriesCount || 0}</div>
              <p className="type-kpi-meta mt-2">Unread CAD and drawing leads</p>
            </div>
            <div className="saas-icon-well-lg">
              <Mail className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { href: '/admin/approvals', icon: CheckSquare, label: 'Approvals' },
              { href: '/admin/rfqs', icon: FileText, label: 'RFQs' },
              { href: '/admin/orders', icon: ShoppingCart, label: 'Production orders' },
              { href: '/admin/products', icon: Package, label: 'Catalog' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 group">
                  <span className="saas-icon-well group-hover:bg-[#D7D9DC] transition-colors">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] text-[#6B7280]">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <Link href="/admin/approvals" className="lg:col-span-3 saas-kpi-card p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="type-kpi-label">Awaiting approval</span>
            <span className="saas-icon-well">
              <CheckSquare className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="type-kpi">{metrics.productsAwaitingApprovalCount || 0}</div>
            <div className="type-kpi-meta mt-1.5">Product submissions</div>
          </div>
        </Link>

        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link key={kpi.label} href={kpi.href} className="saas-kpi-card p-5 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="type-kpi-label">{kpi.label}</span>
                  <span className="saas-icon-well h-8 w-8">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-[#111315]">{kpi.value}</div>
                  <div className="type-kpi-meta mt-1">{kpi.meta}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 saas-panel p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="type-section">Moderation queue</h2>
              <p className="type-desc">Supplier registrations and catalog proposals.</p>
            </div>
            <div className="saas-segmented">
              <button
                onClick={() => setActiveTab('suppliers')}
                className={activeTab === 'suppliers' ? 'saas-tab-active' : 'saas-tab-inactive'}
              >
                Suppliers ({suppliersQueue.length})
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={activeTab === 'products' ? 'saas-tab-active' : 'saas-tab-inactive'}
              >
                Products ({productsQueue.length})
              </button>
            </div>
          </div>

          {activeTab === 'suppliers' ? (
            suppliersQueue.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="saas-icon-well-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="type-empty-title">Queue is clear</div>
                <div className="type-empty-body max-w-sm">No supplier registrations pending review.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliersQueue.slice(0, 4).map((sup: any) => (
                  <div key={sup.id} className="saas-inset-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="saas-badge-neutral">Pending</span>
                        <span className="font-medium text-sm text-[#111315] truncate">{sup.company_name}</span>
                      </div>
                      <div className="type-meta normal-case tracking-normal">
                        {sup.contact_person} • {sup.email} • {sup.country}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => handleApproveSupplier(sup.id)}
                        disabled={isPending(mutationKey(sup.id, 'approve-supplier'))}
                        className="saas-btn-primary flex-1 sm:flex-initial gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <Link href="/admin/approvals" className="saas-btn-secondary flex-1 sm:flex-initial text-center">
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : productsQueue.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="saas-icon-well-lg">
                <Package className="w-5 h-5" />
              </div>
              <div className="type-empty-title">Catalog is up to date</div>
              <div className="type-empty-body max-w-sm">No product submissions pending review.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {productsQueue.slice(0, 4).map((req: any) => (
                <div key={req.id} className="saas-inset-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="saas-badge-neutral">
                        {req.request_type === 'update' ? 'Update' : 'New product'}
                      </span>
                      <span className="font-medium text-sm text-[#111315] truncate">
                        {req.proposed_data?.name || req.product?.name}
                      </span>
                    </div>
                    <div className="type-meta normal-case tracking-normal">
                      {req.product?.supplier?.company_name || 'Partner'}
                      {req.proposed_data?.supplier_price != null && (
                        <> • ₹{Number(req.proposed_data.supplier_price).toLocaleString('en-IN')}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleApproveProduct(req.id)}
                      disabled={isPending(mutationKey(req.id, 'approve-product'))}
                      className="saas-btn-primary flex-1 sm:flex-initial gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <Link href="/admin/approvals" className="saas-btn-secondary flex-1 sm:flex-initial text-center">
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 saas-panel p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6B7280]" />
              <h2 className="type-section">Live activity</h2>
            </div>
            <span className="type-meta bg-[#F7F7F8] px-3 py-1 rounded-full border border-[#E2E4E8]">Recent</span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <div className="py-10 text-center type-empty-body">No recent activity recorded.</div>
            ) : (
              activities.slice(0, 8).map((act: any) => {
                let badgeClass = 'saas-badge-neutral';
                let targetHref = '/admin/dashboard';

                if (act.type === 'supplier_registered') {
                  targetHref = '/admin/approvals';
                } else if (act.type === 'product_submitted' || act.type === 'product_update_submitted') {
                  targetHref = '/admin/approvals';
                } else if (act.type === 'new_rfq' || act.type === 'rfq_accepted') {
                  targetHref = '/admin/rfqs';
                } else if (act.type === 'order_created') {
                  badgeClass = 'saas-badge-success';
                  targetHref = '/admin/orders';
                } else if (act.type === 'new_enquiry') {
                  targetHref = '/admin/enquiries';
                }

                return (
                  <div key={act.id} className="saas-inset-surface p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={badgeClass}>{(act.type || '').replace(/_/g, ' ')}</span>
                        <span className="font-medium text-xs text-[#111315] truncate">{act.title}</span>
                      </div>
                      <div className="text-xs text-[#6B7280] truncate">{act.description}</div>
                      <div className="text-[10px] font-mono text-[#6B7280]">{formatTime(act.timestamp)}</div>
                    </div>
                    <Link href={targetHref} className="saas-btn-secondary shrink-0">
                      View
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
