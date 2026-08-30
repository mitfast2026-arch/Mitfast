'use client';

import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, Loader2, X, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';
import { invalidateProductPortalCaches } from '@/lib/client/invalidate-product-portal-cache';
import ProductFormPanel, { loadProductForPanel } from '@/components/portal/products/ProductFormPanel';
import type { ProductFormMode, ProductFormProduct } from '@/components/portal/products/product-form.types';
import ProductCard from './ProductCard';
import ProductDeleteDialog from './ProductDeleteDialog';
import type { AdminProduct } from './types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';

type ArchiveTab = 'active' | 'archived' | 'all';
type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

function AdminProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters and controls state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedApproval, setSelectedApproval] = useState<string>('');
  const [selectedPublication, setSelectedPublication] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Lookups
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Panels and modals
  const [rowError, setRowError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ProductFormMode>('create-admin');
  const [panelProduct, setPanelProduct] = useState<ProductFormProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { isPending, run } = useMutation();
  const requestIdRef = useRef(0);

  // Load static lookups once on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [catsRes, supsRes] = await Promise.all([
          cachedApiGet<{ categories: any[] }>('/api/categories?mode=admin&status=active'),
          cachedApiGet<{ suppliers: any[] }>('/api/suppliers?status=active&limit=100'),
        ]);
        if (active) {
          if (catsRes.ok) setCategories(catsRes.data.categories || []);
          if (supsRes.ok) setSuppliers(supsRes.data.suppliers || []);
        }
      } catch (err) {
        console.error('Failed to load lookups:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sync search param on load
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
      setDebouncedSearch(q.trim());
    }
  }, [searchParams]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Main data loader function
  const loadProducts = useCallback(
    async (showLoading = true, opts?: { force?: boolean }) => {
      const currentReqId = ++requestIdRef.current;
      const params = new URLSearchParams({
        mode: 'admin',
        page: String(page),
        limit: String(PORTAL_PAGE_LIMIT),
        sortBy,
      });

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (archiveTab !== 'all') params.set('archiveStatus', archiveTab);
      if (selectedCategory) params.set('categoryId', selectedCategory);
      if (selectedSupplier) params.set('supplierId', selectedSupplier);
      if (selectedApproval) params.set('approvalStatus', selectedApproval);
      if (selectedPublication) params.set('publicationStatus', selectedPublication);

      const url = `/api/products?${params.toString()}`;
      const force = Boolean(opts?.force);
      const existing = force ? null : peekPortalCache<{ products: AdminProduct[]; total: number }>(url);

      if (existing) {
        setProducts(existing.data.products || []);
        setTotal(existing.data.total ?? 0);
        setLoading(false);
      } else if (showLoading) {
        setLoading(true);
      }

      setLoadError(null);
      try {
        const result = await cachedApiGet<{ products: AdminProduct[]; total: number }>(url, {
          force: force || (showLoading && !existing),
        });

        // Ignore stale responses
        if (currentReqId !== requestIdRef.current) return;

        if (result.ok) {
          setProducts(result.data.products || []);
          setTotal(result.data.total ?? 0);
          markPortalContentReady('/admin/products');
        } else {
          setLoadError(result.message);
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error('Failed to load products:', err);
        setLoadError('Failed to load product catalog');
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      page,
      debouncedSearch,
      archiveTab,
      selectedCategory,
      selectedSupplier,
      selectedApproval,
      selectedPublication,
      sortBy,
    ]
  );

  // Trigger load when parameters change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Reset page to 1 when filters or search change
  const handleArchiveTabChange = (tab: ArchiveTab) => {
    setArchiveTab(tab);
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleSupplierChange = (val: string) => {
    setSelectedSupplier(val);
    setPage(1);
  };

  const handleApprovalChange = (val: string) => {
    setSelectedApproval(val);
    setPage(1);
  };

  const handlePublicationChange = (val: string) => {
    setSelectedPublication(val);
    setPage(1);
  };

  const handleSortChange = (val: SortOption) => {
    setSortBy(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setArchiveTab('active');
    setSelectedCategory('');
    setSelectedSupplier('');
    setSelectedApproval('');
    setSelectedPublication('');
    setSortBy('newest');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    archiveTab !== 'active' ||
    Boolean(selectedCategory) ||
    Boolean(selectedSupplier) ||
    Boolean(selectedApproval) ||
    Boolean(selectedPublication) ||
    sortBy !== 'newest';

  // Review URL param support
  const reviewId = searchParams.get('review');
  const reviewOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!reviewId || reviewOpenedRef.current === reviewId) return;
    reviewOpenedRef.current = reviewId;
    const prod = products.find((p) => p.id === reviewId);
    if (prod) {
      void openEditPanel(prod, true);
      return;
    }
    void (async () => {
      setPanelOpen(true);
      setPanelMode('review-admin');
      setDetailLoading(true);
      try {
        const detail = await loadProductForPanel(reviewId);
        if (detail) {
          setPanelProduct(detail);
        } else {
          toast.error('Product not found');
          setPanelOpen(false);
          reviewOpenedRef.current = null;
        }
      } catch {
        toast.error('Failed to load product for review');
        setPanelOpen(false);
        reviewOpenedRef.current = null;
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [reviewId, products]);

  function patchProduct(productId: string, patch: Record<string, unknown>) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p))
    );
    if (panelProduct?.id === productId) {
      setPanelProduct((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }

  function openCreatePanel() {
    setPanelProduct(null);
    setPanelMode('create-admin');
    setPanelOpen(true);
  }

  async function openEditPanel(prod: AdminProduct, review = false) {
    setPanelOpen(true);
    setPanelMode(review ? 'review-admin' : 'edit-admin');
    setPanelProduct(prod as ProductFormProduct);
    setDetailLoading(true);
    try {
      const detail = await loadProductForPanel(prod.id);
      if (detail) setPanelProduct(detail);
    } catch {
      setRowError('Failed to load product details');
    } finally {
      setDetailLoading(false);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setPanelProduct(null);
    setDetailLoading(false);
  }

  async function handleApproveProduct(productId: string) {
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/approve`), {
      key: mutationKey(productId, 'approve'),
      onSuccess: () => {
        patchProduct(productId, { approval_status: 'approved' });
        notifyApprovalsChanged();
        invalidateProductPortalCaches();
        toast.success('Product approved');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleTogglePublish(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'published' ? 'unpublish' : 'publish';
    const nextStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/${endpoint}`), {
      key: mutationKey(productId, endpoint),
      optimistic: () => patchProduct(productId, { publication_status: nextStatus }),
      rollback: () => patchProduct(productId, { publication_status: currentStatus }),
      onSuccess: () => {
        invalidateProductPortalCaches();
        toast.success(nextStatus === 'published' ? 'Product published' : 'Product unpublished');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleToggleArchive(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'archived' ? 'restore' : 'archive';
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/${endpoint}`), {
      key: mutationKey(productId, endpoint),
      optimistic: () => patchProduct(productId, { archive_status: nextStatus }),
      rollback: () => patchProduct(productId, { archive_status: currentStatus }),
      onSuccess: () => {
        invalidateProductPortalCaches();
        toast.success(nextStatus === 'active' ? 'Product restored' : 'Product archived');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  function openDeleteDialog(prod: AdminProduct) {
    setDeleteTarget(prod);
    setDeleteConfirmName('');
    setDeleteError('');
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Failed to delete product';
        setDeleteError(msg);
        toast.error(msg);
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      invalidateProductPortalCaches();
      toast.success('Product deleted successfully');
      setDeleteTarget(null);
      if (panelProduct?.id === deleteTarget.id) closePanel();
    } catch {
      setDeleteError('Failed to delete product');
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  }

  const supplierName =
    suppliers.find((s) => s.id === panelProduct?.supplier_id)?.company_name ||
    panelProduct?.supplier?.company_name ||
    '';

  const totalPages = Math.max(1, Math.ceil(total / PORTAL_PAGE_LIMIT));

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="Product Catalog"
        description="Manage multi-supplier products, pricing, specs, and publication status."
        actions={
          <>
            <button type="button" onClick={openCreatePanel} className="saas-btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Create Product
            </button>
            <button onClick={() => loadProducts(true, { force: true })} className="saas-btn-secondary gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {/* Primary Listing Controls */}
      <div className="space-y-3">
        {/* Top bar: Archive Tabs + Search + Summary */}
        <AdminToolbar
          trailing={
            <div className="text-xs text-portal-muted flex items-center gap-3">
              <span>
                Total: <strong className="text-portal-text">{total}</strong>
              </span>
              {loading && products.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-portal-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
                </span>
              )}
            </div>
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
            {/* Active / Archived Tabs */}
            <div className="flex items-center rounded-xl bg-portal-inset p-1 border border-portal-border shrink-0">
              <button
                type="button"
                onClick={() => handleArchiveTabChange('active')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  archiveTab === 'active'
                    ? 'bg-portal-panel text-portal-text shadow-sm'
                    : 'text-portal-muted hover:text-portal-text'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => handleArchiveTabChange('archived')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  archiveTab === 'archived'
                    ? 'bg-portal-panel text-portal-text shadow-sm'
                    : 'text-portal-muted hover:text-portal-text'
                }`}
              >
                Archived
              </button>
              <button
                type="button"
                onClick={() => handleArchiveTabChange('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  archiveTab === 'all'
                    ? 'bg-portal-panel text-portal-text shadow-sm'
                    : 'text-portal-muted hover:text-portal-text'
                }`}
              >
                All
              </button>
            </div>

            {/* Search bar */}
            <div className="saas-search-field flex-1 sm:max-w-md relative">
              <Search className="saas-search-icon" />
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="saas-input w-full pr-8 text-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-portal-muted hover:text-portal-text p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </AdminToolbar>

        {/* Filters and Sort Row */}
        <div className="flex flex-wrap items-center gap-2.5 p-3 bg-portal-panel rounded-2xl border border-portal-border">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-portal-muted mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="saas-input text-xs py-1.5 pl-3 pr-8 min-w-[130px] w-auto max-w-[200px]"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Supplier Filter */}
          <select
            value={selectedSupplier}
            onChange={(e) => handleSupplierChange(e.target.value)}
            className="saas-input text-xs py-1.5 pl-3 pr-8 min-w-[130px] w-auto max-w-[200px]"
            aria-label="Filter by supplier"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.company_name}
              </option>
            ))}
          </select>

          {/* Approval Filter */}
          <select
            value={selectedApproval}
            onChange={(e) => handleApprovalChange(e.target.value)}
            className="saas-input text-xs py-1.5 pl-3 pr-8 min-w-[125px] w-auto max-w-[180px]"
            aria-label="Filter by approval status"
          >
            <option value="">All Approvals</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="update_pending">Update Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Publication Filter */}
          <select
            value={selectedPublication}
            onChange={(e) => handlePublicationChange(e.target.value)}
            className="saas-input text-xs py-1.5 pl-3 pr-8 min-w-[120px] w-auto max-w-[170px]"
            aria-label="Filter by publication status"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>

          {/* Sort Selector */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-semibold text-portal-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="saas-input text-xs py-1.5 pl-3 pr-8 font-medium min-w-[130px] w-auto"
              aria-label="Sort products"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center justify-center text-xs py-1.5 px-2.5 rounded-full border border-portal-border bg-portal-panel text-portal-danger hover:bg-portal-danger-soft gap-1 transition-colors"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {(rowError || loadError) && (
        <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5 flex items-center justify-between">
          <span>{rowError || loadError}</span>
          <button
            type="button"
            onClick={() => {
              setRowError(null);
              setLoadError(null);
            }}
            className="hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading catalog…
        </div>
      ) : products.length === 0 ? (
        <div className="saas-panel py-16 text-center text-portal-muted text-xs space-y-2">
          <p>No products found matching the current filters.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="saas-btn-secondary text-xs inline-flex items-center gap-1.5 mt-2"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isPending={isPending}
              mutationKey={mutationKey}
              detailLoading={detailLoading}
              selectedProductId={panelProduct?.id}
              onEdit={(prod) =>
                openEditPanel(
                  prod,
                  prod.approval_status === 'pending' ||
                    prod.has_open_update_request ||
                    prod.approval_status === 'update_pending'
                )
              }
              onApprove={handleApproveProduct}
              onTogglePublish={handleTogglePublish}
              onToggleArchive={handleToggleArchive}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-portal-muted">
            Page <b className="text-portal-text">{page}</b> of <b className="text-portal-text">{totalPages}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="saas-btn-secondary text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="saas-btn-secondary text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ProductFormPanel
        open={panelOpen}
        mode={panelMode}
        product={panelProduct}
        categories={categories}
        suppliers={suppliers}
        supplierName={supplierName}
        detailLoading={detailLoading}
        onClose={closePanel}
        onSuccess={() => {
          invalidateProductPortalCaches();
          loadProducts(false, { force: true });
          notifyApprovalsChanged();
        }}
        onApprove={
          panelProduct
            ? () => handleApproveProduct(panelProduct.id)
            : undefined
        }
        onTogglePublish={
          panelProduct
            ? () =>
                handleTogglePublish(
                  panelProduct.id,
                  panelProduct.publication_status || 'unpublished'
                )
            : undefined
        }
        onToggleArchive={
          panelProduct
            ? () =>
                handleToggleArchive(
                  panelProduct.id,
                  panelProduct.archive_status || 'active'
                )
            : undefined
        }
        isPending={isPending}
        mutationKey={mutationKey}
      />

      {deleteTarget && (
        <ProductDeleteDialog
          product={deleteTarget}
          confirmName={deleteConfirmName}
          onConfirmNameChange={setDeleteConfirmName}
          deleting={deleting}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading catalog…
        </div>
      }
    >
      <AdminProductsPageContent />
    </Suspense>
  );
}
