import { createAdminClient } from '@/lib/supabase/admin';
import { updateBusinessSettingsSchema } from '@/lib/validation/settings.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';

export interface BusinessSettingsData {
  id: string;
  companyName: string;
  logoUrl: string | null;
  productsBannerUrl: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  website: string | null;
  minimumRfqValue: number;
  defaultGstRate: number;
  currency: string;
  maxProductImages: number;
  supplierApprovalRequired: boolean;
  productApprovalRequired: boolean;
  googleLoginEnabled: boolean;
}

// Module-level in-memory cache for singleton business settings
let cachedSettings: BusinessSettingsData | null = null;
let settingsFetchedAt = 0;
const SETTINGS_TTL_MS = 5 * 60_000; // 5 minutes

export function invalidateServerSettings(): void {
  cachedSettings = null;
  settingsFetchedAt = 0;
}

/**
 * Retrieves the singleton business settings with request-level and short module-level caching.
 */
export async function getBusinessSettings(force = false): Promise<ServerResult<BusinessSettingsData>> {
  try {
    const now = Date.now();
    if (!force && cachedSettings && now - settingsFetchedAt < SETTINGS_TTL_MS) {
      return { success: true, data: cachedSettings };
    }

    const adminClient = createAdminClient();
    const { data: settings, error } = await adminClient
      .from('business_settings')
      .select(
        'id, company_name, logo_url, products_banner_url, business_email, business_phone, business_address, website, minimum_rfq_value, default_gst_rate, currency, max_product_images, supplier_approval_required, product_approval_required, google_login_enabled',
      )
      .limit(1)
      .single();

    if (error || !settings) {
      return { success: false, error: { message: 'Business settings not found', code: 'NOT_FOUND' } };
    }

    const data: BusinessSettingsData = {
      id: settings.id,
      companyName: settings.company_name,
      logoUrl: settings.logo_url,
      productsBannerUrl: settings.products_banner_url ?? null,
      businessEmail: settings.business_email,
      businessPhone: settings.business_phone,
      businessAddress: settings.business_address,
      website: settings.website,
      minimumRfqValue: settings.minimum_rfq_value,
      defaultGstRate: settings.default_gst_rate,
      currency: settings.currency,
      maxProductImages: settings.max_product_images,
      supplierApprovalRequired: settings.supplier_approval_required,
      productApprovalRequired: settings.product_approval_required,
      googleLoginEnabled: settings.google_login_enabled,
    };

    cachedSettings = data;
    settingsFetchedAt = now;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[getBusinessSettings] Error:', error);
    return { success: false, error: { message: 'Failed to load settings', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin updates the business settings.
 */
export async function updateBusinessSettings(
  formData: unknown
): Promise<ServerResult<BusinessSettingsData | { updated: boolean }>> {
  try {
    const validated = updateBusinessSettingsSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const adminClient = createAdminClient();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const d = validated.data;
    if (d.companyName !== undefined) updatePayload.company_name = d.companyName;
    if (d.logoUrl !== undefined) updatePayload.logo_url = d.logoUrl;
    if (d.productsBannerUrl !== undefined) updatePayload.products_banner_url = d.productsBannerUrl;
    if (d.businessEmail !== undefined) updatePayload.business_email = d.businessEmail;
    if (d.businessPhone !== undefined) updatePayload.business_phone = d.businessPhone;
    if (d.businessAddress !== undefined) updatePayload.business_address = d.businessAddress;
    if (d.website !== undefined) updatePayload.website = d.website;
    if (d.minimumRfqValue !== undefined) updatePayload.minimum_rfq_value = d.minimumRfqValue;
    if (d.defaultGstRate !== undefined) updatePayload.default_gst_rate = d.defaultGstRate;
    if (d.currency !== undefined) updatePayload.currency = d.currency.toUpperCase();
    if (d.maxProductImages !== undefined) updatePayload.max_product_images = d.maxProductImages;
    if (d.supplierApprovalRequired !== undefined) updatePayload.supplier_approval_required = d.supplierApprovalRequired;
    if (d.productApprovalRequired !== undefined) updatePayload.product_approval_required = d.productApprovalRequired;
    if (d.googleLoginEnabled !== undefined) updatePayload.google_login_enabled = d.googleLoginEnabled;

    const { error } = await (adminClient as any)
      .from('business_settings')
      .update(updatePayload)
      .neq('id', '00000000-0000-0000-0000-000000000000'); // updates the singleton row

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    invalidateServerSettings();

    const refreshed = await getBusinessSettings(true);
    if (!refreshed.success) {
      return { success: true, data: { updated: true } };
    }

    return { success: true, data: refreshed.data };
  } catch (error) {
    console.error('[updateBusinessSettings] Error:', error);
    return { success: false, error: { message: 'Failed to update settings', code: 'INTERNAL_ERROR' } };
  }
}
