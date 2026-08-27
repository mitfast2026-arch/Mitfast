'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SmoothScroll from '@/components/providers/SmoothScroll';
import { PortalColorModeProvider, PortalUiRoot } from '@/components/portal/PortalColorMode';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortalOrAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/supplier') ||
    pathname.startsWith('/auth');
  const isHome = pathname === '/';
  const isEnquiry = pathname === '/enquiry';
  const isServices = pathname === '/services';
  const isAbout = pathname === '/about';

  if (isPortalOrAuth) {
    const portalTheme = pathname.startsWith('/admin')
      ? 'portal-theme-admin'
      : pathname.startsWith('/supplier')
        ? 'portal-theme-supplier'
        : '';

    return (
      <PortalColorModeProvider>
        <PortalUiRoot
          className={`portal-ui h-dvh max-h-dvh w-full overflow-hidden saas-canvas-bg text-portal-text ${portalTheme}`.trim()}
        >
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={2500}
            theme="system"
            toastOptions={{
              style: {
                background: 'var(--portal-panel)',
                border: '1px solid var(--portal-border)',
                color: 'var(--portal-text)',
              },
            }}
          />
          {children}
        </PortalUiRoot>
      </PortalColorModeProvider>
    );
  }

  const shellBg = isHome
    ? 'bg-transparent'
    : isEnquiry
      ? 'bg-white'
      : isServices || isAbout
        ? 'bg-[#0B0F14]'
        : pathname.startsWith('/customer')
          ? 'bg-white'
          : 'bg-[#F7F7F8]';

  return (
    <SmoothScroll>
      <div className={`min-h-screen flex flex-col text-[#111315] ${shellBg}`}>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={2500}
        />
        <Navbar />
        {/* Match Navbar h-16 so non-home pages align with scrolled homepage chrome */}
        <main className={`flex-1 w-full relative z-0 isolate ${isHome || isAbout ? 'pt-0' : 'pt-16'}`}>
          {children}
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
