import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { completeProfileSchema, updateProfileSchema } from '@/lib/validation/auth.schema';
import type { ServerResult } from './get-session';
import {
  emailFromAuthUser,
  nameFromAuthUser,
} from './profile-complete';
import { mergeGuestStateIntoCustomer } from '@/lib/server/guest/merge-guest-state';

/**
 * Completes buyer/customer (or shared) identity on existing profiles row.
 * Ensures cart for customers. Never changes an existing profiles.role.
 */
export async function completeUserProfile(
  formData: unknown,
  options?: { intendedRole?: 'customer' | 'supplier' }
): Promise<ServerResult<{ profileId: string; role: string }>> {
  try {
    const validated = completeProfileSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { message: 'Not authenticated', code: 'UNAUTHORIZED' } };
    }

    const adminClient = createAdminClient();
    const email = (validated.data.email || emailFromAuthUser(user)).trim().toLowerCase();
    if (!email) {
      return { success: false, error: { message: 'Email is required', code: 'VALIDATION_ERROR' } };
    }

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, role, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();

    const intended = options?.intendedRole;
    let role: 'customer' | 'supplier' | 'admin' = (existing?.role as any) || intended || 'customer';

    if (existing?.role === 'admin') {
      role = 'admin';
    } else if (existing?.role && intended && existing.role !== intended) {
      return {
        success: false,
        error: {
          message: `This account is already registered as a ${existing.role}. Sign in with that role.`,
          code: 'ROLE_LOCKED',
        },
      };
    } else if (existing?.role) {
      role = existing.role as 'customer' | 'supplier' | 'admin';
    } else if (intended) {
      role = intended;
    } else {
      const metaRole = user.user_metadata?.role;
      role = metaRole === 'supplier' ? 'supplier' : 'customer';
    }

    const fullName = validated.data.fullName.trim() || nameFromAuthUser(user);
    const phone = validated.data.phone.trim();

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          role,
          full_name: fullName,
          email,
          phone,
        },
        { onConflict: 'user_id' }
      )
      .select('id, role')
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: { message: profileError?.message || 'Failed to save profile', code: 'PROFILE_ERROR' },
      };
    }

    if (profile.role === 'customer') {
      const { data: existingCart } = await adminClient
        .from('carts')
        .select('id')
        .eq('customer_id', profile.id)
        .maybeSingle();

      if (!existingCart) {
        await adminClient.from('carts').insert({ customer_id: profile.id });
      }

      await adminClient
        .from('enquiries')
        .update({ customer_id: profile.id })
        .ilike('guest_email', email)
        .is('customer_id', null);

      await mergeGuestStateIntoCustomer(profile.id);
    }

    return { success: true, data: { profileId: profile.id, role: profile.role } };
  } catch (error) {
    console.error('[completeUserProfile] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error completing profile', code: 'INTERNAL_ERROR' },
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

/** @deprecated Prefer completeUserProfile after OTP/Google. */
export async function registerCustomer(): Promise<
  ServerResult<{ userId: string; needsEmailConfirmation: boolean }>
> {
  return {
    success: false,
    error: {
      message: 'Password registration is disabled. Use Google or email OTP.',
      code: 'DEPRECATED',
    },
  };
}
