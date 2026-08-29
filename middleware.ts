import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

const PORTAL_GATE_COOKIE = 'mf_portal_gate';

type PortalGate = {
  userId: string;
  role: string;
  supplierStatus?: string;
};

function parsePortalGate(value: string | undefined): PortalGate | null {
  if (!value) return null;
  const parts = value.split('|');
  const userId = parts[0];
  const role = parts[1];
  if (!userId || !role) return null;
  const supplierStatus = parts[2] || undefined;
  return { userId, role, supplierStatus };
}

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

function supplierStatusRedirect(
  status: string | undefined,
  requestUrl: string
): NextResponse | null {
  if (!status || status === 'pending') {
    return NextResponse.redirect(new URL('/auth/supplier/pending', requestUrl));
  }
  if (status === 'rejected') {
    return NextResponse.redirect(new URL('/auth/supplier/rejected', requestUrl));
  }
  if (status === 'archived') {
    return NextResponse.redirect(
      new URL('/auth/supplier/pending?status=archived', requestUrl)
    );
  }
  return null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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
  const { pathname, searchParams } = request.nextUrl;

  // 0. Intercept stray OAuth code query parameter on any non-callback route (e.g. root or /auth)
  const code = searchParams.get('code');
  if (code && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl, 307);
  }

  // 1. Protected Route Guards
  const isAdminRoute = pathname.startsWith('/admin');
  const isSupplierRoute = pathname.startsWith('/supplier');
  const isCustomerRoute = pathname.startsWith('/customer');
  const isAuthRoute = pathname.startsWith('/auth');

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

    // Resolve user role (full DB check)
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

    const identityOk =
      (profile?.full_name || '').trim().length >= 2 &&
      (profile?.phone || '').trim().length >= 7 &&
      (profile?.email || '').trim().includes('@');

    if ((isCustomerRoute || isSupplierRoute) && role !== 'admin' && !identityOk) {
      const roleQs = role === 'supplier' || isSupplierRoute ? 'supplier' : 'buyer';
      const redirect = NextResponse.redirect(
        new URL(`/auth/complete-profile?role=${roleQs}`, request.url)
      );
      clearPortalGateCookie(redirect);
      return redirect;
    }

    if (isAdminRoute && role !== 'admin') {
      const redirect = NextResponse.redirect(new URL('/', request.url));
      clearPortalGateCookie(redirect);
      return redirect;
    }

    if (isCustomerRoute && role !== 'customer') {
      const redirect = NextResponse.redirect(new URL('/', request.url));
      clearPortalGateCookie(redirect);
      return redirect;
    }

    if (isSupplierRoute) {
      if (role !== 'supplier') {
        const redirect = NextResponse.redirect(
          new URL('/auth?role=supplier&mode=signin', request.url)
        );
        clearPortalGateCookie(redirect);
        return redirect;
      }

      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      const supplier = supplierData as { status?: string } | null;
      if (!supplier) {
        const redirect = NextResponse.redirect(new URL('/auth/supplier/apply', request.url));
        clearPortalGateCookie(redirect);
        return redirect;
      }

      const statusRedirect = supplierStatusRedirect(supplier?.status, request.url);
      if (statusRedirect) {
        clearPortalGateCookie(statusRedirect);
        return statusRedirect;
      }

      setPortalGateCookie(response, {
        userId: user.id,
        role: 'supplier',
        supplierStatus: supplier?.status,
      });
      return response;
    }

    if (role === 'admin' || role === 'customer') {
      setPortalGateCookie(response, { userId: user.id, role });
    }

    return response;
  }

  // 2. Redirect authenticated users visiting login/register pages
  // Allow onboarding pages: complete-profile, supplier apply, pending, rejected
  // Pending/rejected require a session — anonymous visitors go to supplier sign-in.
  if (
    !user &&
    (pathname.includes('/auth/supplier/pending') || pathname.includes('/auth/supplier/rejected'))
  ) {
    const redirect = NextResponse.redirect(
      new URL('/auth?role=supplier&mode=signin', request.url)
    );
    clearPortalGateCookie(redirect);
    return redirect;
  }

  // Active suppliers should not linger on pending/rejected; matching status may stay.
  if (
    user &&
    (pathname.includes('/auth/supplier/pending') || pathname.includes('/auth/supplier/rejected'))
  ) {
    const cached = parsePortalGate(request.cookies.get(PORTAL_GATE_COOKIE)?.value);
    if (cached?.userId === user.id && cached.role === 'supplier') {
      if (cached.supplierStatus === 'active') {
        return NextResponse.redirect(new URL('/supplier/dashboard', request.url));
      }
      if (
        cached.supplierStatus === 'rejected' &&
        pathname.includes('/auth/supplier/pending')
      ) {
        return NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
      }
      if (
        cached.supplierStatus === 'pending' &&
        pathname.includes('/auth/supplier/rejected')
      ) {
        return NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
      }
    } else {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if ((profileData as { role?: string } | null)?.role === 'supplier') {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();
        const status = (supplierData as { status?: string } | null)?.status;
        if (status === 'active') {
          const redirect = NextResponse.redirect(new URL('/supplier/dashboard', request.url));
          setPortalGateCookie(redirect, {
            userId: user.id,
            role: 'supplier',
            supplierStatus: 'active',
          });
          return redirect;
        }
        if (status === 'rejected' && pathname.includes('/auth/supplier/pending')) {
          return NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
        }
        if (status === 'pending' && pathname.includes('/auth/supplier/rejected')) {
          return NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
        }
      }
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
    const cached = parsePortalGate(request.cookies.get(PORTAL_GATE_COOKIE)?.value);
    if (cached?.userId === user.id) {
      if (cached.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      if (cached.role === 'customer') {
        return NextResponse.redirect(new URL('/customer/dashboard', request.url));
      }
      if (cached.role === 'supplier') {
        if (cached.supplierStatus === 'active') {
          return NextResponse.redirect(new URL('/supplier/dashboard', request.url));
        }
        if (cached.supplierStatus === 'rejected') {
          return NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
        }
        if (!cached.supplierStatus) {
          return NextResponse.redirect(new URL('/auth/supplier/apply', request.url));
        }
        return NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
      }
    }

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

    const identityOk =
      (profile?.full_name || '').trim().length >= 2 &&
      (profile?.phone || '').trim().length >= 7 &&
      (profile?.email || '').trim().includes('@');

    if (!identityOk && profile?.role !== 'admin') {
      const roleQs = profile?.role === 'supplier' ? 'supplier' : 'buyer';
      return NextResponse.redirect(
        new URL(`/auth/complete-profile?role=${roleQs}`, request.url)
      );
    }

    if (profile?.role === 'admin') {
      const redirect = NextResponse.redirect(new URL('/admin/dashboard', request.url));
      setPortalGateCookie(redirect, { userId: user.id, role: 'admin' });
      return redirect;
    } else if (profile?.role === 'customer') {
      const redirect = NextResponse.redirect(new URL('/customer/dashboard', request.url));
      setPortalGateCookie(redirect, { userId: user.id, role: 'customer' });
      return redirect;
    } else if (profile?.role === 'supplier') {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      const supplier = supplierData as { status?: string } | null;

      if (supplier?.status === 'active') {
        const redirect = NextResponse.redirect(new URL('/supplier/dashboard', request.url));
        setPortalGateCookie(redirect, {
          userId: user.id,
          role: 'supplier',
          supplierStatus: 'active',
        });
        return redirect;
      } else if (supplier?.status === 'rejected') {
        const redirect = NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
        clearPortalGateCookie(redirect);
        return redirect;
      } else if (!supplier) {
        const redirect = NextResponse.redirect(new URL('/auth/supplier/apply', request.url));
        clearPortalGateCookie(redirect);
        return redirect;
      } else {
        const redirect = NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
        clearPortalGateCookie(redirect);
        return redirect;
      }
    }
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
