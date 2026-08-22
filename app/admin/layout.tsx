'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  LogOut,
  ChevronRight,
  Menu,
  X,
  Search,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import PortalNavLink from '@/components/portal/PortalNavLink';
import { ApprovalsCountProvider, useApprovalsCount } from '@/components/portal/ApprovalsCountContext';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pendingApprovalsCount } = useApprovalsCount();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    products: any[];
    suppliers: any[];
    rfqs: any[];
    orders: any[];
  }>({ products: [], suppliers: [], rfqs: [], orders: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ products: [], suppliers: [], rfqs: [], orders: [] });
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [pRes, sRes, rRes, oRes] = await Promise.all([
          fetch(`/api/products?mode=admin&search=${encodeURIComponent(searchQuery)}`).then((r) => r.json()),
          fetch(`/api/suppliers?search=${encodeURIComponent(searchQuery)}`).then((r) => r.json()),
          fetch(`/api/rfqs?search=${encodeURIComponent(searchQuery)}`).then((r) => r.json()),
          fetch(`/api/orders?search=${encodeURIComponent(searchQuery)}`).then((r) => r.json()),
        ]);

        setSearchResults({
          products: pRes.data?.products?.slice(0, 3) || [],
          suppliers: sRes.data?.suppliers?.slice(0, 3) || [],
          rfqs: rRes.data?.rfqs?.slice(0, 3) || [],
          orders: oRes.data?.orders?.slice(0, 3) || [],
        });
        setSearchOpen(true);
      } catch (err) {
        console.error('Quick search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth?role=admin&mode=signin');
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Approvals', href: '/admin/approvals', icon: CheckSquare, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Suppliers', href: '/admin/suppliers', icon: Building2 },
    { label: 'RFQs', href: '/admin/rfqs', icon: FileText },
    { label: 'Production Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Enquiries', href: '/admin/enquiries', icon: Mail },
    { label: 'Categories', href: '/admin/categories', icon: Layers },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const totalResults = searchResults.products.length + searchResults.suppliers.length + searchResults.rfqs.length + searchResults.orders.length;

  return (
    <div className="portal-ui flex h-screen saas-canvas-bg text-[#111315] overflow-hidden">
      <aside className="hidden lg:flex flex-col w-72 m-3 mr-0 rounded-3xl saas-sidebar-gradient p-6 space-y-7 shrink-0 justify-between h-[calc(100vh-1.5rem)] overflow-y-auto">
        <div className="space-y-7">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E2E4E8]">
            <div className="h-11 w-11 rounded-full bg-[#111315] text-white flex items-center justify-center font-bold text-base">
              M
            </div>
            <div className="space-y-0.5 truncate">
              <div className="text-sm font-semibold text-[#111315]">MITFAST Admin</div>
              <div className="text-xs text-[#6B7280] font-mono">Operations Control</div>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  badge={item.badge}
                />
              );
            })}
          </nav>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-[#E2E4E8] text-sm text-[#6B7280]">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs">{currentDate}</span>
            <Link href="/" target="_blank" className="hover:text-[#111315] flex items-center gap-1.5">
              <span>Public catalog</span>
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
        <header className="sticky top-0 z-30 mx-3 mt-3 rounded-full saas-glass-bar px-5 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden saas-btn-ghost"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 text-sm font-mono text-[#6B7280]">
              <span className="font-bold text-[#111315]">Admin Portal</span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              <span className="capitalize text-[#111315]">
                {pathname.split('/')[2] || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative hidden sm:block w-80" ref={searchRef}>
              <input
                type="text"
                placeholder="Search products, suppliers, RFQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.length >= 2) setSearchOpen(true);
                }}
                className="saas-input pl-10 pr-3 py-2.5"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />

              {searchOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 saas-panel p-3.5 space-y-2 z-50 text-sm max-h-80 overflow-y-auto">
                  {totalResults === 0 ? (
                    <div className="py-2 text-center text-[#6B7280]">No matching records found.</div>
                  ) : (
                    <>
                      {searchResults.products.length > 0 && (
                        <div className="space-y-1">
                          <div className="font-semibold text-[#6B7280] uppercase text-xs font-mono">Products</div>
                          {searchResults.products.map((p) => (
                            <Link
                              key={p.id}
                              href="/admin/products"
                              onClick={() => setSearchOpen(false)}
                              className="block p-2.5 rounded-xl hover:bg-[#ECEEF0]"
                            >
                              <div className="font-medium text-[#111315]">{p.name}</div>
                              <div className="text-xs text-[#6B7280] font-mono">₹{p.supplier_price} • MOQ: {p.moq}</div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {searchResults.suppliers.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-[#E2E4E8]">
                          <div className="font-semibold text-[#6B7280] uppercase text-xs font-mono">Suppliers</div>
                          {searchResults.suppliers.map((s) => (
                            <Link
                              key={s.id}
                              href={`/admin/suppliers/${s.id}`}
                              onClick={() => setSearchOpen(false)}
                              className="block p-2.5 rounded-xl hover:bg-[#ECEEF0]"
                            >
                              <div className="font-medium text-[#111315]">{s.company_name}</div>
                              <div className="text-xs text-[#6B7280] font-mono">{s.contact_person} • {s.country}</div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {searchResults.rfqs.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-[#E2E4E8]">
                          <div className="font-semibold text-[#6B7280] uppercase text-xs font-mono">RFQs</div>
                          {searchResults.rfqs.map((r) => (
                            <Link
                              key={r.id}
                              href="/admin/rfqs"
                              onClick={() => setSearchOpen(false)}
                              className="block p-2.5 rounded-xl hover:bg-[#ECEEF0]"
                            >
                              <div className="font-medium text-[#111315]">RFQ #{r.id.slice(0, 8)}</div>
                              <div className="text-xs text-[#6B7280] font-mono">{r.status}</div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {searchResults.orders.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-[#E2E4E8]">
                          <div className="font-semibold text-[#6B7280] uppercase text-xs font-mono">Orders</div>
                          {searchResults.orders.map((o) => (
                            <Link
                              key={o.id}
                              href="/admin/orders"
                              onClick={() => setSearchOpen(false)}
                              className="block p-2.5 rounded-xl hover:bg-[#ECEEF0]"
                            >
                              <div className="font-medium text-[#111315]">{o.order_number || o.id.slice(0, 8)}</div>
                              <div className="text-xs text-[#6B7280] font-mono">₹{o.total_amount} • {o.status}</div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <Link href="/admin/approvals" className="relative saas-btn-ghost" title="Pending Approvals">
              <Bell className="w-5 h-5" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111315] text-[9px] font-bold text-white">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {sidebarOpen && (
          <div className="lg:hidden mx-3 mt-3 p-4 saas-panel space-y-1.5">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  badge={item.badge}
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApprovalsCountProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ApprovalsCountProvider>
  );
}
