'use client';

/**
 * Navbar — Performance-optimized with consistent desktop & mobile navigation.
 *
 * Key features:
 * 1. Parallel auth + cart fetch instead of serial awaits
 * 2. Auth + role result cached in module-scope ref — does NOT re-fetch on route changes
 * 3. Logo fetched via shared settings-cache (deduped with Footer + Products page)
 * 4. Cart count re-fetches on 'cart-updated' event
 * 5. Mobile/tablet (<1024px) fullscreen drawer with complete, 100% working navigation links, search, cart, and account
 * 6. Desktop (>=1024px) inline navigation with active states and CTA
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingCart,
  User,
  ArrowRight,
  ChevronRight,
  Menu,
  X,
  Search,
  Globe,
  Layers,
  Boxes,
  Home,
  FileText,
  Loader2,
  Package,
  CornerDownLeft,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { getSettings, prefetchSettings } from '@/lib/client/settings-cache';
import OverlayPortal, { OverlayBackdrop } from '@/components/ui/OverlayPortal';

const NAV_LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/services', label: 'Services', icon: Layers },
  { href: '/products', label: 'Products', icon: Boxes },
  { href: '/enquiry', label: 'Enquiry', mobileLabel: 'Enquiry / RFQ', icon: FileText },
];

// Module-scope auth cache — survives route changes, cleared on sign-out
type AuthCache = { userId: string; role: string | null } | null;
let authCache: AuthCache = null;

async function fetchCartCount(): Promise<number> {
  try {
    const res = await fetch('/api/cart?countOnly=1');
    const json = await res.json();
    if (res.ok && json.success) {
      return typeof json.data?.itemCount === 'number'
        ? json.data.itemCount
        : Array.isArray(json.data?.items)
          ? json.data.items.length
          : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function resolveRole(userId: string): Promise<string | null> {
  if (authCache?.userId === userId) return authCache.role;
  try {
    const supabase = createBrowserClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();
    const role = (profile as any)?.role || null;
    authCache = { userId, role };
    return role;
  } catch {
    return null;
  }
}

function isLinkActive(pathname: string, href: string): boolean {
  const [pathOnly, hash] = href.split('#');
  const route = pathOnly || '/';
  if (hash) return false;
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';
  const isServices = pathname === '/services';
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Mobile menu & search modal state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const initedRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  // ── Settings (logo URL) — uses shared cache ──
  useEffect(() => {
    prefetchSettings();
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled && s?.logoUrl) setLogoUrl(s.logoUrl.trim() || null);
    });
    return () => { cancelled = true; };
  }, []);

  const brandLogoSrc = logoUrl || '/images/logo.png';

  const [scrolled, setScrolled] = useState(false);
  const [homeDarkSection, setHomeDarkSection] = useState(false);
  const isDarkSection = isServices || (isHome && homeDarkSection);

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const openMobileSearch = useCallback(() => {
    setMobileOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 200);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchModalOpen(false);
  }, [pathname]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus desktop search input when modal opens & reset on close
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => {
        desktopSearchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setLiveResults([]);
      setSelectedIndex(-1);
      setIsSearching(false);
    }
  }, [searchModalOpen]);

  // Debounced live search preview for the SaaS panel
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !searchModalOpen) {
      setLiveResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=5`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.products)) {
          setLiveResults(json.data.products);
          setSelectedIndex(0);
        } else {
          setLiveResults([]);
          setSelectedIndex(-1);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setLiveResults([]);
          setSelectedIndex(-1);
        }
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, searchModalOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    return () => {
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    function onChange() {
      if (mq.matches) setMobileOpen(false);
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    function getScrollY() {
      const lenis = (window as Window & { __lenis?: { scroll: number } }).__lenis;
      if (lenis && Number.isFinite(lenis.scroll)) return lenis.scroll;
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function updateScrollState(scrollY?: number) {
      const y = typeof scrollY === 'number' ? scrollY : getScrollY();
      setScrolled(y > 24);

      if (!isHome) { setHomeDarkSection(false); return; }

      const servicesEl = document.getElementById('services');
      if (servicesEl) {
        const rect = servicesEl.getBoundingClientRect();
        const navHeight = 64;
        setHomeDarkSection(rect.top <= navHeight && rect.bottom >= navHeight);
      } else {
        setHomeDarkSection(false);
      }
    }

    function onWindowScroll() { updateScrollState(); }
    function onAppScroll(event: Event) {
      const detail = (event as CustomEvent<{ y?: number }>).detail;
      updateScrollState(detail?.y);
    }

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('resize', onWindowScroll, { passive: true });
    window.addEventListener('app-scroll', onAppScroll as EventListener);
    updateScrollState();

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('resize', onWindowScroll);
      window.removeEventListener('app-scroll', onAppScroll as EventListener);
    };
  }, [isHome, pathname]);

  // ── Auth + Cart — runs once on mount ──
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const supabase = createBrowserClient();
      const [authResult, count] = await Promise.all([
        supabase.auth.getUser(),
        fetchCartCount(),
      ]);

      if (cancelled) return;

      const currentUser = authResult.data.user;
      setUser(currentUser);
      setCartCount(count);

      if (currentUser) {
        const role = await resolveRole(currentUser.id);
        if (!cancelled) setUserRole(role);
      } else {
        authCache = null;
        setUserRole(null);
      }
    }

    if (!initedRef.current) {
      initedRef.current = true;
      void initAuth();
    }

    async function onCartUpdated(e?: Event) {
      const detail = (e as CustomEvent<{ delta?: number; exactCount?: number }> | undefined)?.detail;
      if (detail?.exactCount !== undefined) {
        setCartCount(detail.exactCount);
      } else if (detail?.delta !== undefined) {
        setCartCount((prev) => Math.max(0, prev + detail.delta!));
      }
      const count = await fetchCartCount();
      if (!cancelled) setCartCount(count);
    }

    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        authCache = null;
        setUserRole(null);
        setCartCount(0);
      } else if (nextUser.id !== authCache?.userId) {
        void resolveRole(nextUser.id).then((role) => {
          if (!cancelled) setUserRole(role);
        });
        void fetchCartCount().then((count) => {
          if (!cancelled) setCartCount(count);
        });
      }
    });

    window.addEventListener('cart-updated', onCartUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('cart-updated', onCartUpdated);
      subscription.unsubscribe();
    };
  }, []);

  const showGlass = scrolled || !isHome;
  const isHeroNav = isHome && !showGlass && !isDarkSection;
  const isFrostedNav = showGlass && !isDarkSection;

  const navGlassClass = isHeroNav
    ? 'nav-glass nav-glass--transparent'
    : isDarkSection
      ? 'nav-glass nav-glass--dark'
      : isFrostedNav
        ? 'nav-glass nav-glass--frosted'
        : 'nav-glass nav-glass--transparent';

  const profileHref = user
    ? userRole === 'admin'
      ? '/admin/dashboard'
      : userRole === 'supplier'
      ? '/supplier/dashboard'
      : '/customer/dashboard'
    : '/auth?role=buyer&mode=signin';

  const iconClass = `nav-icon relative flex items-center justify-center h-10 w-10 min-h-10 min-w-10 rounded-xl ${
    isDarkSection ? 'nav-icon--dark' : ''
  }`;

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push('/products');
    }
    closeMobileMenu();
    setSearchModalOpen(false);
  }

  function handleSearchInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = liveResults.length;
      if (liveResults.length === 0) return;
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const maxIndex = liveResults.length;
      if (liveResults.length === 0) return;
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < liveResults.length) {
        e.preventDefault();
        const item = liveResults[selectedIndex];
        router.push(`/products/${item.id}`);
        setSearchModalOpen(false);
      }
    }
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-header w-full font-sans ${navGlassClass}`}>
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-20 flex items-center justify-between h-16 gap-4">
        {/* Left: Brand Logo + mobile/tablet menu toggle */}
        <div className="flex items-center justify-start gap-2 sm:gap-3 shrink-0 z-10">
          <button
            ref={menuButtonRef}
            type="button"
            className={`lg:hidden ${iconClass}`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="nav-mobile-drawer"
            onClick={() => {
              if (mobileOpen) {
                closeMobileMenu();
              } else {
                openMobileMenu();
              }
            }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center group" onClick={closeMobileMenu}>
            <img
              src={brandLogoSrc}
              alt="MITFAST Logo"
              className={`h-8 sm:h-9 w-auto object-contain transition-all duration-300 group-hover:scale-[1.02] ${
                isDarkSection
                  ? 'drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)] brightness-105'
                  : isHeroNav
                    ? 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]'
                    : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.08)]'
              }`}
            />
          </Link>
        </div>

        {/* Center: Primary Navigation (Desktop & Laptop >= 1024px) */}
        <nav className="nav-primary hidden lg:flex items-center justify-center flex-1 min-w-0" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                data-label={link.label}
                className={`nav-item ${active ? 'is-active' : ''} ${
                  isDarkSection
                    ? 'nav-item--on-dark'
                    : isHeroNav
                      ? 'nav-item--on-hero'
                      : isFrostedNav
                        ? 'nav-item--frosted'
                        : ''
                } ${
                  isDarkSection
                    ? active
                      ? 'text-white'
                      : 'text-[#F7F7F8]/85 hover:text-white'
                    : isHeroNav
                      ? active
                        ? 'text-[#111315] font-bold'
                        : 'text-[#111315]/80 hover:text-[#111315]'
                      : active
                        ? 'text-[#111315] font-bold'
                        : 'text-[#111315]/80 hover:text-[#111315]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 z-10">
          {/* Desktop & Tablet Search Trigger (>= 640px) */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className={`hidden sm:flex ${iconClass}`}
            title="Search products (⌘K / Ctrl+K)"
            aria-label="Search products"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Mobile Search Trigger (< 640px) */}
          <button
            type="button"
            className={`sm:hidden ${iconClass}`}
            title="Search products"
            aria-label="Search products"
            onClick={openMobileSearch}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Cart Icon with Live Badge */}
          <Link
            href="/cart"
            className={iconClass}
            title="RFQ Cart"
            aria-label={cartCount > 0 ? `RFQ Cart, ${cartCount} line items` : 'RFQ Cart'}
            onClick={closeMobileMenu}
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-semibold font-mono leading-none transition-colors duration-300 ${
                isDarkSection
                  ? 'bg-white text-[#111315]'
                  : 'bg-[#111315] text-white'
              }`}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* Desktop "Get a Quote" CTA (>=1024px) */}
          {!user && (
            <div className="hidden lg:flex items-center">
              <Link
                href="/enquiry"
                className={`nav-btn inline-flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-semibold font-sans group whitespace-nowrap ${
                  isDarkSection ? 'nav-btn--on-dark' : ''
                }`}
              >
                <span>Get a Quote</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          )}

          {/* Account Icon */}
          <Link
            href={profileHref}
            className={iconClass}
            title={user ? 'Profile' : 'Sign in'}
            aria-label={user ? 'Open profile' : 'Sign in'}
            onClick={closeMobileMenu}
          >
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Mobile Navigation Overlay (<1024px) — portaled off nav-glass ── */}
      <OverlayPortal
        open={mobileOpen}
        layer="drawer"
        onEscape={closeMobileMenu}
        className="lg:hidden overflow-hidden"
      >
        <OverlayBackdrop className="bg-black/40 backdrop-blur-sm" onClick={closeMobileMenu} />
        <div
          ref={menuRef}
          id="nav-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="absolute inset-0 bg-white flex flex-col overflow-hidden shadow-2xl"
        >
            {/* Drawer Header (Top Bar: [X] MITFAST               [Search] [Cart]) */}
            <div className="flex items-center justify-between px-5 sm:px-8 h-16 border-b border-[#F0F2F5] shrink-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="p-1.5 -ml-1.5 text-[#111315] hover:text-[#000000] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" strokeWidth={1.8} />
                </button>
                <Link href="/" className="flex items-center" onClick={closeMobileMenu}>
                  <img
                    src={brandLogoSrc}
                    alt="MITFAST Logo"
                    className="h-8 w-auto object-contain"
                  />
                </Link>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                  className="p-2 text-[#111315] hover:text-black transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
                <Link
                  href="/cart"
                  onClick={closeMobileMenu}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111315] text-white text-xs font-semibold hover:bg-black transition-colors shadow-sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
                </Link>
              </div>
            </div>

            {/* Quick Search Bar */}
            <div className="px-5 sm:px-8 pt-3 pb-2 shrink-0">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, fasteners, CNC parts..."
                  className="w-full h-11 pl-10 pr-10 bg-[#F7F7F8] rounded-xl text-sm text-[#111315] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111315] border-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#111315]"
                    aria-label="Clear search input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>

            {/* Navigation Links (Direct 1:1 matching desktop) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-8 py-3 flex flex-col gap-2">
              <nav className="flex flex-col gap-1" aria-label="Mobile Navigation">
                {NAV_LINKS.map((link) => {
                  const active = isLinkActive(pathname, link.href);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={`flex items-center justify-between py-3.5 px-3.5 rounded-xl transition-all duration-150 ${
                        active
                          ? 'bg-[#111315]/[0.06] text-[#111315] font-semibold shadow-xs'
                          : 'text-[#374151] hover:text-[#111315] hover:bg-[#111315]/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`p-2 rounded-lg transition-colors ${
                            active ? 'bg-[#111315] text-white' : 'bg-[#F7F7F8] text-[#6B7280]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[15px] ${active ? 'font-semibold text-[#111315]' : 'font-medium'}`}>
                          {link.mobileLabel || link.label}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${active ? 'text-[#111315]' : 'text-[#9CA3AF]'}`} />
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Account & Country/Currency Footer */}
            <div className="px-5 sm:px-8 py-4 border-t border-[#F0F2F5] bg-white flex flex-col gap-3.5 shrink-0">
              {user ? (
                <Link
                  href={profileHref}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F7F8] hover:bg-[#F0F2F5] border border-[#E5E7EB] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#111315] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {user.email ? user.email.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-[#111315] truncate">
                        {user.user_metadata?.full_name || user.email || 'My Account'}
                      </p>
                      <p className="text-xs text-[#6B7280] capitalize">
                        {userRole ? `${userRole} Dashboard` : 'View Dashboard'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                </Link>
              ) : (
                <Link
                  href={profileHref}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl bg-[#111315] text-white font-semibold text-sm hover:bg-black active:scale-[0.99] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                >
                  <User className="w-4 h-4" />
                  <span>Sign in / Register</span>
                </Link>
              )}

              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span className="flex items-center gap-2 font-normal">
                  <Globe className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>India (English) · INR (₹)</span>
                </span>
                <Link
                  href="/cart"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-1.5 font-semibold text-[#111315] hover:text-black transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Cart ({cartCount})</span>
                </Link>
              </div>
            </div>
          </div>
      </OverlayPortal>

      {/* ── Desktop & Tablet Command / Search Modal (>= sm) ── */}
      <OverlayPortal
        open={searchModalOpen}
        layer="modal"
        onEscape={() => setSearchModalOpen(false)}
        className="flex items-start justify-center pt-20 sm:pt-28 px-4"
      >
        <OverlayBackdrop
          className="bg-black/50 backdrop-blur-xs"
          onClick={() => setSearchModalOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search products and catalog"
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Search Input Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex items-center px-4 py-3.5 border-b border-gray-100 bg-white"
          >
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-3 shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
            )}
            <input
              ref={desktopSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              placeholder="Search products, fasteners, CNC parts, materials..."
              className="flex-1 text-[15px] text-gray-900 placeholder:text-gray-400 bg-transparent outline-none border-none pr-3"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setLiveResults([]);
                  setSelectedIndex(-1);
                  desktopSearchInputRef.current?.focus();
                }}
                className="p-1 text-gray-400 hover:text-gray-700 mr-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchModalOpen(false)}
              className="px-2 py-0.5 text-[11px] font-mono font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors"
              title="Close (Esc)"
            >
              ESC
            </button>
          </form>

          {/* Panel Scrollable Body */}
          <div className="max-h-[min(55vh,480px)] overflow-y-auto divide-y divide-gray-100/80 bg-white">
            {searchQuery.trim() ? (
              /* Live Results View */
              liveResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Products ({liveResults.length})
                  </div>
                  {liveResults.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const primaryImage = item.images?.[0]?.image_url;
                    return (
                      <Link
                        key={item.id}
                        href={`/products/${item.id}`}
                        onClick={() => setSearchModalOpen(false)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? 'bg-gray-100/90 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                            {primaryImage ? (
                              <img
                                src={primaryImage}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.name}
                              </span>
                              {item.category?.name && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200/60 shrink-0">
                                  {item.category.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                              {item.sku && <span className="font-mono text-[11px]">SKU: {item.sku}</span>}
                              {item.moq ? <span>· MOQ: {item.moq}</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.selling_price > 0 && (
                            <span className="text-xs font-semibold text-gray-900">
                              ₹{Number(item.selling_price).toLocaleString('en-IN')}
                            </span>
                          )}
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 ${
                              isSelected ? 'translate-x-0.5 text-gray-700' : ''
                            } transition-transform`}
                          />
                        </div>
                      </Link>
                    );
                  })}

                  {/* View all in catalog row */}
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    onMouseEnter={() => setSelectedIndex(liveResults.length)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                      selectedIndex === liveResults.length
                        ? 'bg-gray-100/90 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Search className="w-4 h-4 text-gray-400" />
                      <span>
                        Search all catalog for <span className="font-semibold text-black">"{searchQuery.trim()}"</span>
                      </span>
                    </div>
                    <CornerDownLeft className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : !isSearching ? (
                <div className="py-10 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">No products found for "{searchQuery}"</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Try searching by material, standard (DIN/ISO), SKU, or generic part type.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-black transition-colors"
                    >
                      Search in full catalog
                    </button>
                    <Link
                      href="/enquiry"
                      onClick={() => setSearchModalOpen(false)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                    >
                      Submit Custom RFQ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-12 px-6 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                  <span className="text-xs text-gray-500">Searching catalog...</span>
                </div>
              )
            ) : (
              /* Idle / Empty Input State */
              <>
                <div className="p-4 bg-gray-50/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
                    Popular Inquiries
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Fasteners',
                      'Titanium Bolts',
                      'CNC Turned',
                      'Hex Nuts',
                      'Hydraulic Valves',
                      'High-Temp Alloys',
                      'Flanges',
                      'Couplings',
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSearchQuery(tag);
                          router.push(`/products?search=${encodeURIComponent(tag)}`);
                          setSearchModalOpen(false);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2 space-y-0.5">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Quick Navigation
                  </p>
                  <Link
                    href="/products"
                    onClick={() => setSearchModalOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">All Products Catalog</p>
                        <p className="text-xs text-gray-500">Explore fasteners, raw materials, CNC precision components</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link
                    href="/enquiry"
                    onClick={() => setSearchModalOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Request for Quote (RFQ)</p>
                        <p className="text-xs text-gray-500">Upload technical drawings and get precision quotes</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link
                    href="/services"
                    onClick={() => setSearchModalOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Manufacturing & CNC Services</p>
                        <p className="text-xs text-gray-500">Precision turning, milling, plating & testing</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Clean SaaS Shortcuts Footer */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] text-gray-700 shadow-2xs">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] text-gray-700 shadow-2xs">
                  ↓
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] text-gray-700 shadow-2xs">
                  ↵
                </kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] text-gray-700 shadow-2xs">
                  esc
                </kbd>
                <span>Close</span>
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-gray-400">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] text-gray-500 shadow-2xs">
                ⌘K
              </kbd>
              <span>to open</span>
            </span>
          </div>
        </div>
      </OverlayPortal>
    </header>
  );
}
