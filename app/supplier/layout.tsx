'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Eye,
  User,
  Settings,
  MessageSquare,
  FileText,
  ShoppingBag,
} from 'lucide-react';
import SupplierApprovalGate from '@/components/supplier/SupplierApprovalGate';
import { SupplierProvider, useSupplier } from '@/components/portal/SupplierContext';
import PortalShell from '@/components/portal/PortalShell';
import { PortalToaster } from '@/components/portal/ds';
import { signOutTo } from '@/lib/client/sign-out';
import { cachedApiGet, peekPortalCache } from '@/lib/client/portal-data-cache';

function SupplierLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { supplier, loading } = useSupplier();
  const [totalViews, setTotalViews] = React.useState<number | undefined>();

  React.useEffect(() => {
    if (!supplier?.id) return;
    let cancelled = false;
    const url = `/api/suppliers/${supplier.id}/stats`;

    const existing = peekPortalCache<{ summary?: { totalViews?: number } }>(url);
    if (existing && !cancelled) {
      setTotalViews(existing.data?.summary?.totalViews ?? 0);
    }

    void cachedApiGet<{ summary?: { totalViews?: number } }>(url).then((result) => {
      if (!cancelled && result.ok) {
        setTotalViews(result.data?.summary?.totalViews ?? 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supplier?.id]);

  function handleSignOut() {
    signOutTo('/auth?role=supplier&mode=signin');
  }

  if (loading && !supplier) {
    return (
      <div className="flex h-screen saas-canvas-bg items-center justify-center">
        <PortalToaster />
        <div className="text-sm font-mono text-portal-muted animate-pulse">Loading supplier account…</div>
      </div>
    );
  }

  if (supplier && supplier.status !== 'active') {
    return (
      <div className="min-h-screen saas-canvas-bg">
        <PortalToaster />
        <SupplierApprovalGate supplier={supplier as any} onSupplierUpdated={() => window.location.reload()} />
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/supplier/dashboard', icon: LayoutDashboard },
    { label: 'My Products', href: '/supplier/products', icon: Package },
    {
      label: 'Product views',
      href: '/supplier/product-views',
      icon: Eye,
      badge: totalViews,
    },
    { label: 'Orders', href: '/supplier/orders', icon: ShoppingBag },
    { label: 'Profile', href: '/supplier/profile', icon: User },
    { label: 'Settings', href: '/supplier/settings', icon: Settings },
  ];

  return (
    <PortalShell
      navItems={navItems}
      brandTitle={supplier?.company_name || 'Supplier Account'}
      brandSubtitle={supplier?.contact_person || 'Supplier'}
      brandHref="/supplier/profile"
      avatarLabel={supplier?.company_name || 'S'}
      settingsHref="/supplier/settings"
      notificationsHref="/supplier/orders"
      onSearchSubmit={(query) => {
        if (!query) return;
        router.push(`/supplier/products?search=${encodeURIComponent(query)}`);
      }}
      signOutHref="/auth?role=supplier&mode=signin"
      onSignOut={handleSignOut}
      searchPlaceholder="Search catalog…"
    >
      {children}
    </PortalShell>
  );
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <SupplierLayoutInner>{children}</SupplierLayoutInner>
    </SupplierProvider>
  );
}
