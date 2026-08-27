import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCustomer } from '@/lib/server/auth/get-session';

/**
 * GET /api/customer/addresses
 * Lists delivery addresses for the authenticated buyer (newest first).
 * Used by the cart RFQ workspace delivery strip.
 */
export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const { data: addresses, error } = await adminClient
      .from('customer_addresses')
      .select(
        'id, customer_id, address_line_1, address_line_2, city, state, postal_code, country, created_at, updated_at'
      )
      .eq('customer_id', auth.session.profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { addresses: addresses || [] },
    });
  } catch (error) {
    console.error('[GET /api/customer/addresses] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
