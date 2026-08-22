import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCustomer } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const { data: profile, error: profError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', auth.session.profile.id)
      .maybeSingle();

    if (profError || !profile) {
      return NextResponse.json(
        { success: false, error: { message: 'Profile not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Fetch primary delivery address
    const { data: address } = await adminClient
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        address: address || null,
      },
    });
  } catch (error) {
    console.error('[GET /api/customer/profile] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { fullName, phone, email, address } = body;
    const adminClient = createAdminClient();
    const targetProfileId = auth.session.profile.id;

    // 2. Update profile basic info
    const profileUpdate: {
      updated_at: string;
      full_name?: string;
      phone?: string;
      email?: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (fullName) profileUpdate.full_name = fullName.trim();
    if (phone) profileUpdate.phone = phone.trim();
    if (email) profileUpdate.email = email.trim();

    const { data: updatedProfile, error: updateError } = await (adminClient
      .from('profiles') as any)
      .update(profileUpdate)
      .eq('id', targetProfileId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { message: updateError.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    // 3. Upsert address if provided
    let savedAddress = null;
    if (address && (address.address_line_1 || address.addressLine1)) {
      const line1 = address.address_line_1 || address.addressLine1;
      const line2 = address.address_line_2 || address.addressLine2 || null;
      const city = address.city || 'Bengaluru';
      const state = address.state || 'Karnataka';
      const postalCode = address.postal_code || address.postalCode || '560001';
      const country = address.country || 'India';

      const { data: existingAddr } = await adminClient
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', targetProfileId)
        .limit(1)
        .maybeSingle();

      if (existingAddr) {
        const { data: addr } = await adminClient
          .from('customer_addresses')
          .update({
            address_line_1: line1,
            address_line_2: line2,
            city,
            state,
            postal_code: postalCode,
            country,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAddr.id)
          .select()
          .single();
        savedAddress = addr;
      } else {
        const { data: addr } = await adminClient
          .from('customer_addresses')
          .insert({
            customer_id: targetProfileId,
            address_line_1: line1,
            address_line_2: line2,
            city,
            state,
            postal_code: postalCode,
            country,
          })
          .select()
          .single();
        savedAddress = addr;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: updatedProfile,
        address: savedAddress,
      },
    });
  } catch (error) {
    console.error('[PUT /api/customer/profile] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
