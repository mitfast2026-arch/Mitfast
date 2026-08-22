import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

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

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

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
      return NextResponse.redirect(redirectUrl);
    }

    // Resolve user role
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const profile = profileData as { role?: string } | null;
    const role = profile?.role;

    if (isAdminRoute && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (isCustomerRoute && role !== 'customer') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (isSupplierRoute) {
      if (role !== 'supplier') {
        return NextResponse.redirect(new URL('/auth?role=supplier&mode=signin', request.url));
      }

      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      const supplier = supplierData as { status?: string } | null;

      if (!supplier || supplier.status === 'pending') {
        return NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
      }

      if (supplier.status === 'rejected') {
        return NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
      }

      if (supplier.status === 'archived') {
        return NextResponse.redirect(new URL('/auth/supplier/pending?status=archived', request.url));
      }
    }
  }

  // 2. Redirect authenticated users visiting login/register pages
  if (
    isAuthRoute &&
    user &&
    !pathname.includes('/pending') &&
    !pathname.includes('/rejected') &&
    !pathname.includes('/callback')
  ) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const profile = profileData as { role?: string } | null;

    if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else if (profile?.role === 'customer') {
      return NextResponse.redirect(new URL('/customer/dashboard', request.url));
    } else if (profile?.role === 'supplier') {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      const supplier = supplierData as { status?: string } | null;

      if (supplier?.status === 'active') {
        return NextResponse.redirect(new URL('/supplier/dashboard', request.url));
      } else if (supplier?.status === 'rejected') {
        return NextResponse.redirect(new URL('/auth/supplier/rejected', request.url));
      } else {
        return NextResponse.redirect(new URL('/auth/supplier/pending', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/supplier/:path*',
    '/customer/:path*',
    '/auth/:path*',
  ],
};
