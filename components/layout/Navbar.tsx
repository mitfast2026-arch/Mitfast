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

  // Home-only: dark section state must not leak onto other routes after client navigation
  const [homeDarkSection, setHomeDarkSection] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDarkSection = isHome && homeDarkSection;

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY || 0;
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

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isHome, pathname]);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await createBrowserClient().auth.getUser();
      setUser(user);
      if (!user) {
        setCartCount(0);
        setUserRole(null);
        return;
      }

      const supabase = createBrowserClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
      setUserRole((profile as any)?.role || null);

      if ((profile as any)?.role === 'customer') {
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
      } else {
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

  // Fully clear at page top; solid bar once scrolled (or on non-home pages)
  const showGlass = scrolled || !isHome;
  const navGlassClass = !showGlass
    ? 'nav-glass nav-glass--transparent'
    : isDarkSection
      ? 'nav-glass nav-glass--dark'
      : 'nav-glass nav-glass--light';

  const profileHref = user
    ? userRole === 'admin'
      ? '/admin/dashboard'
      : userRole === 'supplier'
      ? '/supplier/dashboard'
      : '/customer/dashboard'
    : '/auth?role=buyer&mode=signin';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 w-full ${navGlassClass}`}>
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 grid grid-cols-[1fr_auto_1fr] h-16 items-center">
        {/* Left: Brand Logo with refined dimensional depth shadow */}
        <div className="flex items-center justify-start z-10">
          <Link href="/" className="flex items-center group">
            <img 
              src="/images/logo.png" 
              alt="MITFAST Logo" 
              className={`h-8 sm:h-9 w-auto object-contain transition-all duration-300 group-hover:scale-[1.02] ${
                isDarkSection
                  ? 'drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)] brightness-105'
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
                  isDarkSection ? 'nav-item--on-dark' : ''
                } ${
                  isDarkSection
                    ? active
                      ? 'text-white'
                      : 'text-[#F7F7F8]/85 hover:text-white'
                    : active
                      ? 'text-black'
                      : 'text-[#111315]/90 hover:text-black'
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
              isDarkSection ? 'nav-icon--dark' : ''
            }`}
            title="RFQ workspace"
            aria-label={cartCount > 0 ? `RFQ workspace, ${cartCount} line items` : 'RFQ workspace'}
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-colors duration-300 ${
                isDarkSection ? 'bg-white text-[#111315]' : 'bg-[#111315] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </Link>

          {!user && (
            <div className="hidden sm:flex items-center">
              <Link
                href="/enquiry"
                className={`nav-btn inline-flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-semibold group ${
                  isDarkSection ? 'nav-btn--on-dark' : ''
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
              isDarkSection ? 'nav-icon--dark' : ''
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
