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

/**
 * Onboarding intent only — never used as final authorization.
 * Final access uses profiles.role + suppliers.status on the server.
 */
function onboardingWantsSupplier(next: string | null | undefined): boolean {
  if (!next || !isSafeInternalPath(next)) return false;
  if (next.includes('role=supplier')) return true;
  if (next.startsWith('/supplier')) return true;
  if (next.startsWith('/auth/supplier')) return true;
  try {
    const parsed = new URL(next, 'http://local.invalid');
    if (
      parsed.pathname.startsWith('/auth/complete-profile') &&
      parsed.searchParams.get('role') === 'supplier'
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  if (errorParam) {
    console.error('[GET /auth/callback] provider error', errorParam);
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent('Authentication failed. Please try again.')}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?mode=signin&error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[GET /auth/callback] exchangeCodeForSession', error);
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent('Authentication failed. Please try again.')}`
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
    // user_metadata.role is onboarding hint only; next path also carries supplier intent
    const intended =
      onboardingWantsSupplier(next) || user.user_metadata?.role === 'supplier'
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

  // 1. Supplier Handling
  if (role === 'supplier' || onboardingWantsSupplier(next)) {
    // Ensure profile has supplier role
    if (profile && profile.role !== 'supplier') {
      await admin.from('profiles').update({ role: 'supplier' }).eq('user_id', user.id);
    }

    const { data: supplier } = await admin
      .from('suppliers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!supplier) {
      // New supplier -> direct straight to existing supplier application form
      return NextResponse.redirect(`${origin}/auth/supplier/apply`);
    }

    if (supplier.status === 'active') {
      const target = next && isSafeInternalPath(next) && next.startsWith('/supplier')
        ? next
        : '/supplier/dashboard';
      return NextResponse.redirect(`${origin}${target}`);
    }

    if (supplier.status === 'rejected') {
      return NextResponse.redirect(`${origin}/auth/supplier/rejected`);
    }

    const pendingQs = supplier.status === 'archived' ? '?status=archived' : '';
    return NextResponse.redirect(`${origin}/auth/supplier/pending${pendingQs}`);
  }

  // 2. Buyer (Customer) Handling
  if (role === 'customer' || !role) {
    const { data: customerProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customerProfile?.id) {
      const mergeResult = await mergeGuestStateIntoCustomer(customerProfile.id);
      if (!mergeResult.success) {
        console.error('[auth/callback] guest merge failed', {
          customerId: customerProfile.id,
          code: mergeResult.error?.code,
          message: mergeResult.error?.message,
        });
      }
    }

    if (next && isSafeInternalPath(next) && roleAllowsPath('customer', next)) {
      if (!next.startsWith('/auth/supplier') && !next.startsWith('/admin')) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    return NextResponse.redirect(`${origin}/customer/dashboard`);
  }

  // 3. Admin Handling
  if (role === 'admin') {
    const target = next && isSafeInternalPath(next) && next.startsWith('/admin')
      ? next
      : '/admin/dashboard';
    return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}/customer/dashboard`);
}
