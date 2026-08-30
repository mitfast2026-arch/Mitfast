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
import {
  OAUTH_INTENT_COOKIE,
  portalToDbRole,
  isFreshOAuthProfile,
  BUYER_ON_SUPPLIER_ERROR_MESSAGE,
  SUPPLIER_ON_BUYER_ERROR_MESSAGE,
  type PortalRole,
} from '@/lib/auth/portal-role';

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

  // Determine intended portal from intent cookie or next parameter immediately
  const intentCookie = request.cookies.get(OAUTH_INTENT_COOKIE)?.value;
  const intendedPortal: PortalRole =
    intentCookie === 'supplier' || onboardingWantsSupplier(next)
      ? 'supplier'
      : 'buyer';

  const makeAuthRedirect = (errorMsg?: string) => {
    const params = new URLSearchParams();
    params.set('role', intendedPortal);
    params.set('mode', 'signin');
    if (errorMsg) {
      params.set('error', errorMsg);
    }
    const res = NextResponse.redirect(`${origin}/auth?${params.toString()}`);
    res.cookies.delete(OAUTH_INTENT_COOKIE);
    return res;
  };

  if (errorParam) {
    console.error('[GET /auth/callback] provider error:', errorParam);
    const isCancelled = errorParam.toLowerCase().includes('cancel') || errorParam.toLowerCase().includes('denied');
    const msg = isCancelled ? 'Sign-in cancelled' : 'Authentication failed. Please try again.';
    return makeAuthRedirect(msg);
  }

  if (!code) {
    console.error('[GET /auth/callback] missing auth code');
    return makeAuthRedirect('Authentication failed: missing authorization code.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[GET /auth/callback] exchangeCodeForSession error:', error.message);
    return makeAuthRedirect('Authentication session could not be established. Please try again.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('[GET /auth/callback] no user retrieved after code exchange');
    return makeAuthRedirect('User session could not be loaded. Please try again.');
  }

  if (isPasswordResetNext(next)) {
    const res = NextResponse.redirect(`${origin}${next}`);
    res.cookies.delete(OAUTH_INTENT_COOKIE);
    return res;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('[GET /auth/callback] admin client unavailable', err instanceof Error ? err.message : err);
    return makeAuthRedirect('Authentication completed but profile service is unavailable. Please try again.');
  }

  let profile: {
    role?: string;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    created_at?: string | null;
  } | null = null;

  try {
    const loaded = await admin
      .from('profiles')
      .select('role, full_name, phone, email, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = loaded.data;
  } catch (err) {
    console.error('[GET /auth/callback] profile load failed', err instanceof Error ? err.message : err);
    return makeAuthRedirect('Authentication completed but profile lookup failed. Please try again.');
  }

  // Check if supplier record exists
  let supplierRow: { id: string; status: string } | null = null;
  try {
    const supRes = await admin
      .from('suppliers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    supplierRow = supRes.data;
  } catch {
    /* ignore */
  }

  // Ensure profile row exists for OAuth users
  if (!profile) {
    try {
      const dbRole = portalToDbRole(intendedPortal);
      await admin.from('profiles').upsert(
        {
          user_id: user.id,
          role: dbRole,
          full_name: nameFromAuthUser(user),
          email: (user.email || '').toLowerCase(),
          phone: '',
        },
        { onConflict: 'user_id' }
      );
      const refreshed = await admin
        .from('profiles')
        .select('role, full_name, phone, email, created_at')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = refreshed.data;
    } catch (err) {
      console.error('[GET /auth/callback] profile upsert failed', err instanceof Error ? err.message : err);
      return makeAuthRedirect('Authentication completed but profile creation failed. Please try again.');
    }
  }

  // Role reconciliation for OAuth
  if (intendedPortal === 'supplier') {
    if (profile?.role === 'customer') {
      const isFresh = isFreshOAuthProfile(profile, Boolean(supplierRow?.id));
      if (isFresh) {
        // Upgrade fresh trigger-created customer stub into supplier
        try {
          await admin
            .from('profiles')
            .update({
              role: 'supplier',
              full_name: profile.full_name || nameFromAuthUser(user),
              email: (user.email || profile.email || '').toLowerCase(),
            })
            .eq('user_id', user.id);

          profile.role = 'supplier';
        } catch (updateErr) {
          console.error('[GET /auth/callback] failed to set supplier role on fresh profile', updateErr);
        }
      } else {
        // Established buyer attempting to sign in on supplier portal
        await supabase.auth.signOut();
        const res = NextResponse.redirect(
          `${origin}/auth?role=supplier&mode=signin&error=${encodeURIComponent(BUYER_ON_SUPPLIER_ERROR_MESSAGE)}`
        );
        res.cookies.delete(OAUTH_INTENT_COOKIE);
        return res;
      }
    }
  } else if (intendedPortal === 'buyer') {
    if (profile?.role === 'supplier') {
      // Established supplier attempting to sign in on buyer portal
      await supabase.auth.signOut();
      const res = NextResponse.redirect(
        `${origin}/auth?role=buyer&mode=signin&error=${encodeURIComponent(SUPPLIER_ON_BUYER_ERROR_MESSAGE)}`
      );
      res.cookies.delete(OAUTH_INTENT_COOKIE);
      return res;
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
    const res = NextResponse.redirect(`${origin}${target}`);
    res.cookies.delete(OAUTH_INTENT_COOKIE);
    return res;
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
    const res = NextResponse.redirect(`${origin}${target}`);
    res.cookies.delete(OAUTH_INTENT_COOKIE);
    return res;
  }

  // 3. Supplier Handling
  if (role === 'supplier') {
    // If no supplier record yet, route directly to supplier application to gather company details
    if (!supplierRow) {
      const res = NextResponse.redirect(`${origin}/auth/supplier/apply`);
      res.cookies.delete(OAUTH_INTENT_COOKIE);
      return res;
    }

    const target = resolvePostAuthPath({
      role: 'supplier',
      supplierStatus: supplierRow.status ?? null,
      redirectPath: safeNext,
      identityComplete: identityOk,
    });
    const res = NextResponse.redirect(`${origin}${target}`);
    res.cookies.delete(OAUTH_INTENT_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(`${origin}/customer/dashboard`);
  res.cookies.delete(OAUTH_INTENT_COOKIE);
  return res;
}
