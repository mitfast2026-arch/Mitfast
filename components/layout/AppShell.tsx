'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SmoothScroll from '@/components/providers/SmoothScroll';
import { PortalColorModeProvider, PortalUiRoot } from '@/components/portal/PortalColorMode';
import AccessDeniedNotice from '@/components/layout/AccessDeniedNotice';

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
    const isAuthOnly = pathname.startsWith('/auth');
    const portalTheme = pathname.startsWith('/admin')
      ? 'portal-theme-admin'
      : pathname.startsWith('/supplier')
        ? 'portal-theme-supplier'
        : '';

    // Auth forms need vertical scroll on small screens; portal dashboards keep overflow-hidden.
    const shellOverflow = isAuthOnly
      ? 'min-h-dvh w-full overflow-x-hidden overflow-y-auto'
      : 'h-dvh max-h-dvh w-full overflow-hidden';

    return (
      <PortalColorModeProvider>
        <PortalUiRoot
          className={`portal-ui ${shellOverflow} saas-canvas-bg text-portal-text ${portalTheme}`.trim()}
        >
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={2500}
            theme="system"
            className="z-toast"
            style={{ zIndex: 'var(--z-toast)' }}
            toastOptions={{
              style: {
                background: 'var(--portal-panel)',
                border: '1px solid var(--portal-border)',
                color: 'var(--portal-text)',
              },
            }}
          />
          <Suspense fallback={null}>
            <AccessDeniedNotice />
          </Suspense>
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
      <div className={`flex min-h-screen w-full min-w-0 flex-col text-[#111315] ${shellBg}`}>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={2500}
          className="z-toast"
          style={{ zIndex: 'var(--z-toast)' }}
        />
        <Suspense fallback={null}>
          <AccessDeniedNotice />
        </Suspense>
        <Navbar />
        {/* Match Navbar h-16 so non-home pages align with scrolled homepage chrome */}
        <main
          className={`relative z-0 w-full min-w-0 flex-1 shrink-0 isolate ${isHome || isAbout ? 'pt-0' : 'pt-16'}`}
        >
          {children}
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
