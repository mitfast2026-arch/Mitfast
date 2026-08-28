'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Building2, 
  ChevronLeft, 
  Save, 
  Archive, 
  RotateCcw, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Package, 
  TrendingUp, 
  Check, 
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

export default function AdminSupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');

  async function loadSupplierData() {
    setLoading(true);
    try {
      const [supRes, statsRes] = await Promise.all([
        fetch(`/api/suppliers/${supplierId}`).then(r => r.json()),
        fetch(`/api/suppliers/${supplierId}/stats`).then(r => r.json())
      ]);

      if (supRes.success && supRes.data) {
        const s = supRes.data.supplier;
        setSupplier(s);
        setProducts(supRes.data.products || []);
        setCompanyName(s.company_name || '');
        setContactPerson(s.contact_person || '');
        setEmail(s.email || '');
        setPhone(s.phone || '');
        setAddress(s.address || '');
        setCountry(s.country || '');
        setWebsite(s.website || '');
      }

      if (statsRes.success) {
        setStats(statsRes.data?.summary ?? statsRes.data);
      }
    } catch (err) {
      console.error('Failed to load supplier detail:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (supplierId) loadSupplierData();
  }, [supplierId]);

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          contactPerson,
          email,
          phone,
          address: address || null,
          country,
          website: website || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to update supplier details');
      } else {
        setSuccessMsg('Supplier parameters updated successfully');
        setSupplier(json.data.supplier);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating supplier');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive() {
    if (!supplier) return;
    const endpoint = supplier.status === 'archived' ? 'restore' : 'archive';
    try {
      await fetch(`/api/suppliers/${supplier.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreAllProducts: true }),
      });
      loadSupplierData();
    } catch (err) {
      console.error('Archive toggle error:', err);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-portal-muted text-xs">
        Loading supplier details...
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="saas-panel p-12 text-center space-y-4">
        <h2 className="type-section">Supplier not found</h2>
        <p className="text-xs text-portal-muted">The requested manufacturing partner profile does not exist.</p>
        <Link href="/admin/suppliers" className="saas-btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Suppliers</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-6xl">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/admin/suppliers"
            className="p-2 rounded-xl bg-portal-panel border border-portal-border text-portal-muted hover:text-portal-text hover:bg-portal-hover shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="type-page">
                {supplier.company_name}
              </h1>
              <span className={
                supplier.status === 'active' 
                  ? 'saas-badge-success' 
                  : supplier.status === 'pending' 
                  ? 'saas-badge-gold' 
                  : 'saas-badge-danger'
              }>
                {supplier.status.toUpperCase()}
              </span>
            </div>
            <p className="type-subtitle mt-0.5">
              Supplier Profile • Registered on {new Date(supplier.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button 
            onClick={handleToggleArchive}
            className={`saas-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 ${
              supplier.status === 'archived' ? 'text-portal-success' : 'text-portal-danger'
            }`}
          >
            {supplier.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            <span>{supplier.status === 'archived' ? 'Restore Supplier' : 'Archive Partner'}</span>
          </button>
          <button 
            onClick={loadSupplierData}
            className="saas-neu-button text-xs py-2 px-3"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-portal-muted" />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2.5 font-medium">
          <Check className="w-4 h-4 shrink-0 text-portal-success" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2.5 font-medium">
          <X className="w-4 h-4 shrink-0 text-portal-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Performance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="saas-panel p-4 text-center space-y-1">
          <div className="type-kpi text-portal-text">{stats?.totalViews || 0}</div>
          <div className="type-kpi-label text-portal-muted">Catalog impressions</div>
        </div>
        <div className="saas-panel p-4 text-center space-y-1">
          <div className="type-kpi text-portal-text">{stats?.totalEnquiries || 0}</div>
          <div className="type-kpi-label text-portal-text">CAD inquiries</div>
        </div>
        <div className="saas-panel p-4 text-center space-y-1">
          <div className="type-kpi text-portal-text">{stats?.totalRfqs || 0}</div>
          <div className="type-kpi-label text-portal-text">Volume RFQs</div>
        </div>
        <div className="saas-panel p-4 text-center space-y-1">
          <div className="type-kpi text-portal-success">{stats?.totalOrders || 0}</div>
          <div className="type-kpi-label text-portal-success">Fulfilled orders</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Supplier Profile Form (5 cols) */}
        <form onSubmit={handleSaveSupplier} className="lg:col-span-5 saas-panel p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Building2 className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">
              Company & contact credentials
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="saas-label">Company Legal Name *</label>
              <input 
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div>
              <label className="saas-label">Contact Person *</label>
              <input 
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="saas-label">Business Email *</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
              <div>
                <label className="saas-label">Phone *</label>
                <input 
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="saas-label">Country *</label>
                <input 
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
              <div>
                <label className="saas-label">Website</label>
                <input 
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="saas-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="saas-label">Facility Address</label>
              <textarea 
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="saas-input text-xs resize-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-portal-border flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Update Details'}</span>
            </button>
          </div>
        </form>

        {/* Listed Products Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="saas-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-portal-text" />
              <h3 className="type-section">
                Manufactured catalog ({products.length})
              </h3>
            </div>
            <Link href="/admin/products" className="text-xs font-semibold text-portal-text hover:underline">
              View All in Catalog
            </Link>
          </div>

          <div className="saas-table-container">
            <table className="saas-table text-xs">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Factory base (₹)</th>
                  <th className="text-right">MOQ</th>
                  <th className="text-center">Approval</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-portal-muted text-xs">
                      No products listed for this supplier.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium text-portal-text">{p.name}</div>
                      </td>
                      <td className="text-portal-muted">{p.category?.name || 'Fasteners'}</td>
                      <td className="type-metric text-right text-portal-text">
                        ₹{p.supplier_price?.toLocaleString('en-IN')}
                      </td>
                      <td className="type-metric text-right text-portal-muted">{p.moq}</td>
                      <td className="text-center">
                        <span className={p.approval_status === 'approved' ? 'saas-badge-success' : 'saas-badge-gold'}>
                          {p.approval_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
