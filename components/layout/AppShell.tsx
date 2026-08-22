'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SmoothScroll from '@/components/providers/SmoothScroll';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortalOrAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/supplier') ||
    pathname.startsWith('/customer') ||
    pathname.startsWith('/auth');
  const isHome = pathname === '/';
  const isEnquiry = pathname === '/enquiry';

  if (isPortalOrAuth) {
    return <div className="min-h-screen w-full bg-white text-[#111315]">{children}</div>;
  }

  return (
    <SmoothScroll>
      <div
        className={`min-h-screen flex flex-col text-[#111315] ${
          isHome ? 'bg-transparent' : isEnquiry ? 'bg-white' : 'bg-[#F7F7F8]'
        }`}
      >
        <Navbar />
        {/* Match Navbar h-16 so non-home pages align with scrolled homepage chrome */}
        <main className={`flex-1 w-full ${isHome ? 'pt-0' : 'pt-16'}`}>
          {children}
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
