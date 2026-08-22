'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Building2,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import SupplierApprovalGate from '@/components/supplier/SupplierApprovalGate';
import PortalNavLink from '@/components/portal/PortalNavLink';
import { SupplierProvider, useSupplier } from '@/components/portal/SupplierContext';

function SupplierLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { supplier, loading } = useSupplier();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth?role=supplier&mode=signin');
  }

  if (loading && !supplier) {
    return (
      <div className="portal-ui flex h-screen saas-canvas-bg items-center justify-center">
        <div className="text-sm font-mono text-[#6B7280] animate-pulse">Loading Supplier Portal…</div>
      </div>
    );
  }

  if (supplier && supplier.status !== 'active') {
    return (
      <div className="portal-ui min-h-screen">
        <SupplierApprovalGate supplier={supplier as any} onSupplierUpdated={() => window.location.reload()} />
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/supplier/dashboard', icon: LayoutDashboard },
    { label: 'My Products', href: '/supplier/products', icon: Package },
    { label: 'Enquiries', href: '/supplier/enquiries', icon: MessageSquare },
    { label: 'Production orders', href: '/supplier/orders', icon: ShoppingCart },
    { label: 'Volume RFQs', href: '/supplier/rfqs', icon: FileText },
    { label: 'Profile', href: '/supplier/profile', icon: User },
    { label: 'Settings', href: '/supplier/settings', icon: Settings },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="portal-ui flex h-screen saas-canvas-bg text-[#111315] overflow-hidden">
      <aside className="hidden lg:flex flex-col w-72 m-3 mr-0 rounded-3xl saas-sidebar-gradient p-6 space-y-7 shrink-0 justify-between h-[calc(100vh-1.5rem)] overflow-y-auto">
        <div className="space-y-7">
          <Link href="/supplier/profile" className="flex items-center gap-3 pb-4 border-b border-[#E2E4E8]">
            <div className="h-11 w-11 rounded-full bg-[#111315] text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 truncate">
              <div className="text-sm font-semibold text-[#111315] truncate">
                {supplier?.company_name || 'Supplier Portal'}
              </div>
              <div className="text-xs text-[#6B7280] truncate font-mono">
                {supplier?.contact_person || 'Manufacturing Partner'}
              </div>
            </div>
          </Link>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/supplier/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                />
              );
            })}
          </nav>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-[#E2E4E8] text-sm text-[#6B7280]">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs">{currentDate}</span>
            <Link href="/" target="_blank" className="hover:text-[#111315] flex items-center gap-1.5">
              <span>Marketplace</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left py-2.5 px-3.5 rounded-full text-sm text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-20 mx-3 mt-3 rounded-full saas-glass-bar px-5 sm:px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden saas-btn-ghost"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 text-sm font-mono text-[#6B7280]">
              <span className="font-bold text-[#111315]">Supplier Portal</span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              <span className="capitalize text-[#111315]">
                {pathname.split('/')[2]?.replace(/-/g, ' ') || 'Dashboard'}
              </span>
            </div>
          </div>
        </header>

        {sidebarOpen && (
          <div className="lg:hidden mx-3 mt-3 p-4 saas-panel space-y-1.5">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/supplier/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  onClick={() => setSidebarOpen(false)}
                />
              );
            })}
          </div>
        )}

        <main className="p-6 sm:p-9 flex-1 w-full max-w-[90rem] mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <SupplierLayoutInner>{children}</SupplierLayoutInner>
    </SupplierProvider>
  );
}
