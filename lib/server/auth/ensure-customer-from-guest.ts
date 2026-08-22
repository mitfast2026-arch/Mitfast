import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { randomBytes } from 'crypto';

export async function ensureCustomerFromGuest(params: {
  email: string;
  phone: string;
  fullName: string;
  deliveryAddress?: {
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  };
}): Promise<ServerResult<{ customerId: string }>> {
  try {
    const email = params.email.trim().toLowerCase();
    const phone = params.phone.trim();
    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .eq('role', 'customer')
      .maybeSingle();

    if (existing?.id) {
      if (params.deliveryAddress?.address_line_1) {
        const { data: addr } = await adminClient
          .from('customer_addresses')
          .select('id')
          .eq('customer_id', existing.id)
          .limit(1)
          .maybeSingle();
        if (!addr) {
          await adminClient.from('customer_addresses').insert({
            customer_id: existing.id,
            address_line_1: params.deliveryAddress.address_line_1,
            address_line_2: params.deliveryAddress.address_line_2 || null,
            city: params.deliveryAddress.city,
            state: params.deliveryAddress.state,
            postal_code: params.deliveryAddress.postal_code,
            country: params.deliveryAddress.country || 'India',
          });
        }
      }
      return { success: true, data: { customerId: existing.id } };
    }

    const tempPassword = `Tmp-${randomBytes(9).toString('base64url')}`;
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'customer',
        full_name: params.fullName,
        phone,
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: { message: authError?.message || 'Failed to create customer from enquiry', code: 'AUTH_ERROR' },
      };
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        user_id: authData.user.id,
        role: 'customer',
        full_name: params.fullName,
        email,
        phone,
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (profileError || !profile) {
      return { success: false, error: { message: 'Failed to create customer profile', code: 'PROFILE_ERROR' } };
    }

    await adminClient.from('carts').insert({ customer_id: profile.id }).maybeSingle();

    if (params.deliveryAddress?.address_line_1) {
      await adminClient.from('customer_addresses').insert({
        customer_id: profile.id,
        address_line_1: params.deliveryAddress.address_line_1,
        address_line_2: params.deliveryAddress.address_line_2 || null,
        city: params.deliveryAddress.city,
        state: params.deliveryAddress.state,
        postal_code: params.deliveryAddress.postal_code,
        country: params.deliveryAddress.country || 'India',
      });
    }

    await adminClient
      .from('enquiries')
      .update({ customer_id: profile.id, updated_at: new Date().toISOString() })
      .eq('guest_email', email)
      .is('customer_id', null);

    return { success: true, data: { customerId: profile.id } };
  } catch (error) {
    console.error('[ensureCustomerFromGuest]', error);
    return { success: false, error: { message: 'Failed to provision customer', code: 'INTERNAL_ERROR' } };
  }
}
