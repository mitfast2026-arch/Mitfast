'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Heart,
  ShoppingCart,
  User,
  FileText,
  MapPin,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { signOutTo } from '@/lib/client/sign-out';
import { clsx } from 'clsx';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  external?: boolean;
  match?: (pathname: string) => boolean;
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{
    id: string;
    full_name?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState({
    orders: 0,
    wishlist: 0,
    cart: 0,
    quotes: 0,
  });

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth?role=buyer&mode=signin');
          return;
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('user_id', user.id)
          .single();

        if (prof) {
          setProfile(prof);
          // One lightweight count endpoint instead of 5 full list payloads
          fetch('/api/customer/badge-counts')
            .then((r) => r.json())
            .then((json) => {
              if (json?.success && json.data) {
                setCounts({
                  orders: json.data.orders || 0,
                  wishlist: json.data.wishlist || 0,
                  cart: json.data.cart || 0,
                  quotes: json.data.quotes || 0,
                });
              }
            })
            .catch(() => {
              /* badges are non-critical */
            });
        }
      } catch (err) {
        console.error('Customer auth check error:', err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleSignOut() {
    signOutTo('/auth?role=buyer&mode=signin');
  }

  const shopNav: NavItem[] = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    {
      label: 'Orders',
      href: '/customer/orders',
      icon: Package,
      badge: counts.orders > 0 ? counts.orders : undefined,
    },
    {
      label: 'Quotes / RFQs',
      href: '/customer/quotes',
      icon: FileText,
      badge: counts.quotes > 0 ? counts.quotes : undefined,
      match: (p) =>
        p.startsWith('/customer/quotes') ||
        p.startsWith('/customer/enquiries') ||
        p.startsWith('/customer/rfqs'),
    },
    {
      label: 'Wishlist',
      href: '/customer/wishlist',
      icon: Heart,
      badge: counts.wishlist > 0 ? counts.wishlist : undefined,
    },
    {
      label: 'Cart',
      href: '/cart',
      icon: ShoppingCart,
      badge: counts.cart > 0 ? counts.cart : undefined,
      external: true,
    },
  ];

  const accountNav: NavItem[] = [
    { label: 'Profile', href: '/customer/profile', icon: User },
    { label: 'Addresses', href: '/customer/addresses', icon: MapPin },
    { label: 'Security', href: '/customer/settings', icon: Shield },
  ];

  function isActive(item: NavItem) {
    if (item.external) return pathname === item.href;
    if (item.match) return item.match(pathname);
    if (item.href === '/customer/dashboard') return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  function NavList({
    items,
    onNavigate,
  }: {
    items: NavItem[];
    onNavigate?: () => void;
  }) {
    return (
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'buyer-nav-row',
                active ? 'buyer-nav-active' : 'buyer-nav-idle'
              )}
            >
              <Icon className="w-[22px] h-[22px] shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined ? (
                <span
                  className={clsx(
                    'min-w-[1.4rem] h-[1.4rem] px-1 rounded-full text-[11px] font-mono font-bold flex items-center justify-center',
                    active ? 'bg-white/20 text-white' : 'bg-[#111111]/8 text-[#111111]'
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  function SidenavBody({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="px-3.5 pt-1 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
            Account
          </p>
          <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#111111] truncate mt-2 leading-snug">
            {profile?.full_name || 'Buyer'}
          </p>
        </div>

        <div className="space-y-7 flex-1">
          <div>
            <p className="px-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">
              Shop
            </p>
            <NavList items={shopNav} onNavigate={onNavigate} />
          </div>
          <div>
            <p className="px-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">
              Account
            </p>
            <NavList items={accountNav} onNavigate={onNavigate} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-8 flex items-center gap-3 w-full px-3.5 py-3 rounded-[14px] text-[16px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]/80 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.75} />
          Sign out
        </button>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 buyer-shell">
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#6b7280]">Loading your account…</p>
      </div>
    );
  }

  return (
    <div className="buyer-shell min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="buyer-frame flex-1">
        <aside className="buyer-sidenav hidden lg:flex flex-col">
          <SidenavBody />
        </aside>

        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md px-4 py-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2.5 h-11 px-4 rounded-[12px] bg-[#f0f2f5] text-[15px] font-semibold text-[#111111]"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
            Menu
          </button>
          <div className="flex items-center gap-1">
            {shopNav.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={clsx(
                    'relative h-11 w-11 rounded-[12px] flex items-center justify-center',
                    active ? 'bg-[#111111] text-white shadow-[var(--buyer-shadow-sm)]' : 'text-[#6b7280]'
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                  {item.badge !== undefined ? (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#B91C1C]" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {mobileOpen ? (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative w-[280px] max-w-[85%] h-full bg-white p-4 flex flex-col overflow-y-auto shadow-[var(--buyer-shadow-md)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-semibold text-[#111111] truncate">
                  {profile?.full_name || 'Buyer'}
                </p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#eceef0]"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidenavBody onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="buyer-main flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
