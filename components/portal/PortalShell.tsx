'use client';

import React, { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PortalToaster } from '@/components/portal/ds';
import PortalRouteSkeleton from '@/components/portal/PortalRouteSkeleton';
import PortalColorModeToggle from '@/components/portal/PortalColorModeToggle';
import { prefetchPortalRouteData } from '@/lib/client/portal-nav-prefetch';
import { markPortalNavClick } from '@/lib/client/portal-data-cache';

export type PortalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  /** When true, never mark active (e.g. supplier "Product views" shortcut) */
  neverActive?: boolean;
};

type PortalShellProps = {
  children: React.ReactNode;
  navItems: PortalNavItem[];
  brandTitle: string;
  brandSubtitle?: string;
  brandHref?: string;
  signOutHref: string;
  onSignOut: () => void | Promise<void>;
  avatarLabel?: string;
  settingsHref?: string;
  searchPlaceholder?: string;
  /** Optional controlled search — only wire where page already has search */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  notificationsHref?: string;
};

function isModifiedClick(e: React.MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export default function PortalShell({
  children,
  navItems,
  brandTitle,
  brandSubtitle,
  brandHref,
  signOutHref,
  onSignOut,
  avatarLabel = 'U',
  settingsHref,
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  onSearchSubmit,
  notificationsHref,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const search = searchValue !== undefined ? searchValue : localSearch;
  const setSearch = onSearchChange || setLocalSearch;

  async function handleSignOutClick() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      // Fall through to hard redirect via signOutHref if client handler fails
      window.location.assign(`/auth/signout?next=${encodeURIComponent(signOutHref)}`);
    }
  }

  function isActive(item: PortalNavItem) {
    if (item.neverActive) return false;
    if (pendingHref) return item.href === pendingHref;
    return (
      pathname === item.href ||
      (item.href !== '/admin/dashboard' &&
        item.href !== '/supplier/dashboard' &&
        item.href !== '/customer/dashboard' &&
        pathname.startsWith(item.href + '/'))
    );
  }

  function handleNavIntent(href: string) {
    router.prefetch(href);
    prefetchPortalRouteData(href);
  }

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    onNavigate?: () => void
  ) {
    onNavigate?.();
    if (isModifiedClick(e)) return;
    if (href === pathname) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    markPortalNavClick(href);
    prefetchPortalRouteData(href);
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  }

  const showNavSkeleton = Boolean(pendingHref && pendingHref !== pathname);

  const brandBlock = (
    <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
      <div className="h-10 w-10 rounded-full bg-portal-hero text-portal-hero-text flex items-center justify-center font-bold text-sm shrink-0">
        {avatarLabel.slice(0, 1).toUpperCase()}
      </div>
      {!collapsed ? (
        <div className="space-y-0.5 truncate min-w-0">
          <div className="text-sm font-semibold text-portal-text truncate">{brandTitle}</div>
          {brandSubtitle ? (
            <div className="text-xs text-portal-muted font-mono truncate">{brandSubtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  function renderNav(compact: boolean, onNavigate?: () => void) {
    return (
      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href, onNavigate)}
              onMouseEnter={() => handleNavIntent(item.href)}
              onFocus={() => handleNavIntent(item.href)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'portal-nav-link relative flex items-center gap-3 transition-colors',
                compact ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                active ? 'saas-nav-active' : 'saas-nav-inactive'
              )}
            >
              <Icon className="w-[1.15rem] h-[1.15rem] shrink-0" aria-hidden />
              {!compact ? <span className="truncate flex-1 text-left">{item.label}</span> : null}
              {item.badge !== undefined && item.badge > 0 ? (
                <span
                  className={clsx(
                    'shrink-0 min-w-[1.15rem] h-5 px-1 rounded-full text-[10px] font-mono flex items-center justify-center',
                    compact && 'absolute -top-0.5 -right-0.5',
                    active
                      ? 'bg-portal-canvas text-portal-text'
                      : 'bg-portal-accent text-portal-hero-text'
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden text-portal-text saas-canvas-bg bg-portal-canvas">
      <PortalToaster />

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col shrink-0 h-dvh saas-sidebar py-5 justify-between overflow-y-auto transition-[width] duration-200',
          collapsed ? 'w-[72px] px-2' : 'w-60 px-4'
        )}
      >
        <div className="space-y-6">
          <div className="pb-4 border-b border-portal-border">
            {brandHref ? (
              <Link
                href={brandHref}
                onClick={(e) => handleNavClick(e, brandHref)}
                onMouseEnter={() => handleNavIntent(brandHref)}
                onFocus={() => handleNavIntent(brandHref)}
              >
                {brandBlock}
              </Link>
            ) : (
              brandBlock
            )}
          </div>
          {renderNav(collapsed)}
        </div>

        <div className="space-y-2 pt-4 border-t border-portal-border">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={clsx(
              'flex items-center transition-colors text-portal-muted hover:text-portal-text hover:bg-portal-hover',
              collapsed
                ? 'justify-center h-10 w-10 mx-auto rounded-full border border-portal-border'
                : 'w-full justify-start gap-2 rounded-xl px-3 py-2.5 text-sm border border-portal-border'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleSignOutClick()}
            disabled={signingOut}
            className={clsx(
              'w-full flex items-center gap-2 text-portal-danger hover:bg-portal-danger-soft rounded-xl transition-colors',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 text-sm',
              signingOut && 'opacity-60 pointer-events-none'
            )}
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed ? <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span> : null}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden bg-portal-canvas">
        {/* Top bar — static */}
        <header className="shrink-0 z-20 border-b border-portal-border bg-portal-canvas/90 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden saas-btn-ghost"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <form
              className="saas-search-field flex-1 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit?.(search.trim());
              }}
            >
              <Search className="saas-search-icon" aria-hidden />
              <input
                type="search"
                className="saas-input"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={searchPlaceholder}
              />
            </form>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline font-mono text-xs text-portal-muted whitespace-nowrap">
                {currentDate}
              </span>
              <PortalColorModeToggle />
              {settingsHref ? (
                <Link
                  href={settingsHref}
                  className="saas-btn-ghost"
                  aria-label="Settings"
                  onClick={(e) => handleNavClick(e, settingsHref)}
                  onMouseEnter={() => handleNavIntent(settingsHref)}
                  onFocus={() => handleNavIntent(settingsHref)}
                >
                  <Settings className="w-4 h-4" />
                </Link>
              ) : (
                <button type="button" className="saas-btn-ghost" aria-label="Settings">
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {notificationsHref ? (
                <Link
                  href={notificationsHref}
                  className="saas-btn-ghost"
                  aria-label="Notifications"
                  onClick={(e) => handleNavClick(e, notificationsHref)}
                  onMouseEnter={() => handleNavIntent(notificationsHref)}
                  onFocus={() => handleNavIntent(notificationsHref)}
                >
                  <Bell className="w-4 h-4" />
                </Link>
              ) : (
                <button type="button" className="saas-btn-ghost" aria-label="Notifications">
                  <Bell className="w-4 h-4" />
                </button>
              )}
              <div
                className="h-9 w-9 rounded-full bg-portal-panel border border-portal-border flex items-center justify-center text-xs font-semibold text-portal-text"
                aria-label="User avatar"
              >
                {avatarLabel.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {mobileOpen ? (
          <>
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="lg:hidden fixed top-16 left-3 right-3 z-40 p-4 saas-panel space-y-1 max-h-[calc(100vh-5rem)] overflow-y-auto">
              {renderNav(false, () => setMobileOpen(false))}
              <button
                type="button"
                onClick={() => void handleSignOutClick()}
                disabled={signingOut}
                className="w-full text-left py-2.5 px-3 rounded-xl text-sm text-portal-danger hover:bg-portal-danger-soft flex items-center gap-2 mt-2 disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </>
        ) : null}

        {/* Full-bleed scroll pane — scrollbar on the right edge of the viewport column */}
        <main className="relative flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden w-full">
          <div
            className={clsx(
              'w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4',
              showNavSkeleton && 'invisible pointer-events-none'
            )}
            aria-hidden={showNavSkeleton || undefined}
          >
            {children}
          </div>
          {showNavSkeleton ? (
            <div className="absolute inset-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 overflow-y-auto bg-portal-canvas z-10">
              <PortalRouteSkeleton />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
