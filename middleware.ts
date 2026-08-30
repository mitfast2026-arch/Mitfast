import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  appendDeniedNotice,
  homeForRole,
  isIdentityComplete,
  isSafeInternalPath,
  resolvePostAuthPath,
} from '@/lib/auth/post-auth-path';

const PORTAL_GATE_COOKIE = 'mf_portal_gate';

type PortalGate = {
  userId: string;
  role: string;
  supplierStatus?: string;
};

function serializePortalGate(gate: PortalGate): string {
  return `${gate.userId}|${gate.role}|${gate.supplierStatus ?? ''}`;
}

function portalGateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60,
  };
}

function clearPortalGateCookie(response: NextResponse) {
  response.cookies.set({
    name: PORTAL_GATE_COOKIE,
    value: '',
    ...portalGateCookieOptions(),
    maxAge: 0,
  });
}

function setPortalGateCookie(response: NextResponse, gate: PortalGate) {
  response.cookies.set({
    name: PORTAL_GATE_COOKIE,
    value: serializePortalGate(gate),
    ...portalGateCookieOptions(),
  });
}

function redirectTo(
  path: string,
  request: NextRequest,
  opts?: { denied?: boolean; clearGate?: boolean }
): NextResponse {
  const target = opts?.denied ? appendDeniedNotice(path) : path;
  const redirect = NextResponse.redirect(new URL(target, request.url));
  if (opts?.denied || opts?.clearGate) clearPortalGateCookie(redirect);
  return redirect;
}

async function loadSupplierStatus(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('suppliers')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { status?: string } | null)?.status ?? null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname, searchParams } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isSupplierRoute = pathname.startsWith('/supplier');
  const isCustomerRoute = pathname.startsWith('/customer');
  const isAuthRoute = pathname.startsWith('/auth');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isAdminRoute || isCustomerRoute || isSupplierRoute) {
      return NextResponse.redirect(new URL('/auth?mode=signin', request.url));
    }
    return response;
  }

  const code = searchParams.get('code');
  if (code && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl, 307);
  }

  const hasAuthCookie = request.cookies.getAll().some(
    (cookie) => cookie.name.includes('-auth-token') || cookie.name.startsWith('sb-')
  );
  if (pathname === '/' && !hasAuthCookie) {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Protected Route Guards
  if (isAdminRoute || isSupplierRoute || isCustomerRoute) {
    if (!user) {
      const redirectUrl = new URL(
        isAdminRoute
          ? '/auth?role=admin&mode=signin'
          : isSupplierRoute
            ? '/auth?role=supplier&mode=signin'
            : '/auth?role=buyer&mode=signin',
        request.url
      );
      redirectUrl.searchParams.set('redirect', pathname);
      const redirect = NextResponse.redirect(redirectUrl);
      clearPortalGateCookie(redirect);
      return redirect;
    }

    // Portal gate cookie is a perf hint only — never authorize from cookie alone.
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, full_name, phone, email')
      .eq('user_id', user.id)
      .single();

    const profile = profileData as {
      role?: string;
      full_name?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
    const role = profile?.role;
    const identityOk = isIdentityComplete(profile);
    const supplierStatus =
      role === 'supplier' ? await loadSupplierStatus(supabase, user.id) : null;

    const onWrongPortal =
      (isAdminRoute && role !== 'admin') ||
      (isCustomerRoute && role !== 'customer') ||
      (isSupplierRoute && role !== 'supplier');

    if (onWrongPortal) {
      return redirectTo(homeForRole(role, supplierStatus), request, { denied: true });
    }

    if ((isCustomerRoute || isSupplierRoute) && role !== 'admin' && !identityOk) {
      const dest = resolvePostAuthPath({
        role,
        supplierStatus,
        redirectPath: pathname + (request.nextUrl.search || ''),
        identityComplete: false,
      });
      return redirectTo(dest, request, { clearGate: true });
    }

    if (isSupplierRoute) {
      const statusHome = homeForRole('supplier', supplierStatus);
      if (statusHome !== '/supplier/dashboard' && !statusHome.startsWith('/supplier/')) {
        return redirectTo(statusHome, request, { clearGate: true });
      }

      setPortalGateCookie(response, {
        userId: user.id,
        role: 'supplier',
        supplierStatus: supplierStatus ?? undefined,
      });
      return response;
    }

    if (role === 'admin' || role === 'customer') {
      setPortalGateCookie(response, { userId: user.id, role });
    }

    return response;
  }

  const isSupplierPending = pathname.includes('/auth/supplier/pending');
  const isSupplierRejected = pathname.includes('/auth/supplier/rejected');

  // Pending/rejected require a session — anonymous visitors go to supplier sign-in.
  if (!user && (isSupplierPending || isSupplierRejected)) {
    return redirectTo('/auth?role=supplier&mode=signin', request, { clearGate: true });
  }

  // Always resolve pending/rejected from DB — never the portal-gate cookie.
  if (user && (isSupplierPending || isSupplierRejected)) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = (profileData as { role?: string } | null)?.role;
    const supplierStatus =
      role === 'supplier' ? await loadSupplierStatus(supabase, user.id) : null;
    const dest = homeForRole(role, supplierStatus);
    const destPath = dest.split('?')[0];

    if (role !== 'supplier') {
      return redirectTo(dest, request, { denied: true });
    }
    if (
      (isSupplierPending && destPath !== '/auth/supplier/pending') ||
      (isSupplierRejected && destPath !== '/auth/supplier/rejected')
    ) {
      const redirect = redirectTo(dest, request, { clearGate: dest !== '/supplier/dashboard' });
      if (dest === '/supplier/dashboard') {
        setPortalGateCookie(redirect, {
          userId: user.id,
          role: 'supplier',
          supplierStatus: 'active',
        });
      }
      return redirect;
    }
  }

  if (
    isAuthRoute &&
    user &&
    !pathname.includes('/pending') &&
    !pathname.includes('/rejected') &&
    !pathname.includes('/callback') &&
    !pathname.includes('/signout') &&
    !pathname.includes('/complete-profile') &&
    !pathname.includes('/supplier/apply') &&
    !pathname.includes('/reset-password')
  ) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();

    const profile = profileData as {
      role?: string;
      full_name?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;

    const role = profile?.role;
    const identityOk = isIdentityComplete(profile);
    const supplierStatus =
      role === 'supplier' ? await loadSupplierStatus(supabase, user.id) : null;
    const requestedRedirect = request.nextUrl.searchParams.get('redirect');
    const dest = resolvePostAuthPath({
      role,
      supplierStatus,
      redirectPath: requestedRedirect && isSafeInternalPath(requestedRedirect) ? requestedRedirect : undefined,
      identityComplete: identityOk,
    });

    const redirect = NextResponse.redirect(new URL(dest, request.url));
    if (role === 'admin' || role === 'customer' || supplierStatus === 'active') {
      setPortalGateCookie(redirect, {
        userId: user.id,
        role: role || 'customer',
        supplierStatus: supplierStatus ?? undefined,
      });
    } else {
      clearPortalGateCookie(redirect);
    }
    return redirect;
  }

  if (isAuthRoute && !user) {
    clearPortalGateCookie(response);
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/supplier/:path*',
    '/customer/:path*',
    '/auth',
    '/auth/:path*',
  ],
};
