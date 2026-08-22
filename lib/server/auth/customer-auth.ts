import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerRegisterSchema, updateProfileSchema } from '@/lib/validation/auth.schema';
import type { ServerResult } from './get-session';
import { getEmailRedirectTo } from './site-url';

/**
 * Registers a new Customer account with profile, initial cart, address, and links prior guest enquiries.
 * Uses Supabase Auth signUp (email confirmation). Does not auto-confirm or create an admin session.
 */
export async function registerCustomer(
  formData: unknown,
  options?: { origin?: string | null }
): Promise<ServerResult<{ userId: string; needsEmailConfirmation: boolean }>> {
  try {
    const validated = customerRegisterSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { fullName, email, phone, password, addressLine1, city, state, postalCode, country } = validated.data;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(options?.origin),
        data: {
          role: 'customer',
          full_name: fullName,
          phone,
        },
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: { message: authError?.message || 'Failed to create user account', code: 'AUTH_ERROR' },
      };
    }

    if (authData.user.identities && authData.user.identities.length === 0) {
      return {
        success: false,
        error: { message: 'An account with this email already exists. Sign in or confirm your email.', code: 'DUPLICATE_EMAIL' },
      };
    }

    const userId = authData.user.id;

    // 2. Ensure profile exists
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        user_id: userId,
        role: 'customer',
        full_name: fullName,
        email,
        phone,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: { message: 'Failed to create customer profile', code: 'PROFILE_ERROR' },
      };
    }

    const { data: existingCart } = await adminClient
      .from('carts')
      .select('id')
      .eq('customer_id', profile.id)
      .maybeSingle();

    if (!existingCart) {
      await adminClient.from('carts').insert({ customer_id: profile.id });
    }

    // 4. Create primary delivery address if provided
    if (addressLine1 && city && state && postalCode) {
      await adminClient.from('customer_addresses').insert({
        customer_id: profile.id,
        address_line_1: addressLine1,
        city,
        state,
        postal_code: postalCode,
        country: country || 'India',
      });
    }

    // 5. Link prior guest enquiries by email (phone is a soft match when present)
    let enquiryQuery = adminClient
      .from('enquiries')
      .update({ customer_id: profile.id })
      .ilike('guest_email', email)
      .is('customer_id', null);
    await enquiryQuery;

    return {
      success: true,
      data: { userId, needsEmailConfirmation: !authData.session },
    };
  } catch (error) {
    console.error('[registerCustomer] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error during customer registration', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Updates Customer Profile details (full name, phone).
 */
export async function updateCustomerProfile(
  profileId: string,
  formData: unknown
): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updateProfileSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const adminClient = createAdminClient();
    const updatePayload: Record<string, string> = {};
    if (validated.data.fullName) updatePayload.full_name = validated.data.fullName;
    if (validated.data.phone) updatePayload.phone = validated.data.phone;

    const { error } = await (adminClient as any)
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileId);

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { updated: true },
    };
  } catch (error) {
    console.error('[updateCustomerProfile] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to update profile', code: 'INTERNAL_ERROR' },
    };
  }
}
