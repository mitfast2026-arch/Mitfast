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
  Bell,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { signOutTo } from '@/lib/client/sign-out';
import OverlayPortal, { OverlayBackdrop } from '@/components/ui/OverlayPortal';
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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    function onChange() {
      if (mq.matches) setMobileOpen(false);
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    { label: 'Notifications', href: '/customer/notifications', icon: Bell },
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

  function SidenavBody({
    onNavigate,
    isDrawer,
  }: {
    onNavigate?: () => void;
    isDrawer?: boolean;
  }) {
    return (
      <>
        {!isDrawer && (
          <div className="px-3.5 pt-1 pb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
              Account
            </p>
            <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#111111] truncate mt-2 leading-snug">
              {profile?.full_name || 'Buyer'}
            </p>
          </div>
        )}

        <div className={clsx('space-y-6 flex-1', isDrawer && 'pt-1')}>
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
          onClick={() => {
            onNavigate?.();
            handleSignOut();
          }}
          className="mt-6 flex items-center gap-3 w-full px-3.5 py-3 rounded-[14px] text-[15px] sm:text-[16px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
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

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="lg:hidden sticky top-16 z-sticky -mx-4 mb-4 px-4 py-2.5 md:-mx-8 md:px-8 bg-white/95 backdrop-blur-md border-b border-[#F0F2F5] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-3.5 rounded-[12px] bg-[#f0f2f5] hover:bg-[#e4e7eb] active:scale-[0.98] text-[14px] sm:text-[15px] font-semibold text-[#111111] transition-all shrink-0"
              aria-label="Open customer navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="customer-nav-drawer"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
              <span>Menu</span>
            </button>
            <p className="min-w-0 text-[13px] sm:text-[14px] font-semibold text-[#6b7280] truncate text-right">
              {profile?.full_name || 'Buyer'}
            </p>
          </div>

          <OverlayPortal
            open={mobileOpen}
            layer="drawer"
            onEscape={() => setMobileOpen(false)}
            className="lg:hidden flex"
          >
            <OverlayBackdrop
              className="bg-black/40 backdrop-blur-xs transition-opacity duration-200"
              onClick={() => setMobileOpen(false)}
            />
            <div
              id="customer-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Customer Navigation"
              className="relative w-[min(320px,88vw)] md:w-[340px] max-w-[90vw] h-full bg-white flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-250 ease-out"
            >
              <div className="flex items-center justify-between px-4 sm:px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5 border-b border-[#F0F2F5] shrink-0 bg-white">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                    Account
                  </p>
                  <p className="text-[16px] font-extrabold tracking-[-0.02em] text-[#111111] truncate mt-0.5 leading-snug">
                    {profile?.full_name || 'Buyer'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="h-9 w-9 -mr-1 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111111] hover:bg-[#F4F5F7] transition-colors shrink-0"
                  aria-label="Close navigation"
                >
                  <X className="w-5 h-5" strokeWidth={1.8} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col">
                <SidenavBody isDrawer onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </OverlayPortal>

          <main className="buyer-main flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
