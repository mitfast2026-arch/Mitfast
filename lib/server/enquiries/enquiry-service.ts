import { createAdminClient } from '@/lib/supabase/admin';
import { createEnquirySchema, updateEnquiryStatusSchema, respondToEnquirySchema, updateEnquiryDetailsSchema } from '@/lib/validation/enquiry.schema';
import {
  allowedFrom,
  ENQUIRY_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';
import { withIdempotency } from '@/lib/server/db/idempotency';
import { sanitizePostgrestSearch } from '@/lib/server/db/sanitize-search';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { EnquiryStatus } from '@/types/database';
import { generateTrackingToken } from '@/lib/server/tracking';
import { uploadEnquiryDocument, signedDocumentUrl } from '@/lib/server/storage/storage-service';

async function withSignedAttachments<T extends { attachment_path?: string | null; attachment_url?: string | null }>(
  rows: T[]
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (!row.attachment_path) return row;
      const signed = await signedDocumentUrl(row.attachment_path);
      if (!signed) return row;
      return { ...row, attachment_url: signed };
    })
  );
}

/**
 * Creates an enquiry submitted by either a Guest or an authenticated Customer.
 * Optional attachmentBuffer is uploaded to the documents bucket after insert.
 * Pass Idempotency-Key to reject duplicate create on retry/double-click.
 */
export async function createEnquiry(
  formData: unknown,
  customerId?: string | null,
  attachment?: { buffer: Buffer; fileName: string; contentType: string } | null,
  idempotencyKey?: string | null
): Promise<ServerResult<{ enquiryId: string; trackingToken: string }>> {
  return withIdempotency('create_enquiry', idempotencyKey, async () => {
  try {
    const validated = createEnquirySchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const guestName = validated.data.name.trim();
    const guestEmail = validated.data.email.trim().toLowerCase();
    const guestPhone = validated.data.phone.trim();
    const country = validated.data.country?.trim() || null;
    const companyName = validated.data.companyName?.trim() || null;
    const enquiryType =
      validated.data.enquiryType?.trim() ||
      (validated.data.productId ? 'product' : 'contact');
    const { productId, message } = validated.data;
    const lineItems = (validated.data.lineItems || []).map((li) => ({
      product_id: li.productId,
      name: li.name || null,
      quantity: li.quantity,
    }));
    const adminClient = createAdminClient();

    const trackingToken = generateTrackingToken();
    const { data: enquiry, error } = await adminClient
      .from('enquiries')
      .insert({
        customer_id: customerId || null,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        country,
        company_name: companyName,
        enquiry_type: enquiryType,
        product_id: productId || lineItems[0]?.product_id || null,
        message: message.trim(),
        line_items: lineItems.length ? lineItems : null,
        status: 'new',
        tracking_token: trackingToken,
      })
      .select()
      .single();

    if (error || !enquiry) {
      return {
        success: false,
        error: { message: error?.message || 'Failed to submit enquiry', code: 'DATABASE_ERROR' },
      };
    }

    if (attachment?.buffer?.length) {
      const uploaded = await uploadEnquiryDocument(
        enquiry.id,
        attachment.fileName,
        attachment.buffer,
        attachment.contentType
      );
      if (!uploaded.success) {
        await adminClient.from('enquiries').delete().eq('id', enquiry.id);
        return {
          success: false,
          error: uploaded.error,
        };
      }
      await adminClient
        .from('enquiries')
        .update({
          attachment_url: uploaded.data.publicUrl,
          attachment_path: uploaded.data.storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enquiry.id);
    }

    return {
      success: true,
      data: { enquiryId: enquiry.id, trackingToken: enquiry.tracking_token || trackingToken },
    };
  } catch (error) {
    console.error('[createEnquiry] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error submitting enquiry', code: 'INTERNAL_ERROR' },
    };
  }
  });
}

/**
 * Links unassociated guest enquiries to a customer profile when BOTH email and phone match.
 */
export async function linkGuestEnquiries(
  customerId: string,
  email: string,
  phone: string
): Promise<ServerResult<{ linkedCount: number }>> {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('enquiries')
      .update({
        customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .ilike('guest_email', email)
      .is('customer_id', null)
      .select('id');

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: { linkedCount: data ? data.length : 0 },
    };
  } catch (error) {
    console.error('[linkGuestEnquiries] Error:', error);
    return { success: false, error: { message: 'Failed to link guest enquiries', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin updates enquiry status (new -> contacted -> converted_to_order / closed).
 */
export async function updateEnquiryStatus(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updateEnquiryStatusSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { enquiryId, status } = validated.data;
    const adminClient = createAdminClient();

    const allowed = allowedFrom(ENQUIRY_TRANSITIONS, status);
    if (allowed.length === 0) {
      return { success: false, error: { message: 'Invalid enquiry status transition', code: 'INVALID_STATUS' } };
    }

    const result = await transitionStatus(
      adminClient,
      'enquiries',
      enquiryId,
      'status',
      status,
      allowed
    );

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'Enquiry status cannot be changed from its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateEnquiryStatus] Error:', error);
    return { success: false, error: { message: 'Failed to update enquiry status', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin hard deletes an enquiry.
 */
export async function deleteEnquiry(enquiryId: string): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('enquiries').delete().eq('id', enquiryId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteEnquiry] Error:', error);
    return { success: false, error: { message: 'Failed to delete enquiry', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Customer retrieves their own list of enquiries.
 */
export async function getCustomerEnquiries(
  customerId: string,
  options?: { limit?: number; offset?: number }
): Promise<ServerResult<{ enquiries: any[]; total?: number }>> {
  try {
    const adminClient = createAdminClient();
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);

    const { data: enquiries, count, error } = await adminClient
      .from('enquiries')
      .select(`
        id,
        guest_name,
        guest_email,
        guest_phone,
        message,
        status,
        created_at,
        updated_at,
        response_message,
        responded_at,
        attachment_url,
        attachment_path,
        line_items,
        product:products(id, name, selling_price, moq)
      `, { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: { enquiries: await withSignedAttachments(enquiries || []), total: count ?? undefined },
    };
  } catch (error) {
    console.error('[getCustomerEnquiries] Error:', error);
    return { success: false, error: { message: 'Failed to fetch customer enquiries', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Retrieve single enquiry detail with full line items and security checks.
 */
export async function getEnquiryDetail(
  enquiryId: string,
  options?: { customerId?: string; supplierId?: string; isAdmin?: boolean }
): Promise<ServerResult<{ enquiry: any }>> {
  try {
    const adminClient = createAdminClient();
    const { data: enquiry, error } = await adminClient
      .from('enquiries')
      .select(`
        *,
        product:products(id, name, selling_price, moq, supplier_id, category:categories(name)),
        customer:profiles!enquiries_customer_id_fkey(id, full_name, email, phone)
      `)
      .eq('id', enquiryId)
      .maybeSingle();

    if (error || !enquiry) {
      return { success: false, error: { message: 'Enquiry not found', code: 'NOT_FOUND' } };
    }

    if (!options?.isAdmin) {
      if (options?.customerId && enquiry.customer_id !== options.customerId) {
        return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
      }
      if (options?.supplierId && (enquiry as any).product?.supplier_id !== options.supplierId) {
        return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
      }
    }

    const [signedEnquiry] = await withSignedAttachments([enquiry]);
    return { success: true, data: { enquiry: signedEnquiry } };
  } catch (error) {
    console.error('[getEnquiryDetail] Error:', error);
    return { success: false, error: { message: 'Failed to fetch enquiry detail', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin retrieves paginated, searchable, filtered enquiries.
 */
export async function getEnquiriesForAdmin(params: {
  page?: number;
  limit?: number;
  status?: EnquiryStatus;
  search?: string;
}): Promise<ServerResult<{ enquiries: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('enquiries')
      .select(`
        *,
        product:products(id, name, selling_price, moq, category:categories(name)),
        customer:profiles!enquiries_customer_id_fkey(id, full_name, email, phone)
      `, { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.search) {
      const q = sanitizePostgrestSearch(params.search);
      if (q) {
        query = query.or(
          `guest_name.ilike.%${q}%,guest_email.ilike.%${q}%,guest_phone.ilike.%${q}%,message.ilike.%${q}%,company_name.ilike.%${q}%,country.ilike.%${q}%`
        );
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data: enquiries, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: {
        enquiries: await withSignedAttachments(enquiries || []),
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getEnquiriesForAdmin] Error:', error);
    return { success: false, error: { message: 'Failed to fetch enquiries for admin', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin or authorized supplier posts a reply visible to the customer/track page.
 */
export async function respondToEnquiry(
  formData: unknown,
  responderProfileId: string,
  options?: { supplierId?: string }
): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = respondToEnquirySchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { enquiryId, responseMessage, status } = validated.data;
    const adminClient = createAdminClient();

    const { data: enquiry, error: loadError } = await adminClient
      .from('enquiries')
      .select('id, product_id, status, product:products(id, supplier_id)')
      .eq('id', enquiryId)
      .maybeSingle();

    if (loadError || !enquiry) {
      return { success: false, error: { message: 'Enquiry not found', code: 'NOT_FOUND' } };
    }

    if (options?.supplierId) {
      const productSupplierId = (enquiry as any).product?.supplier_id;
      if (!productSupplierId || productSupplierId !== options.supplierId) {
        return {
          success: false,
          error: { message: 'Not authorized to respond to this enquiry', code: 'FORBIDDEN' },
        };
      }
    }

    const nextStatus =
      status ||
      (enquiry.status === 'new' ? 'contacted' : (enquiry.status as EnquiryStatus));

    const responseFields = {
      response_message: responseMessage.trim(),
      responded_at: new Date().toISOString(),
      responded_by: responderProfileId,
    };

    if (nextStatus === enquiry.status) {
      const { error } = await adminClient
        .from('enquiries')
        .update({
          ...responseFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enquiryId)
        .eq('status', enquiry.status);

      if (error) {
        return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
      }

      invalidateAdminCaches();
      return { success: true, data: { updated: true } };
    }

    const allowed = allowedFrom(ENQUIRY_TRANSITIONS, nextStatus);
    if (allowed.length === 0 || !allowed.includes(enquiry.status)) {
      return {
        success: false,
        error: { message: 'Enquiry status cannot be changed from its current state', code: 'INVALID_STATUS' },
      };
    }

    const result = await transitionStatus(
      adminClient,
      'enquiries',
      enquiryId,
      'status',
      nextStatus,
      allowed,
      responseFields
    );

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'Enquiry status cannot be changed from its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[respondToEnquiry] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to respond to enquiry', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin updates stored contact details, message, and line items on an enquiry.
 */
export async function updateEnquiryDetails(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updateEnquiryDetailsSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const {
      enquiryId,
      guestName,
      guestEmail,
      guestPhone,
      country,
      companyName,
      message,
      enquiryType,
      productId,
      lineItems,
    } = validated.data;
    const adminClient = createAdminClient();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (guestName !== undefined) patch.guest_name = guestName.trim();
    if (guestEmail !== undefined) patch.guest_email = guestEmail.trim().toLowerCase();
    if (guestPhone !== undefined) patch.guest_phone = guestPhone.trim();
    if (country !== undefined) patch.country = country.trim();
    if (companyName !== undefined) patch.company_name = companyName ? companyName.trim() : null;
    if (message !== undefined) patch.message = message.trim();
    if (enquiryType !== undefined) patch.enquiry_type = enquiryType.trim();

    if (lineItems !== undefined) {
      const normalizedItems = (lineItems || []).map((li) => ({
        product_id: li.productId || null,
        name: li.name || null,
        quantity: Math.max(1, li.quantity || 1),
      }));
      patch.line_items = normalizedItems.length > 0 ? normalizedItems : null;
      if (productId === undefined) {
        patch.product_id = normalizedItems[0]?.product_id || null;
      }
    }

    if (productId !== undefined) {
      patch.product_id = productId;
    }

    const { data: updatedEnquiry, error } = await adminClient
      .from('enquiries')
      .update(patch as import('@/types/database').Database['public']['Tables']['enquiries']['Update'])
      .eq('id', enquiryId)
      .select('id, customer_id')
      .maybeSingle();

    if (error || !updatedEnquiry) {
      return { success: false, error: { message: error?.message || 'Failed to update enquiry', code: 'DATABASE_ERROR' } };
    }

    invalidateAdminCaches();
    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateEnquiryDetails] Error:', error);
    return { success: false, error: { message: 'Failed to update enquiry details', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Supplier lists enquiries for products they own.
 */
export async function getEnquiriesForSupplier(
  supplierId: string,
  params?: { search?: string; page?: number; limit?: number }
): Promise<ServerResult<{ enquiries: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 25));
    const offset = (page - 1) * limit;

    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id')
      .eq('supplier_id', supplierId);

    if (productsError) {
      return { success: false, error: { message: productsError.message, code: 'DATABASE_ERROR' } };
    }

    const productIds = (products || []).map((p) => p.id);
    if (productIds.length === 0) {
      return { success: true, data: { enquiries: [], total: 0, page, limit } };
    }

    let query = adminClient
      .from('enquiries')
      .select(
        `
        id,
        guest_name,
        guest_email,
        guest_phone,
        message,
        status,
        created_at,
        updated_at,
        response_message,
        responded_at,
        attachment_url,
        attachment_path,
        product:products(id, name, supplier_id)
      `,
        { count: 'exact' }
      )
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (params?.search) {
      const q = sanitizePostgrestSearch(params.search);
      if (q) {
        query = query.or(
          `guest_name.ilike.%${q}%,guest_email.ilike.%${q}%,message.ilike.%${q}%`
        );
      }
    }

    const { data: enquiries, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: {
        enquiries: await withSignedAttachments(enquiries || []),
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getEnquiriesForSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to fetch supplier enquiries', code: 'INTERNAL_ERROR' },
    };
  }
}
