import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nameFromAuthUser } from '@/lib/server/auth/profile-complete';
import { mergeGuestStateIntoCustomer } from '@/lib/server/guest/merge-guest-state';
import {
  isIdentityComplete,
  isSafeInternalPath,
  resolvePostAuthPath,
} from '@/lib/auth/post-auth-path';

function isPasswordResetNext(path: string | null | undefined): boolean {
  if (!path || !isSafeInternalPath(path)) return false;
  const pathname = path.split('?')[0];
  return pathname === '/auth/reset-password';
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

  if (isPasswordResetNext(next)) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('[GET /auth/callback] admin client unavailable', err instanceof Error ? err.message : err);
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent('Authentication completed but profile setup failed. Please try again.')}`
    );
  }

  let profile: { role?: string; full_name?: string | null; phone?: string | null; email?: string | null } | null = null;
  try {
    const loaded = await admin
      .from('profiles')
      .select('role, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = loaded.data;
  } catch (err) {
    console.error('[GET /auth/callback] profile load failed', err instanceof Error ? err.message : err);
    return NextResponse.redirect(
      `${origin}/auth?mode=signin&error=${encodeURIComponent('Authentication completed but profile setup failed. Please try again.')}`
    );
  }

  // Ensure profile row exists for OAuth users (trigger should create; upsert as safety)
  if (!profile) {
    try {
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
    } catch (err) {
      console.error('[GET /auth/callback] profile upsert failed', err instanceof Error ? err.message : err);
      return NextResponse.redirect(
        `${origin}/auth?mode=signin&error=${encodeURIComponent('Authentication completed but profile setup failed. Please try again.')}`
      );
    }
  }

  const role = profile?.role as string | undefined;
  const identityOk = isIdentityComplete({
    full_name: profile?.full_name,
    phone: profile?.phone,
    email: profile?.email || user.email,
  });
  const safeNext = next && isSafeInternalPath(next) ? next : undefined;

  // 1. Admin Handling
  if (role === 'admin') {
    const target = resolvePostAuthPath({
      role: 'admin',
      redirectPath: safeNext,
      identityComplete: true,
    });
    return NextResponse.redirect(`${origin}${target}`);
  }

  // 2. Customer / Buyer Handling
  if (role === 'customer' || !role) {
    const { data: customerProfile } = await admin
      .from('profiles')
      .select('id, full_name, phone, email')
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

    const target = resolvePostAuthPath({
      role: 'customer',
      redirectPath: safeNext,
      identityComplete: isIdentityComplete({
        full_name: customerProfile?.full_name ?? profile?.full_name,
        phone: customerProfile?.phone ?? profile?.phone,
        email: customerProfile?.email || profile?.email || user.email,
      }),
    });
    return NextResponse.redirect(`${origin}${target}`);
  }

  // 3. Supplier Handling
  if (role === 'supplier') {
    const { data: supplier } = await admin
      .from('suppliers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    const target = resolvePostAuthPath({
      role: 'supplier',
      supplierStatus: (supplier as { status?: string } | null)?.status ?? null,
      redirectPath: safeNext,
      identityComplete: identityOk,
    });
    return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}/customer/dashboard`);
}
