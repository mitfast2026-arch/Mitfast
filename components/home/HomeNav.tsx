'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Menu, 
  X, 
  User, 
  Building2, 
  LogIn, 
  UserPlus, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import gsap from 'gsap';

interface NavButton {
  id: string;
  label: string;
  href: string;
}

const CENTER_NAV_ITEMS: NavButton[] = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'services', label: 'Services', href: '#services' },
  { id: 'product', label: 'Product', href: '#products' },
];

export default function HomeNav() {
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('#home');
  
  // Auth modal state: null (closed), 'buyer', or 'seller'
  const [authModalRole, setAuthModalRole] = useState<'buyer' | 'seller' | null>(null);

  // GSAP Entrance Fade Down Animation
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !headerRef.current) return;

    gsap.fromTo(
      headerRef.current,
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out' }
    );
  }, []);

  // Scroll listener for dynamic transparent to frosted glass conversion
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 25);
    };

    const handleHash = () => {
      setActiveHash(window.location.hash || '#home');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('hashchange', handleHash);
    handleScroll();
    handleHash();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAuthModalRole(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, href: string) => {
    e.preventDefault();
    if (href === '#home' || href === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.history.pushState(null, '', '#home');
      setActiveHash('#home');
      setMobileOpen(false);
      return;
    }

    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const offsetPosition = elementRect - bodyRect - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      window.history.pushState(null, '', href);
      setActiveHash(href);
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Full-Width Edge-to-Edge Sharp Navigation Bar */}
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ease-out will-change-[background-color,backdrop-filter,padding,border-color,box-shadow] ${ scrolled ? 'py-3.5 bg-white/75 dark:bg-slate-950/80 backdrop-blur-2xl backdrop-saturate-[180%] border-b border-slate-200/50 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.06)]' : 'py-5 bg-transparent border-b border-transparent shadow-none backdrop-blur-none' }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 flex items-center justify-between">
          
          {/* Left: Brand Logo */}
          <div className="flex-shrink-0 flex items-center">
            <a
              href="#home"
              onClick={(e) => scrollToSection(e, '#home')}
              className="flex items-center group transition-transform hover:scale-[1.02]"
              aria-label="MITFAST Home"
            >
              <div className="relative h-8 sm:h-9 w-32 sm:w-40 flex items-center">
                <Image
                  src="/images/logo.png"
                  alt="MITFAST Logo"
                  width={160}
                  height={42}
                  priority
                  className={`h-full w-auto object-contain transition-all duration-300 ${ scrolled ? 'drop-shadow-none' : 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]' }`}
                />
              </div>
            </a>
          </div>

          {/* Center: Navigation Links (UI Psychology: Optical Centering & Balanced Hierarchy) */}
          <nav
            className="hidden md:flex items-center justify-center gap-7 lg:gap-10 text-sm"
            aria-label="Primary Navigation"
          >
            {CENTER_NAV_ITEMS.map((item) => {
              const isActive = activeHash === item.href;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => scrollToSection(e, item.href)}
                  className={`relative py-1.5 font-semibold tracking-wide transition-all duration-300 group ${ scrolled ? isActive ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white' : isActive ? 'text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]' : 'text-white/85 hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]' }`}
                >
                  <span>{item.label}</span>
                  {/* Subtle active underline indicator */}
                  {isActive && (
                    <span
                      className={`absolute -bottom-1 left-0 right-0 h-0.5 rounded-full transition-all duration-300 ${ scrolled ? 'bg-[#1a66f8]' : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' }`}
                    />
                  )}
                  {/* Hover indicator for inactive tabs */}
                  {!isActive && (
                    <span
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 rounded-full transition-all duration-300 group-hover:w-full ${ scrolled ? 'bg-slate-400 dark:bg-slate-500' : 'bg-white/60' }`}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right: Buyer & Supplier Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Buyer Button */}
            <button
              onClick={() => setAuthModalRole('buyer')}
              type="button"
              className={`group px-4.5 py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-2 cursor-pointer active:scale-95 ${ scrolled ? 'text-slate-800 dark:text-slate-100 bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/10 dark:hover:bg-white/15 border border-slate-900/10 dark:border-white/15 shadow-xs hover:shadow-sm' : 'text-white bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:shadow-md' }`}
            >
              <User
                className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${ scrolled ? 'text-teal-700 dark:text-teal-400' : 'text-teal-300' }`}
              />
              <span>Buyer</span>
            </button>

            {/* Supplier Button - High-Confidence Primary Blue Pill */}
            <button
              onClick={() => setAuthModalRole('seller')}
              type="button"
              className="group px-5.5 py-2 rounded-full text-xs font-semibold text-white bg-[#1a66f8] hover:bg-[#1452ca] shadow-[0_4px_14px_rgba(26,102,248,0.38)] hover:shadow-[0_6px_20px_rgba(26,102,248,0.5)] transition-all duration-300 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Building2 className="w-3.5 h-3.5 text-white transition-transform group-hover:scale-110" />
              <span>Supplier</span>
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden p-2 rounded-xl transition-all duration-300 ${ scrolled ? 'text-slate-800 dark:text-white bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 border border-slate-900/10 dark:border-white/15' : 'text-white bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-sm shadow-sm' }`}
            aria-label={mobileOpen ? 'Close Menu' : 'Open Menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/10 p-6 flex flex-col space-y-5 shadow-2xl animate-fadeIn">
            {/* Nav links */}
            <div className="flex flex-col space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2 font-semibold">
                Menu
              </span>
              {CENTER_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => scrollToSection(e, item.href)}
                  className="px-3 py-2.5 rounded-xl text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between transition-colors"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
              ))}
            </div>

            {/* Auth options */}
            <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2 font-semibold">
                Account Portals
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthModalRole('buyer');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-left hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 mb-0.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Buyer</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Login / Register</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthModalRole('seller');
                  }}
                  className="p-3 rounded-2xl bg-[#1a66f8] text-white text-left hover:bg-[#1452ca] transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Supplier</span>
                  </div>
                  <div className="text-[11px] text-white/90 font-medium">Login / Register</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Interactive Frosted Glass Login / Register Modal for Buyer & Supplier */}
      {authModalRole && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setAuthModalRole(null)}
        >
          <div
            className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/95 border border-white/70 dark:border-white/20 rounded-3xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.9)] backdrop-blur-[40px] text-slate-900 dark:text-white space-y-6 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Refraction Glow */}
            <div 
              className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-300 ${ authModalRole === 'buyer' ? 'bg-teal-500/15' : 'bg-blue-500/15' }`} 
            />

            {/* Modal Header */}
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-slate-900/[0.05] dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-700 dark:text-slate-300">
                  {authModalRole === 'buyer' ? (
                    <>
                      <User className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      <span>Buyer Portal Access</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>Supplier Portal</span>
                    </>
                  )}
                </div>
                <h3 className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                  {authModalRole === 'buyer' ? 'Welcome, Industrial Buyer' : 'Welcome, Manufacturing Partner'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {authModalRole === 'buyer'
                    ? 'Access procurement workspaces, locked RFQ quotes, and certified order tracking.'
                    : 'Manage supplier bids, machine capacity schedules, and purchase orders.'}
                </p>
              </div>

              <button
                onClick={() => setAuthModalRole(null)}
                className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher Pill */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/[0.04] dark:bg-slate-950/60 border border-slate-900/10 dark:border-white/10 rounded-2xl relative z-10 shadow-inner">
              <button
                type="button"
                onClick={() => setAuthModalRole('buyer')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${ authModalRole === 'buyer' ? 'bg-white dark:bg-teal-500/20 text-slate-950 dark:text-teal-300 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-900/10 dark:border-teal-400/30 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white' }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Buyer</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthModalRole('seller')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${ authModalRole === 'seller' ? 'bg-[#1a66f8] text-white shadow-[0_2px_8px_rgba(26,102,248,0.3)] font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white' }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Supplier</span>
              </button>
            </div>

            {/* Action Cards: Login vs Register */}
            <div className="space-y-3 relative z-10">
              {/* Option 1: Login / Sign In */}
              <Link
                href={
                  authModalRole === 'buyer'
                    ? '/auth?role=buyer&mode=signin'
                    : '/auth?role=supplier&mode=signin'
                }
                onClick={() => setAuthModalRole(null)}
                className="group w-full p-4 rounded-2xl bg-white/70 dark:bg-white/5 hover:bg-white/95 dark:hover:bg-white/10 border border-slate-900/10 dark:border-white/10 hover:border-slate-900/20 dark:hover:border-white/25 flex items-center justify-between transition-all duration-200 shadow-xs hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-400 group-hover:scale-105 transition-transform">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                      Sign In / Login
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Already have an account? Access your dashboard
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all" />
              </Link>

              {/* Option 2: Register / Create Account */}
              <Link
                href={
                  authModalRole === 'buyer'
                    ? '/auth?role=buyer&mode=register'
                    : '/auth?role=supplier&mode=register'
                }
                onClick={() => setAuthModalRole(null)}
                className="group w-full p-4 rounded-2xl bg-white/70 dark:bg-white/5 hover:bg-white/95 dark:hover:bg-white/10 border border-slate-900/10 dark:border-white/10 hover:border-slate-900/20 dark:hover:border-white/25 flex items-center justify-between transition-all duration-200 shadow-xs hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                      Register procurement account
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      New user? Onboard in under 2 minutes
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            {/* Quality & Security Assurance Note */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-900/10 dark:border-white/10">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>SSL Encrypted</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>ISO 9001 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
