import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UserRole, SupplierStatus } from '@/types/database';

export interface AuthSessionData {
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    role: UserRole;
    fullName: string | null;
    email: string;
    phone: string | null;
  };
  supplier?: {
    id: string;
    status: SupplierStatus;
    companyName: string;
    rejectionReason: string | null;
  } | null;
}

export type ServerResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

async function loadServerSession(): Promise<AuthSessionData | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, phone')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    const profileData = profile as any;
    let supplierData = null;
    if (profileData?.role === 'supplier') {
      const { data: supplier } = (await supabase
        .from('suppliers')
        .select('id, status, company_name, rejection_reason')
        .eq('user_id', user.id)
        .maybeSingle()) as any;

      if (supplier) {
        supplierData = {
          id: supplier.id,
          status: supplier.status,
          companyName: supplier.company_name,
          rejectionReason: supplier.rejection_reason,
        };
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      profile: {
        id: profileData.id,
        role: profileData.role,
        fullName: profileData.full_name,
        email: profileData.email,
        phone: profileData.phone,
      },
      supplier: supplierData,
    };
  } catch (error) {
    console.error('[getServerSession] Exception:', error);
    return null;
  }
}

/**
 * Validates the current user session on the server (deduped per request via React.cache).
 */
export const getServerSession = cache(loadServerSession);

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: { message, code: 'UNAUTHORIZED' } },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: { message, code: 'FORBIDDEN' } },
    { status: 403 }
  );
}

export async function requireAdmin(): Promise<
  | { ok: true; session: AuthSessionData }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };
  if (session.profile.role !== 'admin') return { ok: false, response: forbiddenResponse() };
  return { ok: true, session };
}

export async function requireCustomer(): Promise<
  | { ok: true; session: AuthSessionData }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };
  if (session.profile.role !== 'customer') return { ok: false, response: forbiddenResponse() };
  return { ok: true, session };
}

export async function requireSupplierRole(): Promise<
  | { ok: true; session: AuthSessionData }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };
  if (session.profile.role !== 'supplier') {
    return { ok: false, response: forbiddenResponse('Supplier account required') };
  }
  return { ok: true, session };
}

export async function requireSupplier(): Promise<
  | { ok: true; session: AuthSessionData }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };
  if (session.profile.role !== 'supplier' || !session.supplier || session.supplier.status !== 'active') {
    return { ok: false, response: forbiddenResponse('Active supplier session required') };
  }
  return { ok: true, session };
}

/**
 * Admin, or active supplier with at least one line item on the RFQ.
 * Used by accept / reject / negotiate so suppliers can act on matching RFQs.
 */
export async function requireAdminOrSupplierOnRfq(
  rfqId: string,
  supplierOwnsRfq: (supplierId: string, rfqId: string) => Promise<boolean>
): Promise<
  | { ok: true; session: AuthSessionData; isAdmin: boolean }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };

  if (session.profile.role === 'admin') {
    return { ok: true, session, isAdmin: true };
  }

  if (
    session.profile.role === 'supplier' &&
    session.supplier &&
    session.supplier.status === 'active'
  ) {
    const owns = await supplierOwnsRfq(session.supplier.id, rfqId);
    if (owns) return { ok: true, session, isAdmin: false };
  }

  return { ok: false, response: forbiddenResponse() };
}
