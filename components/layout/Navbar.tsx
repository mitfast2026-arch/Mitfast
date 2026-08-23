'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, User, ArrowRight } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#services', label: 'Services' },
  { href: '/products', label: 'Products' },
  { href: '/enquiry', label: 'Enquiry' },
];

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success && json.data?.logoUrl) {
          setLogoUrl(String(json.data.logoUrl).trim() || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const brandLogoSrc = logoUrl || '/images/logo.png';

  // Home-only: dark section state must not leak onto other routes after client navigation
  const [homeDarkSection, setHomeDarkSection] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDarkSection = isHome && homeDarkSection;

  useEffect(() => {
    function getScrollY() {
      const lenis = (window as Window & { __lenis?: { scroll: number } }).__lenis;
      if (lenis && Number.isFinite(lenis.scroll)) {
        return lenis.scroll;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function updateScrollState(scrollY?: number) {
      const y = typeof scrollY === 'number' ? scrollY : getScrollY();
      setScrolled(y > 24);

      if (!isHome) {
        setHomeDarkSection(false);
        return;
      }

      const servicesEl = document.getElementById('services');
      if (servicesEl) {
        const rect = servicesEl.getBoundingClientRect();
        const navHeight = 64;
        const isInServices = rect.top <= navHeight && rect.bottom >= navHeight;
        setHomeDarkSection(isInServices);
      } else {
        setHomeDarkSection(false);
      }
    }

    function onWindowScroll() {
      updateScrollState();
    }

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

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await createBrowserClient().auth.getUser();
      setUser(user);

      if (user) {
        const supabase = createBrowserClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('user_id', user.id)
          .single();
        setUserRole((profile as any)?.role || null);
      } else {
        setUserRole(null);
      }

      try {
        const res = await fetch('/api/cart');
        const json = await res.json();
        if (res.ok && json.success) {
          setCartCount(json.data?.itemCount || 0);
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
    }

    checkAuth();
    function onCartUpdated() {
      checkAuth();
    }
    window.addEventListener('cart-updated', onCartUpdated);
    return () => window.removeEventListener('cart-updated', onCartUpdated);
  }, [pathname]);

  // Fully clear at page top; solid/frosted bar once scrolled (or on non-home pages)
  const showGlass = scrolled || !isHome;
  const isHeroNav = isHome && !showGlass && !isDarkSection;
  const isFrostedNav = isHome && showGlass && !isDarkSection;

  const navGlassClass = isHeroNav
    ? 'nav-glass nav-glass--transparent'
    : isDarkSection
      ? 'nav-glass nav-glass--dark'
      : isFrostedNav
        ? 'nav-glass nav-glass--frosted'
        : showGlass
          ? 'nav-glass nav-glass--light'
          : 'nav-glass nav-glass--transparent';

  const profileHref = user
    ? userRole === 'admin'
      ? '/admin/dashboard'
      : userRole === 'supplier'
      ? '/supplier/dashboard'
      : '/customer/dashboard'
    : '/auth?role=buyer&mode=signin';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 w-full font-sans ${navGlassClass}`}>
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 grid grid-cols-[1fr_auto_1fr] h-16 items-center">
        {/* Left: Brand Logo with refined dimensional depth shadow */}
        <div className="flex items-center justify-start z-10">
          <Link href="/" className="flex items-center group">
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

        {/* Center: Primary Navigation — single flex group, equal gaps */}
        <nav className="nav-primary hidden md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const [pathOnly, hash] = link.href.split('#');
            const route = pathOnly || '/';
            const active = hash
              ? false
              : route === '/'
                ? pathname === '/'
                : pathname === route || pathname.startsWith(`${route}/`);
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
                        ? 'text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
                        : 'text-white/85 hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
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
        <div className="flex items-center justify-end gap-3 z-10">
          <Link
            href="/cart"
            className={`nav-icon relative flex items-center justify-center h-9 w-9 rounded-xl ${
              isDarkSection ? 'nav-icon--dark' : isHeroNav ? 'nav-icon--hero' : ''
            }`}
            title="RFQ workspace"
            aria-label={cartCount > 0 ? `RFQ workspace, ${cartCount} line items` : 'RFQ workspace'}
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold font-sans transition-colors duration-300 ${
                isDarkSection || isHeroNav
                  ? 'bg-white text-[#111315]'
                  : 'bg-[#111315] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </Link>

          {!user && (
            <div className="hidden sm:flex items-center">
              <Link
                href="/enquiry"
                className={`nav-btn inline-flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-semibold font-sans group ${
                  isDarkSection
                    ? 'nav-btn--on-dark'
                    : isHeroNav
                      ? 'nav-btn--on-hero'
                      : ''
                }`}
              >
                <span>Get a Quote</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          )}

          <Link
            href={profileHref}
            className={`nav-icon flex items-center justify-center h-9 w-9 rounded-xl ${
              isDarkSection ? 'nav-icon--dark' : isHeroNav ? 'nav-icon--hero' : ''
            }`}
            title={user ? 'Profile' : 'Sign in'}
            aria-label={user ? 'Open profile' : 'Sign in'}
          >
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
