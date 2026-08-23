'use client';

import React from 'react';
import {
  LayoutDashboard,
  Package,
  CheckSquare,
  Building2,
  FileText,
  ShoppingCart,
  Mail,
  Layers,
  Settings,
} from 'lucide-react';
import { ApprovalsCountProvider, useApprovalsCount } from '@/components/portal/ApprovalsCountContext';
import PortalShell from '@/components/portal/PortalShell';
import { signOutTo } from '@/lib/client/sign-out';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { pendingApprovalsCount } = useApprovalsCount();

  function handleSignOut() {
    signOutTo('/auth?role=admin&mode=signin');
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    {
      label: 'Approvals',
      href: '/admin/approvals',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Suppliers', href: '/admin/suppliers', icon: Building2 },
    { label: 'Enquiries', href: '/admin/enquiries', icon: Mail },
    { label: 'RFQs', href: '/admin/rfqs', icon: FileText },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Categories', href: '/admin/categories', icon: Layers },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <PortalShell
      navItems={navItems}
      brandTitle="MITFAST Admin"
      brandSubtitle="Operations Control"
      avatarLabel="M"
      settingsHref="/admin/settings"
      signOutHref="/auth?role=admin&mode=signin"
      onSignOut={handleSignOut}
      searchPlaceholder="Search operations…"
    >
      {children}
    </PortalShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApprovalsCountProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ApprovalsCountProvider>
  );
}
