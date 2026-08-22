import { createAdminClient } from '@/lib/supabase/admin';
import {
  createSupplierByAdminSchema,
  rejectSupplierSchema,
  restoreSupplierSchema,
  updateSupplierProfileSchema,
} from '@/lib/validation/supplier.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { SupplierStatus } from '@/types/database';

/**
 * Admin creates a supplier directly (bypasses approval queue, status = 'active').
 */
export async function createSupplierByAdmin(formData: unknown): Promise<ServerResult<{ supplierId: string }>> {
  try {
    const validated = createSupplierByAdminSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { companyName, contactPerson, email, phone, address, country, website } = validated.data;
    const adminClient = createAdminClient();

    const { data: supplier, error } = await adminClient
      .from('suppliers')
      .insert({
        company_name: companyName,
        contact_person: contactPerson,
        email,
        phone,
        address: address || null,
        country,
        website: website || null,
        status: 'active',
      })
      .select()
      .single();

    if (error || !supplier) {
      return {
        success: false,
        error: { message: error?.message || 'Failed to create supplier', code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { supplierId: supplier.id },
    };
  } catch (error) {
    console.error('[createSupplierByAdmin] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error creating supplier', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin approves a pending supplier registration.
 */
export async function approveSupplier(supplierId: string): Promise<ServerResult<{ approved: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('suppliers')
      .update({
        status: 'active',
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supplierId);

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { approved: true },
    };
  } catch (error) {
    console.error('[approveSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to approve supplier', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin rejects a pending supplier registration (requires reason).
 */
export async function rejectSupplier(formData: unknown): Promise<ServerResult<{ rejected: boolean }>> {
  try {
    const validated = rejectSupplierSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { supplierId, rejectionReason } = validated.data;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('suppliers')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supplierId);

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { rejected: true },
    };
  } catch (error) {
    console.error('[rejectSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to reject supplier', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin archives a supplier.
 * Reversible: archives supplier and its products while preserving historical orders/RFQs.
 */
export async function archiveSupplier(supplierId: string): Promise<ServerResult<{ archived: boolean }>> {
  try {
    const adminClient = createAdminClient();

    // 1. Mark supplier as archived
    const { error: supplierError } = await adminClient
      .from('suppliers')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', supplierId);

    if (supplierError) {
      return {
        success: false,
        error: { message: supplierError.message, code: 'DATABASE_ERROR' },
      };
    }

    // 2. Archive all active products belonging to this supplier, saving their current publication state
    const { data: supplierProducts } = await adminClient
      .from('products')
      .select('id, publication_status')
      .eq('supplier_id', supplierId)
      .eq('archive_status', 'active');

    if (supplierProducts && supplierProducts.length > 0) {
      for (const prod of supplierProducts) {
        await adminClient
          .from('products')
          .update({
            archive_status: 'archived',
            pre_archive_publication_status: prod.publication_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prod.id);
      }
    }

    return {
      success: true,
      data: { archived: true },
    };
  } catch (error) {
    console.error('[archiveSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to archive supplier', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin restores an archived supplier.
 * Restores supplier to active and allows restoring selected or all products back to their previous publication states.
 */
export async function restoreSupplier(formData: unknown): Promise<ServerResult<{ restored: boolean }>> {
  try {
    const validated = restoreSupplierSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { supplierId, restoreAllProducts, selectedProductIds } = validated.data;
    const adminClient = createAdminClient();

    // 1. Mark supplier as active
    const { error: supplierError } = await adminClient
      .from('suppliers')
      .update({
        status: 'active',
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supplierId);

    if (supplierError) {
      return {
        success: false,
        error: { message: supplierError.message, code: 'DATABASE_ERROR' },
      };
    }

    // 2. Fetch archived products of this supplier
    let query = adminClient
      .from('products')
      .select('id, pre_archive_publication_status')
      .eq('supplier_id', supplierId)
      .eq('archive_status', 'archived');

    if (!restoreAllProducts && selectedProductIds && selectedProductIds.length > 0) {
      query = query.in('id', selectedProductIds);
    }

    const { data: productsToRestore } = await query;

    if (productsToRestore && productsToRestore.length > 0) {
      for (const prod of productsToRestore) {
        const restoredPubStatus = prod.pre_archive_publication_status || 'unpublished';
        await adminClient
          .from('products')
          .update({
            archive_status: 'active',
            publication_status: restoredPubStatus,
            pre_archive_publication_status: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prod.id);
      }
    }

    return {
      success: true,
      data: { restored: true },
    };
  } catch (error) {
    console.error('[restoreSupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to restore supplier', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Fetches aggregate demand statistics for a supplier's products.
 * Strict privacy: zero customer PII, zero pricing breakdown.
 */
export async function getSupplierProductStats(supplierId: string): Promise<ServerResult<{
  summary: { totalViews: number; totalEnquiries: number; totalRfqs: number; totalOrders: number };
  products: Array<{
    productId: string;
    productName: string;
    views: number;
    enquiries: number;
    rfqs: number;
    orders: number;
  }>;
}>> {
  try {
    const adminClient = createAdminClient();

    const { data: rows, error } = await (adminClient as any).rpc('supplier_product_demand_stats', {
      p_supplier_id: supplierId,
    });

    if (error) {
      // Fallback if migration not yet applied
      return getSupplierProductStatsLegacy(supplierId);
    }

    type ProductStatRow = {
      productId: string;
      productName: string;
      views: number;
      enquiries: number;
      rfqs: number;
      orders: number;
    };

    const productStats: ProductStatRow[] = (rows || []).map((row: any) => ({
      productId: row.product_id,
      productName: row.product_name,
      views: Number(row.views) || 0,
      enquiries: Number(row.enquiries) || 0,
      rfqs: Number(row.rfqs) || 0,
      orders: Number(row.orders) || 0,
    }));

    const summary = productStats.reduce(
      (acc: { totalViews: number; totalEnquiries: number; totalRfqs: number; totalOrders: number }, p) => ({
        totalViews: acc.totalViews + p.views,
        totalEnquiries: acc.totalEnquiries + p.enquiries,
        totalRfqs: acc.totalRfqs + p.rfqs,
        totalOrders: acc.totalOrders + p.orders,
      }),
      { totalViews: 0, totalEnquiries: 0, totalRfqs: 0, totalOrders: 0 }
    );

    return {
      success: true,
      data: { summary, products: productStats },
    };
  } catch (error) {
    console.error('[getSupplierProductStats] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to calculate supplier statistics', code: 'INTERNAL_ERROR' },
    };
  }
}

async function getSupplierProductStatsLegacy(supplierId: string): Promise<ServerResult<{
  summary: { totalViews: number; totalEnquiries: number; totalRfqs: number; totalOrders: number };
  products: Array<{
    productId: string;
    productName: string;
    views: number;
    enquiries: number;
    rfqs: number;
    orders: number;
  }>;
}>> {
  try {
    const adminClient = createAdminClient();

    const { data: products, error: prodError } = await adminClient
      .from('products')
      .select('id, name, view_count')
      .eq('supplier_id', supplierId);

    if (prodError || !products) {
      return {
        success: false,
        error: { message: 'Failed to fetch supplier products', code: 'DATABASE_ERROR' },
      };
    }

    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) {
      return {
        success: true,
        data: {
          summary: { totalViews: 0, totalEnquiries: 0, totalRfqs: 0, totalOrders: 0 },
          products: [],
        },
      };
    }

    const [enquiryRows, rfqRows, orderRows] = await Promise.all([
      adminClient.from('enquiries').select('product_id').in('product_id', productIds),
      adminClient.from('rfq_items').select('product_id').in('product_id', productIds),
      adminClient.from('order_items').select('product_id').in('product_id', productIds),
    ]);

    const countBy = (rows: { product_id: string }[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows || []) {
        map.set(row.product_id, (map.get(row.product_id) || 0) + 1);
      }
      return map;
    };

    const enquiryMap = countBy(enquiryRows.data as { product_id: string }[] | null);
    const rfqMap = countBy(rfqRows.data as { product_id: string }[] | null);
    const orderMap = countBy(orderRows.data as { product_id: string }[] | null);

    const productStats = products.map((p) => ({
      productId: p.id,
      productName: p.name,
      views: p.view_count || 0,
      enquiries: enquiryMap.get(p.id) || 0,
      rfqs: rfqMap.get(p.id) || 0,
      orders: orderMap.get(p.id) || 0,
    }));

    const summary = productStats.reduce(
      (acc: { totalViews: number; totalEnquiries: number; totalRfqs: number; totalOrders: number }, p) => ({
        totalViews: acc.totalViews + p.views,
        totalEnquiries: acc.totalEnquiries + p.enquiries,
        totalRfqs: acc.totalRfqs + p.rfqs,
        totalOrders: acc.totalOrders + p.orders,
      }),
      { totalViews: 0, totalEnquiries: 0, totalRfqs: 0, totalOrders: 0 }
    );

    return { success: true, data: { summary, products: productStats } };
  } catch (error) {
    console.error('[getSupplierProductStatsLegacy] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to calculate supplier statistics', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin: list and search suppliers with pagination and filtering.
 */
export async function getSuppliersForAdmin(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupplierStatus;
  country?: string;
  sortBy?: 'created_at_desc' | 'created_at_asc' | 'company_name_asc' | 'company_name_desc';
}): Promise<ServerResult<{ suppliers: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient.from('suppliers').select('*', { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.country) {
      query = query.eq('country', params.country);
    }

    if (params.search) {
      query = query.or(`company_name.ilike.%${params.search}%,contact_person.ilike.%${params.search}%,email.ilike.%${params.search}%`);
    }

    switch (params.sortBy) {
      case 'created_at_asc':
        query = query.order('created_at', { ascending: true });
        break;
      case 'company_name_asc':
        query = query.order('company_name', { ascending: true });
        break;
      case 'company_name_desc':
        query = query.order('company_name', { ascending: false });
        break;
      case 'created_at_desc':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data: suppliers, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: {
        suppliers: suppliers || [],
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getSuppliersForAdmin] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to fetch suppliers', code: 'INTERNAL_ERROR' },
    };
  }
}
