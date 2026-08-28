'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  CheckSquare,
  Building2,
  FileText,
  ShoppingCart,
  Mail,
  Layers,
  Images,
  Settings,
  Users,
} from 'lucide-react';
import { ApprovalsCountProvider, useApprovalsCount } from '@/components/portal/ApprovalsCountContext';
import PortalShell from '@/components/portal/PortalShell';
import { signOutTo } from '@/lib/client/sign-out';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    { label: 'Customers', href: '/admin/customers', icon: Users },
    { label: 'Enquiries', href: '/admin/enquiries', icon: Mail },
    { label: 'RFQs', href: '/admin/rfqs', icon: FileText },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Categories', href: '/admin/categories', icon: Layers },
    { label: 'Homepage', href: '/admin/homepage', icon: Images },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <PortalShell
      navItems={navItems}
      brandTitle="MITFAST Admin"
      brandSubtitle="Admin Panel"
      avatarLabel="M"
      settingsHref="/admin/settings"
      notificationsHref="/admin/enquiries"
      onSearchSubmit={(query) => {
        if (!query) return;
        router.push(`/admin/products?search=${encodeURIComponent(query)}`);
      }}
      signOutHref="/auth?role=admin&mode=signin"
      onSignOut={handleSignOut}
      searchPlaceholder="Search admin…"
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
