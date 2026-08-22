'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  User, 
  RefreshCw,
  Globe,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Eye,
  Loader2,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierStats, setSelectedSupplierStats] = useState<any>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreTargetSupplier, setRestoreTargetSupplier] = useState<any>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [restoreAll, setRestoreAll] = useState(true);
  const [selectedProdIds, setSelectedProdIds] = useState<string[]>([]);
  const [restoreActionLoading, setRestoreActionLoading] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const { isPending, run } = useMutation();

  // New Supplier Form State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCountry, setNewCountry] = useState('India');
  const [newWebsite, setNewWebsite] = useState('');

  const loadSuppliers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{ suppliers: any[] }>(`/api/suppliers?search=${encodeURIComponent(searchTerm)}`);
      if (result.ok) setSuppliers(result.data.suppliers || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  async function handleArchiveSupplier(supplierId: string) {
    if (!confirm('Are you sure you want to archive this supplier? All active catalog products for this supplier will also be archived.')) {
      return;
    }
    setRowError(null);
    await run(() => apiPost(`/api/suppliers/${supplierId}/archive`), {
      key: mutationKey(supplierId, 'archive'),
      onSuccess: () => {
        setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      },
      onError: (msg) => setRowError(msg),
    });
  }

  async function openRestoreModal(sup: any) {
    setRestoreTargetSupplier(sup);
    setRestoreModalOpen(true);
    setLoadingProducts(true);
    setRestoreAll(true);
    setSelectedProdIds([]);

    try {
      const res = await fetch(`/api/products?mode=admin&supplierId=${sup.id}&archiveStatus=archived`);
      const json = await res.json();
      if (json.success) {
        const prods = json.data.products || [];
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
    try {
      const res = await fetch(`/api/suppliers/${restoreTargetSupplier.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: restoreTargetSupplier.id,
          restoreAllProducts: restoreAll,
          selectedProductIds: restoreAll ? undefined : selectedProdIds,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setRestoreModalOpen(false);
        loadSuppliers();
      }
    } catch (err) {
      console.error('Execute restore error:', err);
    } finally {
      setRestoreActionLoading(false);
    }
  }

  function toggleProductSelection(prodId: string) {
    if (selectedProdIds.includes(prodId)) {
      setSelectedProdIds(selectedProdIds.filter(id => id !== prodId));
    } else {
      setSelectedProdIds([...selectedProdIds, prodId]);
    }
  }

  async function handleViewStats(supplierId: string) {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/stats`);
      const json = await res.json();
      if (json.success) {
        setSelectedSupplierStats(json.data);
        setStatsModalOpen(true);
      }
    } catch (err) {
      console.error('Fetch supplier stats error:', err);
    }
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newCompanyName.trim(),
          contactPerson: newContactPerson.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          address: newAddress.trim() || undefined,
          country: newCountry.trim(),
          website: newWebsite.trim() || undefined,
          status: 'active',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCreateModalOpen(false);
        setNewCompanyName('');
        setNewContactPerson('');
        setNewEmail('');
        setNewPhone('');
        loadSuppliers();
      }
    } catch (err) {
      console.error('Create supplier error:', err);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Suppliers
          </h1>
          <p className="type-subtitle">
            Manage registered manufacturing partners, view performance statistics, and manage account statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
          <button 
            onClick={() => loadSuppliers()}
            className="saas-neu-button text-xs py-2 px-3 flex items-center gap-1.5"
            title="Refresh Suppliers"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="saas-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input 
            type="text"
            placeholder="Search by company, contact or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input pl-8 text-xs"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        </div>
        <div className="text-xs text-[#6B7280] font-mono">
          Showing {suppliers.length} Supplier Partners
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="saas-panel p-0 overflow-hidden">
        <div className="saas-table-container">
          <table className="saas-table text-xs">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Contact info</th>
                <th>Country</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#6B7280]">
                    No suppliers found matching criteria.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F7F7F8]/70">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded bg-[#111315] text-white flex items-center justify-center font-bold text-[10px]">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-[#111315]">{s.company_name}</div>
                          {s.website && (
                            <a href={s.website} target="_blank" rel="noreferrer" className="text-[10px] text-[#111315] hover:underline flex items-center gap-1">
                              <span>Website</span>
                              <Globe className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-[#111315] font-medium">
                      {s.contact_person}
                    </td>
                    <td>
                      <div className="space-y-0.5 text-[11px] text-[#6B7280] font-mono">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#6B7280]" />
                          <span>{s.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#6B7280]" />
                          <span>{s.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-[#6B7280]">
                      {s.country}
                    </td>
                    <td>
                      <span className={
                        s.status === 'active' 
                          ? 'saas-badge-success' 
                          : s.status === 'pending'
                          ? 'saas-badge-gold'
                          : s.status === 'rejected'
                          ? 'saas-badge-danger'
                          : 'saas-badge-neutral'
                      }>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/suppliers/${s.id}`}
                          className="saas-neu-button p-1.5"
                          title="View supplier"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                        </Link>
                        <button
                          onClick={() => handleViewStats(s.id)}
                          className="saas-neu-button p-1.5"
                          title="Demand Telemetry"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-[#6B7280]" />
                        </button>
                        
                        {s.status === 'archived' ? (
                          <button
                            onClick={() => openRestoreModal(s)}
                            className="saas-neu-button p-1.5 text-[#15803D]"
                            title="Restore Supplier & Products"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveSupplier(s.id)}
                            className="saas-neu-button p-1.5 text-[#B91C1C]"
                            title="Archive Supplier"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTIVE PRODUCT RESTORE MODAL */}
      {restoreModalOpen && restoreTargetSupplier && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleExecuteRestore} className="w-full max-w-lg p-6 rounded-2xl bg-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#15803D]" />
                <h3 className="text-base font-bold text-[#111315]">
                  Restore Supplier: {restoreTargetSupplier.company_name}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setRestoreModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Restoring this supplier will reactivate their portal login. You can choose whether to restore all associated catalog components or select specific products to restore.
            </p>

            {/* Restore Options */}
            <div className="space-y-3 p-3 rounded-xl bg-[#F7F7F8] border border-[#E2E4E8]">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#111315] cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreAll}
                  onChange={() => setRestoreAll(true)}
                  className="accent-slate-900"
                />
                <span>Restore All Associated Products ({supplierProducts.length} items)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-[#111315] cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={!restoreAll}
                  onChange={() => setRestoreAll(false)}
                  className="accent-slate-900"
                />
                <span>Select Specific Products to Restore</span>
              </label>
            </div>

            {/* Individual Product Checkbox Selector */}
            {!restoreAll && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#111315]">Archived Supplier Products:</div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#E2E4E8] divide-y divide-slate-100 p-1 bg-white">
                  {loadingProducts ? (
                    <div className="p-4 text-center text-xs text-[#6B7280] font-mono">Loading products...</div>
                  ) : supplierProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#6B7280] font-mono">No archived products found for this supplier.</div>
                  ) : (
                    supplierProducts.map((p) => {
                      const isChecked = selectedProdIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center justify-between p-2 hover:bg-[#F7F7F8] cursor-pointer text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleProductSelection(p.id)}
                              className="accent-slate-900"
                            />
                            <span className="font-medium text-[#111315] truncate">{p.name}</span>
                          </div>
                          <span className="text-[#6B7280] text-[10px] font-mono">₹{p.selling_price?.toLocaleString('en-IN')}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setRestoreModalOpen(false)}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={restoreActionLoading}
                className="saas-btn-primary text-xs py-2 px-4"
              >
                {restoreActionLoading ? 'Restoring...' : 'Confirm Supplier Restore'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supplier Stats Modal */}
      {statsModalOpen && selectedSupplierStats && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <div>
                <h3 className="text-base text-[#111315]">
                  {selectedSupplierStats.companyName}
                </h3>
                <span className="type-meta">Demand Telemetry & Fulfillment Stats</span>
              </div>
              <button onClick={() => setStatsModalOpen(false)} className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="saas-card-metric p-3">
                <div className="type-kpi">{selectedSupplierStats.totalProducts}</div>
                <div className="type-meta text-[#6B7280]">Products</div>
              </div>
              <div className="saas-card-metric p-3">
                <div className="type-kpi">{selectedSupplierStats.totalViews}</div>
                <div className="type-meta text-[#6B7280]">Catalog views</div>
              </div>
              <div className="saas-card-metric p-3">
                <div className="type-kpi">{selectedSupplierStats.totalRfqs}</div>
                <div className="type-meta text-[#6B7280]">Volume RFQs</div>
              </div>
              <div className="saas-card-metric p-3">
                <div className="type-kpi">{selectedSupplierStats.totalOrders}</div>
                <div className="type-meta text-[#6B7280]">Orders</div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E2E4E8]">
              <button onClick={() => setStatsModalOpen(false)} className="saas-btn-secondary text-xs py-1.5 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="w-full max-w-md p-6 rounded-2xl bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <h3 className="text-base text-[#111315] font-bold">
                Add Supplier Partner
              </h3>
              <button 
                type="button" 
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="saas-label">Company Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. AeroFast Precision Engineering Ltd"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="saas-label">Contact Person *</label>
                  <input 
                    type="text"
                    required
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
                <div>
                  <label className="saas-label">Email Address *</label>
                  <input 
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="saas-label">Phone *</label>
                  <input 
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>
                <div>
                  <label className="saas-label">Country *</label>
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
                <label className="saas-label">Address</label>
                <input 
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setCreateModalOpen(false)}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="saas-btn-primary text-xs py-2 px-4"
              >
                Create Supplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
