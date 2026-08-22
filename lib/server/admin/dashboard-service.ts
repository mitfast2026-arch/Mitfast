import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export interface AdminDashboardMetrics {
  totalProducts: number;
  totalSuppliers: number;
  newEnquiriesCount: number;
  pendingRfqsCount: number;
  activeOrdersCount: number;
  productsAwaitingApprovalCount: number;
}

export interface ActivityItem {
  id: string;
  type: 'supplier_registered' | 'product_submitted' | 'product_update_submitted' | 'new_enquiry' | 'new_rfq' | 'rfq_accepted' | 'order_created';
  title: string;
  description: string;
  timestamp: string;
  entityId: string;
}

/**
 * Calculates high-level Admin Dashboard summary cards.
 */
export async function getAdminDashboardMetrics(): Promise<ServerResult<AdminDashboardMetrics>> {
  try {
    const adminClient = createAdminClient();

    // 1. Total Products
    const { count: totalProducts } = await adminClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('archive_status', 'active');

    // 2. Total Suppliers
    const { count: totalSuppliers } = await adminClient
      .from('suppliers')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived');

    // 3. New Enquiries
    const { count: newEnquiriesCount } = await adminClient
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    // 4. Pending RFQs (submitted or under_review)
    const { count: pendingRfqsCount } = await adminClient
      .from('rfqs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review']);

    // 5. Active Orders (accepted or packing)
    const { count: activeOrdersCount } = await adminClient
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['accepted', 'packing']);

    // 6. Products Awaiting Approval (pending or update_pending)
    const { count: productsAwaitingApprovalCount } = await adminClient
      .from('product_approval_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'update_pending']);

    return {
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        totalSuppliers: totalSuppliers || 0,
        newEnquiriesCount: newEnquiriesCount || 0,
        pendingRfqsCount: pendingRfqsCount || 0,
        activeOrdersCount: activeOrdersCount || 0,
        productsAwaitingApprovalCount: productsAwaitingApprovalCount || 0,
      },
    };
  } catch (error) {
    console.error('[getAdminDashboardMetrics] Error:', error);
    return { success: false, error: { message: 'Failed to calculate dashboard metrics', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Generates Recent Activity feed via dynamic query union across primary domain tables.
 */
export async function getAdminRecentActivity(limit = 20): Promise<ServerResult<{ activity: ActivityItem[] }>> {
  try {
    const adminClient = createAdminClient();
    const feed: ActivityItem[] = [];

    // 1. Recent Suppliers
    const { data: recentSuppliers } = await adminClient
      .from('suppliers')
      .select('id, company_name, contact_person, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentSuppliers) {
      for (const s of recentSuppliers) {
        feed.push({
          id: `sup-${s.id}`,
          type: 'supplier_registered',
          title: 'New Supplier Registered',
          description: `${s.company_name} (${s.contact_person}) registered on the platform`,
          timestamp: s.created_at,
          entityId: s.id,
        });
      }
    }

    // 2. Recent Product Approval Requests
    const { data: recentRequests } = await adminClient
      .from('product_approval_requests')
      .select(`
        id,
        request_type,
        created_at,
        product:products(id, name, supplier:suppliers(company_name))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentRequests) {
      for (const r of recentRequests) {
        const prod = r.product as any;
        const isUpdate = r.request_type === 'update';
        feed.push({
          id: `par-${r.id}`,
          type: isUpdate ? 'product_update_submitted' : 'product_submitted',
          title: isUpdate ? 'Product Update Submitted' : 'New Product Submitted',
          description: `${prod?.name || 'Product'} submitted by ${prod?.supplier?.company_name || 'Supplier'}`,
          timestamp: r.created_at,
          entityId: prod?.id || r.id,
        });
      }
    }

    // 3. Recent Enquiries
    const { data: recentEnquiries } = await adminClient
      .from('enquiries')
      .select('id, guest_name, created_at, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentEnquiries) {
      for (const e of recentEnquiries) {
        const prodName = (e.product as any)?.name;
        feed.push({
          id: `enq-${e.id}`,
          type: 'new_enquiry',
          title: 'New Product Enquiry',
          description: `${e.guest_name} enquired about ${prodName || 'a product'}`,
          timestamp: e.created_at,
          entityId: e.id,
        });
      }
    }

    // 4. Recent RFQs
    const { data: recentRfqs } = await adminClient
      .from('rfqs')
      .select('id, rfq_number, original_total, status, created_at, customer:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentRfqs) {
      for (const r of recentRfqs) {
        const custName = (r.customer as any)?.full_name || 'Buyer';
        feed.push({
          id: `rfq-${r.id}`,
          type: 'new_rfq',
          title: 'New RFQ Created',
          description: `${r.rfq_number} created by ${custName} (₹${r.original_total.toLocaleString('en-IN')})`,
          timestamp: r.created_at,
          entityId: r.id,
        });
      }
    }

    // 5. Recent Orders
    const { data: recentOrders } = await adminClient
      .from('orders')
      .select('id, order_number, total, created_at, customer:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentOrders) {
      for (const o of recentOrders) {
        const custName = (o.customer as any)?.full_name || 'Buyer';
        feed.push({
          id: `ord-${o.id}`,
          type: 'order_created',
          title: 'Order Confirmed',
          description: `${o.order_number} confirmed for ${custName} (₹${o.total.toLocaleString('en-IN')})`,
          timestamp: o.created_at,
          entityId: o.id,
        });
      }
    }

    // Sort combined feed by timestamp descending
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      data: {
        activity: feed.slice(0, limit),
      },
    };
  } catch (error) {
    console.error('[getAdminRecentActivity] Error:', error);
    return { success: false, error: { message: 'Failed to retrieve recent activity', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Lightweight counts for admin nav badge (3 head queries, no joins).
 */
export async function getApprovalCenterCounts(): Promise<
  ServerResult<{
    pendingSuppliers: number;
    newProductRequests: number;
    productUpdateRequests: number;
    total: number;
  }>
> {
  try {
    const adminClient = createAdminClient();

    const [
      { count: pendingSuppliers },
      { count: newProductRequests },
      { count: productUpdateRequests },
    ] = await Promise.all([
      adminClient
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      adminClient
        .from('product_approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('request_type', 'new_product'),
      adminClient
        .from('product_approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'update_pending')
        .eq('request_type', 'update'),
    ]);

    const ps = pendingSuppliers || 0;
    const np = newProductRequests || 0;
    const pu = productUpdateRequests || 0;

    return {
      success: true,
      data: {
        pendingSuppliers: ps,
        newProductRequests: np,
        productUpdateRequests: pu,
        total: ps + np + pu,
      },
    };
  } catch (error) {
    console.error('[getApprovalCenterCounts] Error:', error);
    return { success: false, error: { message: 'Failed to load approval counts', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Unified Approval Center queries (Suppliers, New Products, Product Updates).
 */
export async function getApprovalCenterItems(params?: {
  limit?: number;
}): Promise<ServerResult<{
  pendingSuppliers: any[];
  newProductRequests: any[];
  productUpdateRequests: any[];
}>> {
  try {
    const adminClient = createAdminClient();
    const limit = Math.min(100, Math.max(1, params?.limit ?? 25));

    const [pendingSuppliersRes, newProductRequestsRes, productUpdateRequestsRes] = await Promise.all([
      adminClient
        .from('suppliers')
        .select('id, company_name, contact_person, email, phone, country, address, created_at, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit),
      adminClient
        .from('product_approval_requests')
        .select(`
          id,
          status,
          request_type,
          created_at,
          product:products(
            id,
            name,
            category:categories(name),
            supplier:suppliers(id, company_name, contact_person)
          )
        `)
        .eq('status', 'pending')
        .eq('request_type', 'new_product')
        .order('created_at', { ascending: false })
        .limit(limit),
      adminClient
        .from('product_approval_requests')
        .select(`
          id,
          status,
          request_type,
          created_at,
          product:products(
            id,
            name,
            category:categories(name),
            supplier:suppliers(id, company_name, contact_person)
          )
        `)
        .eq('status', 'update_pending')
        .eq('request_type', 'update')
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    return {
      success: true,
      data: {
        pendingSuppliers: pendingSuppliersRes.data || [],
        newProductRequests: newProductRequestsRes.data || [],
        productUpdateRequests: productUpdateRequestsRes.data || [],
      },
    };
  } catch (error) {
    console.error('[getApprovalCenterItems] Error:', error);
    return { success: false, error: { message: 'Failed to load approval center items', code: 'INTERNAL_ERROR' } };
  }
}
