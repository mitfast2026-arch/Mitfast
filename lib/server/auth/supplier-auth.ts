import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { supplierRegisterSchema } from '@/lib/validation/auth.schema';
import { updateSupplierProfileSchema } from '@/lib/validation/supplier.schema';
import type { ServerResult } from './get-session';
import { getEmailRedirectTo } from './site-url';

/**
 * Registers a new Supplier account in 'pending' approval status.
 * Auth uses email confirmation; portal access still requires admin approval.
 */
export async function registerSupplier(
  formData: unknown,
  options?: { origin?: string | null }
): Promise<ServerResult<{ supplierId: string; needsEmailConfirmation: boolean }>> {
  try {
    const validated = supplierRegisterSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { contactPerson, companyName, email, phone, country, website, password, address } = validated.data;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Check if email already registered in suppliers or profiles
    const { data: existingSupplier } = await adminClient
      .from('suppliers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingSupplier) {
      return {
        success: false,
        error: { message: 'A supplier account with this email already exists', code: 'DUPLICATE_EMAIL' },
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(options?.origin),
        data: {
          role: 'supplier',
          full_name: contactPerson,
          phone,
        },
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: { message: authError?.message || 'Failed to create supplier user account', code: 'AUTH_ERROR' },
      };
    }

    if (authData.user.identities && authData.user.identities.length === 0) {
      return {
        success: false,
        error: { message: 'An account with this email already exists. Sign in or confirm your email.', code: 'DUPLICATE_EMAIL' },
      };
    }

    const userId = authData.user.id;

    // 3. Create profile
    await adminClient
      .from('profiles')
      .upsert({
        user_id: userId,
        role: 'supplier',
        full_name: contactPerson,
        email,
        phone,
      }, { onConflict: 'user_id' });

    // 4. Create Supplier record with 'pending' status
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .insert({
        user_id: userId,
        company_name: companyName,
        contact_person: contactPerson,
        email,
        phone,
        country,
        address: address || null,
        website: website || null,
        status: 'pending',
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      return {
        success: false,
        error: { message: 'Failed to create supplier profile', code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { supplierId: supplier.id, needsEmailConfirmation: !authData.session },
    };
  } catch (error) {
    console.error('[registerSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error during supplier registration', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Allows a rejected supplier to update their business information and resubmit for Admin approval.
 * Reuses the exact same supplier account without creating duplicates.
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

    // Verify supplier is currently rejected
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
      rejection_reason: null, // clear previous rejection reason
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
