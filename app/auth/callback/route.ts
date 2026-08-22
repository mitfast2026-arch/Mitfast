import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://') || path.includes('\\')) return false;
  return true;
}

function roleAllowsPath(role: string | undefined, path: string): boolean {
  if (path.startsWith('/admin')) return role === 'admin';
  if (path.startsWith('/supplier')) return role === 'supplier';
  if (path.startsWith('/customer')) return role === 'customer';
  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?mode=signin&error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent(error.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth?mode=signin`);
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()) as any;

  const role = profile?.role as string | undefined;

  let supplierStatus: string | undefined;
  if (role === 'supplier') {
    const { data: supplier } = (await supabase
      .from('suppliers')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()) as any;
    supplierStatus = supplier?.status;
  }

  if (next && isSafeInternalPath(next) && roleAllowsPath(role, next)) {
    if (role === 'supplier') {
      if (supplierStatus === 'rejected') {
        return NextResponse.redirect(`${origin}/auth/supplier/rejected`);
      }
      if (supplierStatus !== 'active' && next.startsWith('/supplier')) {
        const pendingQs =
          supplierStatus === 'archived' ? '?status=archived' : '';
        return NextResponse.redirect(`${origin}/auth/supplier/pending${pendingQs}`);
      }
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (role === 'admin') {
    return NextResponse.redirect(`${origin}/admin/dashboard`);
  }

  if (role === 'supplier') {
    if (supplierStatus === 'rejected') {
      return NextResponse.redirect(`${origin}/auth/supplier/rejected`);
    }
    if (supplierStatus === 'active') {
      return NextResponse.redirect(`${origin}/supplier/dashboard`);
    }
    const pendingQs = supplierStatus === 'archived' ? '?status=archived' : '';
    return NextResponse.redirect(`${origin}/auth/supplier/pending${pendingQs}`);
  }

  if (role === 'customer') {
    return NextResponse.redirect(`${origin}/customer/dashboard`);
  }

  return NextResponse.redirect(`${origin}/auth?mode=signin&error=profile_incomplete`);
}
