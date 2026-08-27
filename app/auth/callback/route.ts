import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isProfileIdentityComplete, nameFromAuthUser } from '@/lib/server/auth/profile-complete';
import { mergeGuestStateIntoCustomer } from '@/lib/server/guest/merge-guest-state';

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
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent(errorParam)}`
    );
  }

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

  const admin = createAdminClient();
  let { data: profile } = await admin
    .from('profiles')
    .select('role, full_name, phone, email')
    .eq('user_id', user.id)
    .maybeSingle();

  // Ensure profile row exists for OAuth users (trigger should create; upsert as safety)
  if (!profile) {
    const intended =
      typeof next === 'string' && next.includes('role=supplier')
        ? 'supplier'
        : user.user_metadata?.role === 'supplier'
          ? 'supplier'
          : 'customer';
    await admin.from('profiles').upsert(
      {
        user_id: user.id,
        role: intended,
        full_name: nameFromAuthUser(user),
        email: (user.email || '').toLowerCase(),
        phone: '',
      },
      { onConflict: 'user_id' }
    );
    const refreshed = await admin
      .from('profiles')
      .select('role, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = refreshed.data;
  }

  const role = profile?.role as string | undefined;

  if (!isProfileIdentityComplete(profile)) {
    const roleQs =
      role === 'supplier' || (typeof next === 'string' && next.includes('role=supplier'))
        ? 'supplier'
        : 'buyer';
    const redirectQs =
      next && isSafeInternalPath(next) && !next.startsWith('/auth')
        ? `&redirect=${encodeURIComponent(next)}`
        : '';
    return NextResponse.redirect(`${origin}/auth/complete-profile?role=${roleQs}${redirectQs}`);
  }

  // Merge guest cart/wishlist once buyer profile is complete (OAuth / magic link).
  if (role === 'customer') {
    const { data: customerProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (customerProfile?.id) {
      await mergeGuestStateIntoCustomer(customerProfile.id);
    }
  }

  let supplierStatus: string | undefined;
  if (role === 'supplier') {
    const { data: supplier } = await admin
      .from('suppliers')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    supplierStatus = supplier?.status;
    if (!supplier) {
      return NextResponse.redirect(`${origin}/auth/supplier/apply`);
    }
  }

  if (next && isSafeInternalPath(next) && roleAllowsPath(role, next)) {
    if (next.startsWith('/auth/complete-profile') || next.startsWith('/auth/supplier/apply')) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    if (role === 'supplier') {
      if (supplierStatus === 'rejected') {
        return NextResponse.redirect(`${origin}/auth/supplier/rejected`);
      }
      if (supplierStatus !== 'active' && next.startsWith('/supplier')) {
        const pendingQs = supplierStatus === 'archived' ? '?status=archived' : '';
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
    if (!supplierStatus) {
      return NextResponse.redirect(`${origin}/auth/supplier/apply`);
    }
    const pendingQs = supplierStatus === 'archived' ? '?status=archived' : '';
    return NextResponse.redirect(`${origin}/auth/supplier/pending${pendingQs}`);
  }

  if (role === 'customer') {
    return NextResponse.redirect(`${origin}/customer/dashboard`);
  }

  return NextResponse.redirect(`${origin}/auth/complete-profile?role=buyer`);
}
