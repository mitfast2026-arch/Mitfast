'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Search,
  Archive,
  RotateCcw,
  Plus,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Package,
  Eye,
  ShoppingCart,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import type { SupplierStatus } from '@/types/database';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatStrip from '@/components/admin/AdminStatStrip';
import AdminToolbar from '@/components/admin/AdminToolbar';
import PortalModal from '@/components/admin/PortalModal';
import { ChartCard, PortalDonutChart, PortalBarChart } from '@/components/portal/ds';
import { selectChart } from '@/lib/portal/chart-selection';

type SupplierListMetrics = {
  productCount: number;
  totalViews: number;
  totalEnquiries: number;
  totalRfqs: number;
  totalOrders: number;
};

type SupplierAdminListItem = {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string | null;
  country: string;
  website: string | null;
  status: SupplierStatus;
  rejection_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  metrics: SupplierListMetrics;
};

type SortOption = 'created_at_desc' | 'created_at_asc' | 'company_name_asc' | 'company_name_desc';
type StatusFilter = 'all' | SupplierStatus;

type SuppliersListResponse = {
  suppliers: SupplierAdminListItem[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<SupplierStatus, number>;
  countries: string[];
};

type StatsResponse = {
  summary: {
    totalViews: number;
    totalEnquiries: number;
    totalRfqs: number;
    totalOrders: number;
  };
  products: Array<{
    productId: string;
    productName: string;
    views: number;
    enquiries: number;
    rfqs: number;
    orders: number;
  }>;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' },
  { value: 'rejected', label: 'Rejected' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'created_at_desc', label: 'Newest first' },
  { value: 'created_at_asc', label: 'Oldest first' },
  { value: 'company_name_asc', label: 'Name A–Z' },
  { value: 'company_name_desc', label: 'Name Z–A' },
];

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatNumber(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-IN');
}

function StatusBadge({ status }: { status: SupplierStatus }) {
  const cls =
    status === 'active'
      ? 'saas-badge-success'
      : status === 'pending'
        ? 'saas-badge-warning'
        : status === 'rejected'
          ? 'saas-badge-danger'
          : 'saas-badge-neutral';

  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`${cls} text-xs px-2.5 py-1`}>{label}</span>;
}

function MetricStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-portal-inset border border-portal-border px-2.5 py-1.5 text-portal-text"
      title={`${label}: ${formatNumber(value)}`}
    >
      <Icon className="w-4 h-4 shrink-0 text-portal-accent" aria-hidden />
      <span className="font-mono text-sm font-semibold tabular-nums">{formatNumber(value)}</span>
      <span className="text-xs text-portal-muted hidden lg:inline">{label}</span>
    </span>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td colSpan={5} className="py-3">
            <div className="h-10 bg-portal-inset rounded-lg mx-2" />
          </td>
        </tr>
      ))}
    </>
  );
}

function AdminSuppliersPageContent() {
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers] = useState<SupplierAdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created_at_desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [statusCounts, setStatusCounts] = useState<Record<SupplierStatus, number>>({
    pending: 0,
    active: 0,
    rejected: 0,
    archived: 0,
  });
  const [countries, setCountries] = useState<string[]>([]);

  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<{
    supplier: SupplierAdminListItem;
    data: StatsResponse | null;
  } | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<SupplierAdminListItem | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreTargetSupplier, setRestoreTargetSupplier] = useState<SupplierAdminListItem | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [restoreAll, setRestoreAll] = useState(true);
  const [selectedProdIds, setSelectedProdIds] = useState<string[]>([]);
  const [restoreActionLoading, setRestoreActionLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCountry, setNewCountry] = useState('India');
  const [newWebsite, setNewWebsite] = useState('');

  const { isPending, run, lastError, clearError } = useMutation();

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, countryFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadSuppliers = useCallback(
    async (showLoading = true) => {
      setLoadError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('sortBy', sortBy);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (countryFilter) params.set('country', countryFilter);

      const url = `/api/suppliers?${params.toString()}`;
      const existing = peekPortalCache<SuppliersListResponse>(url);
      if (existing) {
        setSuppliers(existing.data.suppliers || []);
        setTotal(existing.data.total ?? 0);
        setStatusCounts(existing.data.statusCounts);
        setCountries(existing.data.countries || []);
        setLoading(false);
      } else if (showLoading) {
        setLoading(true);
      }

      const result = await cachedApiGet<SuppliersListResponse>(url, {
        force: showLoading && !existing,
      });

      if (result.ok) {
        setSuppliers(result.data.suppliers || []);
        setTotal(result.data.total ?? 0);
        setStatusCounts(result.data.statusCounts);
        setCountries(result.data.countries || []);
        markPortalContentReady('/admin/suppliers');
      } else {
        setLoadError(result.message);
      }

      setLoading(false);
    },
    [debouncedSearch, statusFilter, countryFilter, sortBy, page, limit]
  );

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const totalAll = useMemo(
    () => Object.values(statusCounts).reduce((a, b) => a + b, 0),
    [statusCounts]
  );

  /** Useful page-level chart: sum metrics for suppliers currently listed */
  const catalogActivity = useMemo(() => {
    const sums = suppliers.reduce(
      (acc, s) => ({
        products: acc.products + (s.metrics?.productCount || 0),
        views: acc.views + (s.metrics?.totalViews || 0),
        enquiries: acc.enquiries + (s.metrics?.totalEnquiries || 0),
        rfqs: acc.rfqs + (s.metrics?.totalRfqs || 0),
        orders: acc.orders + (s.metrics?.totalOrders || 0),
      }),
      { products: 0, views: 0, enquiries: 0, rfqs: 0, orders: 0 }
    );
    return [
      { name: 'Products', value: sums.products },
      { name: 'Views', value: sums.views },
      { name: 'Enquiries', value: sums.enquiries },
      { name: 'RFQs', value: sums.rfqs },
      { name: 'Orders', value: sums.orders },
    ];
  }, [suppliers]);

  const statusBreakdown = useMemo(
    () => [
      { name: 'Active', value: statusCounts.active || 0 },
      { name: 'Pending', value: statusCounts.pending || 0 },
      { name: 'Archived', value: statusCounts.archived || 0 },
      { name: 'Rejected', value: statusCounts.rejected || 0 },
    ],
    [statusCounts]
  );

  function patchSupplier(supplierId: string, patch: Partial<SupplierAdminListItem>) {
    setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, ...patch } : s)));
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    clearError();

    await run(() => apiPost(`/api/suppliers/${target.id}/archive`), {
      key: mutationKey(target.id, 'archive'),
      optimistic: () => patchSupplier(target.id, { status: 'archived' }),
      rollback: () => patchSupplier(target.id, { status: target.status }),
      onSuccess: () => {
        setArchiveTarget(null);
        setSuccessMsg(`${target.company_name} archived successfully`);
        loadSuppliers(false);
      },
    });
  }

  async function openRestoreModal(sup: SupplierAdminListItem) {
    setRestoreTargetSupplier(sup);
    setRestoreModalOpen(true);
    setLoadingProducts(true);
    setRestoreAll(true);
    setSelectedProdIds([]);

    try {
      const result = await apiGet<{ products: any[] }>(
        `/api/products?mode=admin&supplierId=${sup.id}&archiveStatus=archived`
      );
      if (result.ok) {
        const prods = result.data.products || [];
        setSupplierProducts(prods);
        setSelectedProdIds(prods.map((p: any) => p.id));
      }
    } catch (err) {
      console.error('Failed to load supplier products for restore:', err);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleExecuteRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreTargetSupplier) return;

    setRestoreActionLoading(true);
    clearError();

    const result = await apiPost(`/api/suppliers/${restoreTargetSupplier.id}/restore`, {
      supplierId: restoreTargetSupplier.id,
      restoreAllProducts: restoreAll,
      selectedProductIds: restoreAll ? undefined : selectedProdIds,
    });

    if (result.ok) {
      setRestoreModalOpen(false);
      setSuccessMsg(`${restoreTargetSupplier.company_name} restored successfully`);
      loadSuppliers(false);
    }

    setRestoreActionLoading(false);
  }

  function toggleProductSelection(prodId: string) {
    setSelectedProdIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
    );
  }

  async function handleViewStats(supplier: SupplierAdminListItem) {
    setSelectedStats({ supplier, data: null });
    setStatsModalOpen(true);
    setStatsLoading(true);
    setStatsError(null);

    const result = await apiGet<StatsResponse>(`/api/suppliers/${supplier.id}/stats`);

    if (result.ok) {
      setSelectedStats({ supplier, data: result.data });
    } else {
      setStatsError(result.message);
    }

    setStatsLoading(false);
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    const result = await apiPost<{ supplierId: string }>('/api/suppliers', {
      companyName: newCompanyName.trim(),
      contactPerson: newContactPerson.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim() || undefined,
      country: newCountry.trim(),
      website: newWebsite.trim() || undefined,
      status: 'active',
    });

    if (result.ok) {
      setCreateModalOpen(false);
      setNewCompanyName('');
      setNewContactPerson('');
      setNewEmail('');
      setNewPhone('');
      setNewAddress('');
      setNewCountry('India');
      setNewWebsite('');
      setSuccessMsg('New supplier created successfully');
      loadSuppliers(false);
    } else {
      setCreateError(result.message);
    }

    setCreateLoading(false);
  }

  const displayError = loadError || lastError;

  return (
    <div className="space-y-5 w-full min-w-0">
      <AdminPageHeader
        title="Suppliers"
        description="Partner registry — search, filter, and act without leaving the list."
        actions={
          <>
            <button onClick={() => setCreateModalOpen(true)} className="saas-btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Add supplier
            </button>
            <button
              onClick={() => loadSuppliers()}
              disabled={loading}
              className="saas-btn-ghost"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      <AdminStatStrip
        stats={[
          { label: 'Total', value: totalAll, onClick: () => setStatusFilter('all'), active: statusFilter === 'all' },
          {
            label: 'Active',
            value: statusCounts.active,
            highlight: 'success',
            onClick: () => setStatusFilter('active'),
            active: statusFilter === 'active',
          },
          {
            label: 'Pending',
            value: statusCounts.pending,
            highlight: 'warning',
            onClick: () => setStatusFilter('pending'),
            active: statusFilter === 'pending',
          },
          {
            label: 'Archived',
            value: statusCounts.archived,
            onClick: () => setStatusFilter('archived'),
            active: statusFilter === 'archived',
          },
          {
            label: 'Rejected',
            value: statusCounts.rejected,
            highlight: 'danger',
            onClick: () => setStatusFilter('rejected'),
            active: statusFilter === 'rejected',
          },
        ]}
      />

      {(() => {
        const nonZeroStatus = statusBreakdown.filter((d) => d.value > 0);
        const statusChart = selectChart({
          kind: 'compare',
          categoryCount: nonZeroStatus.length || statusBreakdown.length,
        });
        const useStatusDonut = statusChart === 'donut' && nonZeroStatus.length >= 2;
        const hasCatalogSignal = catalogActivity.some((d) => d.value > 0);

        if (!hasCatalogSignal && totalAll === 0) return null;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {hasCatalogSignal ? (
              <ChartCard title="Catalog activity" subtitle="Totals for suppliers on this page">
                <PortalBarChart data={catalogActivity} height={220} />
              </ChartCard>
            ) : null}
            {totalAll > 0 ? (
              <ChartCard title="Status breakdown" subtitle="All suppliers in registry">
                {useStatusDonut ? (
                  <PortalDonutChart data={nonZeroStatus} />
                ) : (
                  <PortalBarChart data={statusBreakdown} height={220} />
                )}
              </ChartCard>
            ) : null}
          </div>
        );
      })()}

      {successMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-portal-success-soft text-xs text-portal-success">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto p-0.5 hover:opacity-70" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {displayError && (
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-portal-danger-soft text-xs text-portal-danger">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{displayError}</span>
          <button
            onClick={() => {
              clearError();
              setLoadError(null);
              loadSuppliers();
            }}
            className="saas-btn-secondary text-[10px] py-1 px-2"
          >
            Retry
          </button>
        </div>
      )}

      <AdminToolbar trailing={<span className="text-sm text-portal-muted">{total} results</span>}>
        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="saas-search-field flex-1 min-w-0">
            <Search className="saas-search-icon" />
            <input
              type="text"
              placeholder="Search company, contact, or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="saas-input text-sm w-full !pr-8"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-portal-muted hover:text-portal-text"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-portal-muted" />
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="saas-input text-sm py-2 min-w-[140px]"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3 h-3 text-portal-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="saas-input text-sm py-2 min-w-[150px]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-sm px-3.5 py-2 rounded-xl font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-portal-accent text-white'
                  : 'bg-portal-inset text-portal-muted hover:text-portal-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </AdminToolbar>

      {/* List panel — guaranteed height so rows never crush; only rows scroll */}
      <div className="saas-panel p-0 min-w-0 flex flex-col overflow-hidden bg-portal-panel h-[min(42rem,calc(100dvh-13rem))] min-h-[32rem]">
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          <table className="saas-table w-full table-fixed min-w-0 [&_th]:!px-5 [&_td]:!px-5 [&_th]:!py-3.5 [&_td]:!py-4">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[25%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-portal-panel shadow-[0_1px_0_0_var(--portal-border)]">
              <tr>
                <th>Supplier</th>
                <th>Location</th>
                <th>Status</th>
                <th>Activity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-portal-muted">
                      <Building2 className="w-8 h-8 opacity-40" />
                      <div>
                        <p className="text-sm font-medium text-portal-text">No suppliers found</p>
                        <p className="text-xs mt-0.5">
                          {debouncedSearch || statusFilter !== 'all' || countryFilter
                            ? 'Try adjusting your search or filters.'
                            : 'Add your first manufacturing partner to get started.'}
                        </p>
                      </div>
                      {!debouncedSearch && statusFilter === 'all' && !countryFilter && (
                        <button
                          onClick={() => setCreateModalOpen(true)}
                          className="saas-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add supplier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-portal-hover group">
                    <td className="align-middle min-w-0">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="mt-0.5 h-11 w-11 rounded-xl bg-portal-inset border border-portal-border text-portal-muted flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div
                            className="font-semibold text-base text-portal-text truncate leading-snug"
                            title={`${s.company_name} · ${shortId(s.id)}`}
                          >
                            {s.company_name}
                          </div>
                          <div className="text-sm text-portal-muted truncate" title={s.contact_person}>
                            {s.contact_person}
                          </div>
                          <div className="flex flex-col gap-1 text-sm text-portal-muted min-w-0 pt-1">
                            <span className="inline-flex items-center gap-2 min-w-0" title={s.email}>
                              <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                              <span className="truncate">{s.email}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 min-w-0" title={s.phone}>
                              <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                              <span className="truncate">{s.phone}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="align-middle min-w-0">
                      <div className="min-w-0 space-y-1" title={s.address || s.country}>
                        <div className="flex items-center gap-1.5 text-sm text-portal-text">
                          <MapPin className="w-4 h-4 shrink-0 text-portal-muted" />
                          <span className="truncate font-medium">{s.country}</span>
                        </div>
                        {s.address ? (
                          <div className="text-sm text-portal-muted truncate pl-5">{s.address}</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="align-middle">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="align-middle min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <MetricStat
                          icon={Package}
                          value={s.metrics.productCount}
                          label="Products"
                        />
                        <MetricStat icon={Eye} value={s.metrics.totalViews} label="Views" />
                        <MetricStat
                          icon={ShoppingCart}
                          value={s.metrics.totalOrders}
                          label="Orders"
                        />
                      </div>
                    </td>
                    <td className="align-middle text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/suppliers/${s.id}`}
                          className="saas-btn-ghost h-9 w-9"
                          title="View details"
                          aria-label={`Details for ${s.company_name}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleViewStats(s)}
                          className="saas-btn-ghost h-9 w-9"
                          title="View performance chart"
                          aria-label={`View performance chart for ${s.company_name}`}
                        >
                          <TrendingUp className="w-4 h-4 text-portal-accent" />
                        </button>
                        {s.status === 'archived' ? (
                          <button
                            type="button"
                            onClick={() => openRestoreModal(s)}
                            disabled={isPending(mutationKey(s.id, 'restore'))}
                            className="saas-btn-ghost h-9 w-9 text-portal-success"
                            title="Restore supplier"
                            aria-label={`Restore ${s.company_name}`}
                          >
                            {isPending(mutationKey(s.id, 'restore')) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        ) : s.status !== 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(s)}
                            disabled={isPending(mutationKey(s.id, 'archive'))}
                            className="saas-btn-ghost h-9 w-9 text-portal-danger"
                            title="Archive supplier"
                            aria-label={`Archive ${s.company_name}`}
                          >
                            {isPending(mutationKey(s.id, 'archive')) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > limit && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-portal-border bg-portal-inset">
            <span className="text-xs text-portal-muted font-mono">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="saas-neu-button p-2 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="saas-neu-button p-2 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-portal-text/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-5 rounded-2xl bg-portal-panel shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-portal-danger" />
                <h3 className="text-sm font-bold text-portal-text">Archive supplier?</h3>
              </div>
              <button
                onClick={() => setArchiveTarget(null)}
                className="p-1 rounded-lg text-portal-muted hover:text-portal-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-portal-muted leading-relaxed">
              <strong className="text-portal-text">{archiveTarget.company_name}</strong> will be archived and all
              active catalog products will be archived too. Historical orders and RFQs are preserved.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-portal-border">
              <button onClick={() => setArchiveTarget(null)} className="saas-btn-secondary text-xs py-1.5 px-3">
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                disabled={isPending(mutationKey(archiveTarget.id, 'archive'))}
                className="saas-btn-primary text-xs py-1.5 px-4 bg-portal-danger hover:opacity-90 border-portal-danger"
              >
                {isPending(mutationKey(archiveTarget.id, 'archive')) ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Archiving…
                  </span>
                ) : (
                  'Confirm archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore modal */}
      {restoreModalOpen && restoreTargetSupplier && (
        <div className="fixed inset-0 z-50 bg-portal-text/50 flex items-center justify-center p-4">
          <form onSubmit={handleExecuteRestore} className="w-full max-w-lg p-5 rounded-2xl bg-portal-panel shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-portal-border pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-portal-success" />
                <h3 className="text-sm font-bold text-portal-text">
                  Restore {restoreTargetSupplier.company_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="p-1 rounded-lg text-portal-muted hover:text-portal-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-portal-muted leading-relaxed">
              Reactivates portal access. Choose whether to restore all archived products or select specific items.
            </p>

            <div className="space-y-2 p-3 rounded-xl bg-portal-inset border border-portal-border">
              <label className="flex items-center gap-2 text-xs font-semibold text-portal-text cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreAll}
                  onChange={() => setRestoreAll(true)}
                  className="accent-slate-900"
                />
                <span>Restore all products ({supplierProducts.length})</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-portal-text cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={!restoreAll}
                  onChange={() => setRestoreAll(false)}
                  className="accent-slate-900"
                />
                <span>Select specific products</span>
              </label>
            </div>

            {!restoreAll && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-portal-border divide-y divide-slate-100 p-1 bg-portal-panel">
                {loadingProducts ? (
                  <div className="p-4 text-center text-xs text-portal-muted">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Loading products…
                  </div>
                ) : supplierProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-portal-muted">No archived products found.</div>
                ) : (
                  supplierProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center justify-between p-2 hover:bg-portal-hover cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={selectedProdIds.includes(p.id)}
                          onChange={() => toggleProductSelection(p.id)}
                          className="accent-slate-900"
                        />
                        <span className="font-medium text-portal-text truncate">{p.name}</span>
                      </div>
                      <span className="text-portal-muted text-[10px] font-mono shrink-0 ml-2">
                        ₹{p.selling_price?.toLocaleString('en-IN')}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-portal-border">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="saas-btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={restoreActionLoading || (!restoreAll && selectedProdIds.length === 0)}
                className="saas-btn-primary text-xs py-1.5 px-4"
              >
                {restoreActionLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Restoring…
                  </span>
                ) : (
                  'Confirm restore'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Analytics modal — chart of existing supplier stats */}
      {statsModalOpen && selectedStats && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-5 rounded-[24px] bg-portal-panel border border-portal-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-portal-border pb-3 sticky top-0 bg-portal-panel z-10">
              <div>
                <h3 className="text-sm font-bold text-portal-text">{selectedStats.supplier.company_name}</h3>
                <span className="type-meta text-[10px]">Sales &amp; views analytics</span>
              </div>
              <button
                type="button"
                onClick={() => setStatsModalOpen(false)}
                className="saas-btn-ghost"
                aria-label="Close analytics"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statsLoading ? (
              <div className="py-8 text-center text-xs text-portal-muted">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading analytics…
              </div>
            ) : statsError ? (
              <div className="py-6 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-portal-danger mx-auto" />
                <p className="text-xs text-portal-danger">{statsError}</p>
                <button
                  type="button"
                  onClick={() => handleViewStats(selectedStats.supplier)}
                  className="saas-btn-secondary text-xs py-1 px-3"
                >
                  Retry
                </button>
              </div>
            ) : selectedStats.data ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: 'Products',
                      value: selectedStats.data.products.length,
                      icon: Package,
                    },
                    {
                      label: 'Views',
                      value: selectedStats.data.summary.totalViews,
                      icon: Eye,
                    },
                    {
                      label: 'RFQs',
                      value: selectedStats.data.summary.totalRfqs,
                      icon: FileText,
                    },
                    {
                      label: 'Orders',
                      value: selectedStats.data.summary.totalOrders,
                      icon: ShoppingCart,
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl border border-portal-border bg-portal-inset p-2.5 text-center"
                    >
                      <kpi.icon className="w-3.5 h-3.5 text-portal-accent mx-auto mb-1" aria-hidden />
                      <div className="text-base font-bold text-portal-text tabular-nums">
                        {formatNumber(kpi.value)}
                      </div>
                      <div className="text-[10px] text-portal-muted">{kpi.label}</div>
                    </div>
                  ))}
                </div>

                <ChartCard title="Performance mix" subtitle="Views · RFQs · Orders">
                  <PortalBarChart
                    data={[
                      { name: 'Views', value: selectedStats.data.summary.totalViews || 0 },
                      { name: 'Enquiries', value: selectedStats.data.summary.totalEnquiries || 0 },
                      { name: 'RFQs', value: selectedStats.data.summary.totalRfqs || 0 },
                      { name: 'Orders', value: selectedStats.data.summary.totalOrders || 0 },
                    ]}
                  />
                </ChartCard>

                {selectedStats.data.products.length > 0 ? (
                  <ChartCard title="Top products by views" subtitle="From this supplier catalog">
                    <PortalBarChart
                      data={[...selectedStats.data.products]
                        .sort((a, b) => b.views - a.views)
                        .slice(0, 6)
                        .map((p) => ({
                          name:
                            p.productName.length > 14
                              ? `${p.productName.slice(0, 14)}…`
                              : p.productName,
                          value: p.views,
                        }))}
                    />
                  </ChartCard>
                ) : null}

                <div className="flex justify-between items-center pt-2 border-t border-portal-border">
                  <Link
                    href={`/admin/suppliers/${selectedStats.supplier.id}`}
                    className="text-xs font-semibold text-portal-accent hover:underline flex items-center gap-1"
                  >
                    View full details
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStatsModalOpen(false)}
                    className="saas-btn-secondary text-xs py-1 px-3"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Create supplier modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-portal-text/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="w-full max-w-md p-5 rounded-2xl bg-portal-panel shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-portal-border pb-3">
              <h3 className="text-sm font-bold text-portal-text">Add supplier partner</h3>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateError('');
                }}
                className="p-1 rounded-lg text-portal-muted hover:text-portal-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2 rounded-lg bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {createError}
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <label className="saas-label text-[10px]">Company name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AeroFast Precision Engineering"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="saas-label text-[10px]">Contact person *</label>
                  <input
                    type="text"
                    required
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
                <div>
                  <label className="saas-label text-[10px]">Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="saas-label text-[10px]">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
                <div>
                  <label className="saas-label text-[10px]">Country *</label>
                  <input
                    type="text"
                    required
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="saas-label text-[10px]">Address</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
              <div>
                <label className="saas-label text-[10px]">Website</label>
                <input
                  type="url"
                  placeholder="https://"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-portal-border">
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateError('');
                }}
                className="saas-btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button type="submit" disabled={createLoading} className="saas-btn-primary text-xs py-1.5 px-4">
                {createLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Creating…
                  </span>
                ) : (
                  'Create supplier'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AdminSuppliersPage() {
  return (
    <Suspense
      fallback={
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">Loading suppliers…</div>
      }
    >
      <AdminSuppliersPageContent />
    </Suspense>
  );
}
