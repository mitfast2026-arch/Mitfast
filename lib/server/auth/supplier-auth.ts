import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { supplierApplicationSchema } from '@/lib/validation/auth.schema';
import { updateSupplierProfileSchema } from '@/lib/validation/supplier.schema';
import type { ServerResult } from './get-session';
import { emailFromAuthUser, isProfileIdentityComplete } from './profile-complete';
import { notifyAdminNewSupplierApplication } from '@/lib/server/email/supplier-notifications';

/**
 * Creates supplier application on existing `suppliers` table as pending.
 * Caller must already be authenticated (Google or email OTP).
 */
export async function submitSupplierApplication(
  formData: unknown
): Promise<ServerResult<{ supplierId: string; status: string }>> {
  try {
    const validated = supplierApplicationSchema.safeParse(formData);
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

    const email = emailFromAuthUser(user).toLowerCase();
    if (!email) {
      return { success: false, error: { message: 'Verified email is required', code: 'VALIDATION_ERROR' } };
    }

    const adminClient = createAdminClient();
    const { contactPerson, companyName, phone, country, website, address } = validated.data;

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role === 'customer') {
      return {
        success: false,
        error: {
          message: 'This account is already a buyer. Use a different email for supplier registration.',
          code: 'ROLE_LOCKED',
        },
      };
    }

    if (profile?.role === 'admin') {
      return {
        success: false,
        error: { message: 'Admin accounts cannot register as suppliers.', code: 'ROLE_LOCKED' },
      };
    }

    if (!isProfileIdentityComplete({ ...profile, full_name: contactPerson, phone, email })) {
      // Ensure profile identity from application fields
    }

    await adminClient.from('profiles').upsert(
      {
        user_id: user.id,
        role: 'supplier',
        full_name: contactPerson,
        email,
        phone,
      },
      { onConflict: 'user_id' }
    );

    const { data: byUser } = await adminClient
      .from('suppliers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (byUser) {
      if (byUser.status === 'active') {
        return {
          success: false,
          error: { message: 'Supplier account already active', code: 'ALREADY_ACTIVE' },
        };
      }
      if (byUser.status === 'pending') {
        const { data: updated, error: updateError } = await adminClient
          .from('suppliers')
          .update({
            company_name: companyName,
            contact_person: contactPerson,
            email,
            phone,
            country,
            address,
            website: website || null,
          })
          .eq('id', byUser.id)
          .select('id, status')
          .single();

        if (updateError || !updated) {
          return {
            success: false,
            error: { message: updateError?.message || 'Failed to update supplier', code: 'DATABASE_ERROR' },
          };
        }

        return { success: true, data: { supplierId: updated.id, status: updated.status } };
      }
      // rejected / archived: update and set pending
      const { data: updated, error: updateError } = await adminClient
        .from('suppliers')
        .update({
          company_name: companyName,
          contact_person: contactPerson,
          email,
          phone,
          country,
          address,
          website: website || null,
          status: 'pending',
          rejection_reason: null,
          archived_at: null,
        })
        .eq('id', byUser.id)
        .select('id, status')
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: { message: updateError?.message || 'Failed to update supplier', code: 'DATABASE_ERROR' },
        };
      }
      return { success: true, data: { supplierId: updated.id, status: updated.status } };
    }

    const { data: byEmail } = await adminClient
      .from('suppliers')
      .select('id, user_id, status')
      .ilike('email', email)
      .neq('status', 'archived')
      .maybeSingle();

    if (byEmail && byEmail.user_id !== user.id) {
      return {
        success: false,
        error: { message: 'A supplier account with this email already exists', code: 'DUPLICATE_EMAIL' },
      };
    }

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .insert({
        user_id: user.id,
        company_name: companyName,
        contact_person: contactPerson,
        email,
        phone,
        country,
        address,
        website: website || null,
        status: 'pending',
      })
      .select('id, status')
      .single();

    if (supplierError || !supplier) {
      return {
        success: false,
        error: { message: supplierError?.message || 'Failed to create supplier profile', code: 'DATABASE_ERROR' },
      };
    }

    void notifyAdminNewSupplierApplication(supplier.id);

    return { success: true, data: { supplierId: supplier.id, status: supplier.status } };
  } catch (error) {
    console.error('[submitSupplierApplication] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error during supplier registration', code: 'INTERNAL_ERROR' },
    };
  }
}

/** @deprecated Prefer submitSupplierApplication after OTP/Google. */
export async function registerSupplier(): Promise<
  ServerResult<{ supplierId: string; needsEmailConfirmation: boolean }>
> {
  return {
    success: false,
    error: {
      message: 'Password registration is disabled. Use Google or email OTP, then submit the supplier form.',
      code: 'DEPRECATED',
    },
  };
}

/**
 * Allows a rejected supplier to update their business information and resubmit for Admin approval.
 */
export async function resubmitSupplierApplication(
  supplierId: string,
  formData: unknown
): Promise<ServerResult<{ resubmitted: boolean }>> {
  try {
    const validated = updateSupplierProfileSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const adminClient = createAdminClient();

    const { data: supplier, error: fetchError } = await adminClient
      .from('suppliers')
      .select('id, status')
      .eq('id', supplierId)
      .single();

    if (fetchError || !supplier) {
      return {
        success: false,
        error: { message: 'Supplier not found', code: 'NOT_FOUND' },
      };
    }

    if (supplier.status !== 'rejected') {
      return {
        success: false,
        error: { message: 'Only rejected supplier accounts can be resubmitted', code: 'INVALID_STATUS' },
      };
    }

    const updatePayload: Record<string, string | null> = {
      status: 'pending',
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    };

    if (validated.data.companyName) updatePayload.company_name = validated.data.companyName;
    if (validated.data.contactPerson) updatePayload.contact_person = validated.data.contactPerson;
    if (validated.data.phone) updatePayload.phone = validated.data.phone;
    if (validated.data.address !== undefined) updatePayload.address = validated.data.address || null;
    if (validated.data.country) updatePayload.country = validated.data.country;
    if (validated.data.website !== undefined) updatePayload.website = validated.data.website || null;

    const { error: updateError } = await (adminClient as any)
      .from('suppliers')
      .update(updatePayload)
      .eq('id', supplierId);

    if (updateError) {
      return {
        success: false,
        error: { message: updateError.message, code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { resubmitted: true },
    };
  } catch (error) {
    console.error('[resubmitSupplierApplication] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to resubmit application', code: 'INTERNAL_ERROR' },
    };
  }
}
