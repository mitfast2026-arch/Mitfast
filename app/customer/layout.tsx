'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileQuestion,
  FileText,
  PackageCheck,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import PortalNavLink from '@/components/portal/PortalNavLink';

import { signOutTo } from '@/lib/client/sign-out';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth?role=buyer&mode=signin');
          return;
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (prof) setProfile(prof);
      } catch (err) {
        console.error('Customer auth check error:', err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  function handleSignOut() {
    signOutTo('/auth?role=buyer&mode=signin');
  }

  const navItems = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'My Enquiries', href: '/customer/enquiries', icon: FileQuestion },
    { label: 'My RFQs', href: '/customer/rfqs', icon: FileText },
    { label: 'Production Orders', href: '/customer/orders', icon: PackageCheck },
    { label: 'Profile', href: '/customer/profile', icon: User },
    { label: 'Settings', href: '/customer/settings', icon: Settings },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex h-screen saas-canvas-bg items-center justify-center">
        <div className="text-xs font-mono text-[#6B7280] animate-pulse">Authenticating Buyer Portal...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen saas-canvas-bg text-[#111315] overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 m-3 mr-0 rounded-3xl saas-sidebar-gradient p-5 space-y-6 shrink-0 justify-between h-[calc(100vh-1.5rem)] overflow-y-auto">
        <div className="space-y-6">
          <Link href="/customer/profile" className="flex items-center gap-3 pb-4 border-b border-[#E2E4E8]">
            <div className="h-10 w-10 rounded-full bg-[#111315] text-white flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div className="space-y-0.5 truncate">
              <div className="text-xs font-semibold text-[#111315] truncate">
                {profile?.full_name || 'Buyer Portal'}
              </div>
              <div className="text-[11px] text-[#6B7280] truncate font-mono">
                {profile?.email || 'Procurement account'}
              </div>
            </div>
          </Link>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/customer/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                />
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-[#E2E4E8] text-xs text-[#6B7280]">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[11px]">{currentDate}</span>
            <Link href="/products" className="hover:text-[#111315] flex items-center gap-1">
              <span>Catalog</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left py-2 px-3 rounded-full text-xs text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-20 mx-3 mt-3 rounded-full saas-glass-bar px-4 sm:px-6 py-2.5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden saas-btn-ghost">
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280]">
              <span className="font-bold text-[#111315]">Buyer Portal</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span className="capitalize text-[#111315]">
                {pathname.split('/')[2]?.replace(/-/g, ' ') || 'Dashboard'}
              </span>
            </div>
          </div>
        </header>

        {sidebarOpen && (
          <div className="lg:hidden mx-3 mt-3 p-4 saas-panel space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/customer/dashboard' && pathname.startsWith(item.href + '/'));
              return (
                <PortalNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  onClick={() => setSidebarOpen(false)}
                />
              );
            })}
          </div>
        )}

        <main className="p-6 sm:p-8 flex-1 w-full max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
