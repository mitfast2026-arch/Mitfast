'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, Mail, Phone, User } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';
import {
  DataTable,
  SkeletonTableRows,
  EmptyState,
  type DataTableColumn,
} from '@/components/portal/ds';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
};

type CustomersResponse = {
  customers: CustomerRow[];
  total: number;
  page: number;
  limit: number;
};

function AdminCustomersPageContent() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadCustomers = useCallback(
    async (showLoading = true, opts?: { force?: boolean }) => {
      const url = `/api/customers?page=${page}&limit=${PORTAL_PAGE_LIMIT}`;
      const force = Boolean(opts?.force);
      const existing = force ? null : peekPortalCache<CustomersResponse>(url);

      if (existing) {
        setCustomers(existing.data.customers || []);
        setTotal(existing.data.total || 0);
        setLoading(false);
      } else if (showLoading) {
        setLoading(true);
      }

      try {
        const result = await cachedApiGet<CustomersResponse>(url, {
          force: force || (showLoading && !existing),
        });
        if (result.ok) {
          let list = result.data.customers || [];
          if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            list = list.filter(
              (c) =>
                (c.full_name || '').toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (c.phone || '').includes(q)
            );
          }
          setCustomers(list);
          setTotal(result.data.total || 0);
          markPortalContentReady('/admin/customers');
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedSearch]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 shrink-0 text-portal-muted" />
          <span className="truncate font-medium">{row.full_name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs truncate">
          <Mail className="w-3 h-3 shrink-0 text-portal-muted" />
          {row.email}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
          <Phone className="w-3 h-3 shrink-0 text-portal-muted" />
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Profile ID',
      render: (row) => <span className="type-id truncate">{row.id.slice(0, 8)}…</span>,
    },
  ];

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        title="Customers"
        description="Registered buyer accounts — use profile IDs when creating manual orders."
        actions={
          <button
            type="button"
            onClick={() => loadCustomers(true, { force: true })}
            className="saas-btn-secondary gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <AdminToolbar>
        <div className="saas-search-field w-full sm:max-w-sm">
          <Search className="saas-search-icon" />
          <input
            type="text"
            placeholder="Filter loaded page by name, email, phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input w-full"
          />
        </div>
      </AdminToolbar>

      {loading && customers.length === 0 ? (
        <SkeletonTableRows rows={8} />
      ) : customers.length === 0 ? (
        <EmptyState label="No customers found." />
      ) : (
        <DataTable
          columns={columns}
          rows={customers}
          page={page}
          pageSize={PORTAL_PAGE_LIMIT}
          total={total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<SkeletonTableRows rows={8} />}>
      <AdminCustomersPageContent />
    </Suspense>
  );
}
