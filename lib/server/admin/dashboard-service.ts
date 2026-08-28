import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export interface AdminDashboardMetrics {
  /** Exact COUNT of actionable queue items (suppliers + product requests + new enquiries + pending RFQs) */
  pendingItemsCount: number;
  pendingSuppliersCount: number;
  totalProducts: number;
  totalSuppliers: number;
  newEnquiriesCount: number;
  pendingRfqsCount: number;
  activeOrdersCount: number;
  productsAwaitingApprovalCount: number;
  /** Always 'live' — metrics come from Postgres COUNT queries, never mock/seed */
  dataSource: 'live';
}

export interface ActivityItem {
  id: string;
  type:
    | 'supplier_registered'
    | 'product_submitted'
    | 'product_update_submitted'
    | 'new_enquiry'
    | 'new_rfq'
    | 'rfq_accepted'
    | 'order_created';
  title: string;
  description: string;
  timestamp: string;
  entityId: string;
}

export type AttentionItemType =
  | 'supplier_registration'
  | 'product_submission'
  | 'price_change'
  | 'enquiry'
  | 'rfq';

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  typeLabel: string;
  entity: string;
  party: string;
  timestamp: string;
  href: string;
  status: 'pending' | 'in_progress';
}

const ACTIVITY_WINDOW_DAYS = 14;

function activitySinceIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ACTIVITY_WINDOW_DAYS);
  return d.toISOString();
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

let cachedMetrics: AdminDashboardMetrics | null = null;
let metricsFetchedAt = 0;
const METRICS_TTL_MS = 5_000; // 5 seconds short cache

export function invalidateDashboardMetricsCache(): void {
  cachedMetrics = null;
  metricsFetchedAt = 0;
}

/**
 * Live Admin Dashboard KPIs — each field is an exact Postgres COUNT (head:true).
 * Never returns mock, seed, or placeholder values. Uses short in-memory cache to prevent storming.
 */
export async function getAdminDashboardMetrics(force = false): Promise<ServerResult<AdminDashboardMetrics>> {
  try {
    const now = Date.now();
    if (!force && cachedMetrics && now - metricsFetchedAt < METRICS_TTL_MS) {
      return { success: true, data: cachedMetrics };
    }

    const adminClient = createAdminClient();

    const { data: metricsJson, error: rpcError } = await (adminClient as any).rpc(
      'admin_dashboard_metrics'
    );

    if (!rpcError && metricsJson && typeof metricsJson === 'object') {
      const m = metricsJson as Record<string, number>;
      const pendingSuppliersCount = Number(m.pendingSuppliersCount) || 0;
      const productsAwaitingApprovalCount = Number(m.productsAwaitingApprovalCount) || 0;
      const newEnquiriesCount = Number(m.newEnquiriesCount) || 0;
      const pendingRfqsCount = Number(m.pendingRfqsCount) || 0;

      const data: AdminDashboardMetrics = {
        pendingItemsCount:
          pendingSuppliersCount + productsAwaitingApprovalCount + newEnquiriesCount + pendingRfqsCount,
        pendingSuppliersCount,
        totalProducts: Number(m.totalProducts) || 0,
        totalSuppliers: Number(m.totalSuppliers) || 0,
        newEnquiriesCount,
        pendingRfqsCount,
        activeOrdersCount: Number(m.activeOrdersCount) || 0,
        productsAwaitingApprovalCount,
        dataSource: 'live',
      };

      cachedMetrics = data;
      metricsFetchedAt = now;

      return { success: true, data };
    }

    const [
      totalProducts,
      totalSuppliers,
      newEnquiriesCount,
      pendingRfqsCount,
      activeOrdersCount,
      productsAwaitingApprovalCount,
      pendingSuppliersCount,
    ] = await Promise.all([
      exactCount(
        adminClient
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('archive_status', 'active')
      ),
      exactCount(
        adminClient
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'archived')
      ),
      exactCount(
        adminClient.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new')
      ),
      exactCount(
        adminClient
          .from('rfqs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'under_review'])
      ),
      exactCount(
        adminClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['accepted', 'packing'])
      ),
      exactCount(
        adminClient
          .from('product_approval_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'update_pending'])
      ),
      exactCount(
        adminClient
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ),
    ]);

    const pendingItemsCount =
      pendingSuppliersCount +
      productsAwaitingApprovalCount +
      newEnquiriesCount +
      pendingRfqsCount;

    const data: AdminDashboardMetrics = {
      pendingItemsCount,
      pendingSuppliersCount,
      totalProducts,
      totalSuppliers,
      newEnquiriesCount,
      pendingRfqsCount,
      activeOrdersCount,
      productsAwaitingApprovalCount,
      dataSource: 'live',
    };

    cachedMetrics = data;
    metricsFetchedAt = now;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[getAdminDashboardMetrics] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to calculate dashboard metrics', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Recent Activity — live rows from domain tables within the last N days only.
 * Titles reflect real status (no “New Product Submitted” for already-approved requests).
 */
export async function getAdminRecentActivity(limit = 20): Promise<ServerResult<{ activity: ActivityItem[] }>> {
  try {
    const adminClient = createAdminClient();
    const since = activitySinceIso();
    const perSource = Math.min(8, Math.max(3, limit));
    const feed: ActivityItem[] = [];

    const [recentSuppliers, recentRequests, recentEnquiries, recentRfqs, recentOrders] =
      await Promise.all([
        adminClient
          .from('suppliers')
          .select('id, company_name, contact_person, status, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(perSource),
        adminClient
          .from('product_approval_requests')
          .select(
            `
            id,
            request_type,
            status,
            created_at,
            product:products(id, name, supplier:suppliers(company_name))
          `
          )
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(perSource),
        adminClient
          .from('enquiries')
          .select('id, guest_name, status, created_at, product:products(name)')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(perSource),
        adminClient
          .from('rfqs')
          .select('id, rfq_number, original_total, status, created_at, customer:profiles(full_name)')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(perSource),
        adminClient
          .from('orders')
          .select('id, order_number, total, status, created_at, customer:profiles(full_name)')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(perSource),
      ]);

    if (recentSuppliers.error) throw new Error(recentSuppliers.error.message);
    if (recentRequests.error) throw new Error(recentRequests.error.message);
    if (recentEnquiries.error) throw new Error(recentEnquiries.error.message);
    if (recentRfqs.error) throw new Error(recentRfqs.error.message);
    if (recentOrders.error) throw new Error(recentOrders.error.message);

    for (const s of recentSuppliers.data || []) {
      const pending = s.status === 'pending';
      feed.push({
        id: `sup-${s.id}`,
        type: 'supplier_registered',
        title: pending ? 'Supplier awaiting approval' : 'Supplier registered',
        description: `${s.company_name} (${s.contact_person || '—'}) · ${s.status}`,
        timestamp: s.created_at,
        entityId: s.id,
      });
    }

    for (const r of recentRequests.data || []) {
      const prod = r.product as { id?: string; name?: string; supplier?: { company_name?: string } } | null;
      const isUpdate = r.request_type === 'update';
      const stillOpen = r.status === 'pending' || r.status === 'update_pending';
      feed.push({
        id: `par-${r.id}`,
        type: isUpdate ? 'product_update_submitted' : 'product_submitted',
        title: stillOpen
          ? isUpdate
            ? 'Product update awaiting review'
            : 'Product awaiting approval'
          : isUpdate
            ? 'Product update processed'
            : 'Product submission processed',
        description: `${prod?.name || 'Product'} · ${prod?.supplier?.company_name || 'Supplier'} · ${r.status}`,
        timestamp: r.created_at,
        entityId: prod?.id || r.id,
      });
    }

    for (const e of recentEnquiries.data || []) {
      const prodName = (e.product as { name?: string } | null)?.name;
      feed.push({
        id: `enq-${e.id}`,
        type: 'new_enquiry',
        title: e.status === 'new' ? 'New enquiry' : `Enquiry · ${e.status.replace(/_/g, ' ')}`,
        description: `${e.guest_name || 'Guest'} · ${prodName || 'general enquiry'}`,
        timestamp: e.created_at,
        entityId: e.id,
      });
    }

    for (const r of recentRfqs.data || []) {
      const custName = (r.customer as { full_name?: string } | null)?.full_name || 'Buyer';
      const total = Number(r.original_total || 0);
      feed.push({
        id: `rfq-${r.id}`,
        type: r.status === 'accepted' ? 'rfq_accepted' : 'new_rfq',
        title: `RFQ · ${String(r.status).replace(/_/g, ' ')}`,
        description: `${r.rfq_number} · ${custName} · ₹${total.toLocaleString('en-IN')}`,
        timestamp: r.created_at,
        entityId: r.id,
      });
    }

    for (const o of recentOrders.data || []) {
      const custName = (o.customer as { full_name?: string } | null)?.full_name || 'Buyer';
      const total = Number(o.total || 0);
      feed.push({
        id: `ord-${o.id}`,
        type: 'order_created',
        title: `Order · ${String(o.status).replace(/_/g, ' ')}`,
        description: `${o.order_number} · ${custName} · ₹${total.toLocaleString('en-IN')}`,
        timestamp: o.created_at,
        entityId: o.id,
      });
    }

    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      data: { activity: feed.slice(0, limit) },
    };
  } catch (error) {
    console.error('[getAdminRecentActivity] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to retrieve recent activity', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Unified actionable queue — only rows that still need admin action (live filters).
 */
export async function getNeedsAttentionItems(limit = 12): Promise<ServerResult<{ items: AttentionItem[] }>> {
  try {
    const adminClient = createAdminClient();
    const perSource = Math.min(10, Math.max(3, Math.ceil(limit / 2)));
    const items: AttentionItem[] = [];

    const [suppliersRes, newProductsRes, updatesRes, enquiriesRes, rfqsRes] = await Promise.all([
      adminClient
        .from('suppliers')
        .select('id, company_name, contact_person, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(perSource),
      adminClient
        .from('product_approval_requests')
        .select(
          `
          id,
          created_at,
          product:products(id, name, supplier:suppliers(company_name))
        `
        )
        .eq('status', 'pending')
        .eq('request_type', 'new_product')
        .order('created_at', { ascending: false })
        .limit(perSource),
      adminClient
        .from('product_approval_requests')
        .select(
          `
          id,
          created_at,
          product:products(id, name, supplier:suppliers(company_name))
        `
        )
        .eq('status', 'update_pending')
        .eq('request_type', 'update')
        .order('created_at', { ascending: false })
        .limit(perSource),
      adminClient
        .from('enquiries')
        .select('id, guest_name, company_name, created_at, product:products(name)')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(perSource),
      adminClient
        .from('rfqs')
        .select('id, rfq_number, status, created_at, customer:profiles(full_name)')
        .in('status', ['submitted', 'under_review'])
        .order('created_at', { ascending: false })
        .limit(perSource),
    ]);

    for (const res of [suppliersRes, newProductsRes, updatesRes, enquiriesRes, rfqsRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    for (const s of suppliersRes.data || []) {
      items.push({
        id: `attn-sup-${s.id}`,
        type: 'supplier_registration',
        typeLabel: 'Supplier registration',
        entity: s.company_name,
        party: s.contact_person || '—',
        timestamp: s.created_at,
        href: '/admin/approvals',
        status: 'pending',
      });
    }

    for (const r of newProductsRes.data || []) {
      const prod = r.product as {
        name?: string;
        supplier?: { company_name?: string };
      } | null;
      items.push({
        id: `attn-prod-${r.id}`,
        type: 'product_submission',
        typeLabel: 'Product submission',
        entity: prod?.name || 'Untitled product',
        party: prod?.supplier?.company_name || 'Supplier',
        timestamp: r.created_at,
        href: '/admin/approvals',
        status: 'pending',
      });
    }

    for (const r of updatesRes.data || []) {
      const prod = r.product as {
        name?: string;
        supplier?: { company_name?: string };
      } | null;
      items.push({
        id: `attn-upd-${r.id}`,
        type: 'price_change',
        typeLabel: 'Price / catalog change',
        entity: prod?.name || 'Product update',
        party: prod?.supplier?.company_name || 'Supplier',
        timestamp: r.created_at,
        href: '/admin/approvals',
        status: 'pending',
      });
    }

    for (const e of enquiriesRes.data || []) {
      const prodName = (e.product as { name?: string } | null)?.name;
      items.push({
        id: `attn-enq-${e.id}`,
        type: 'enquiry',
        typeLabel: 'Enquiry',
        entity: prodName || 'Product enquiry',
        party: e.company_name || e.guest_name || 'Customer',
        timestamp: e.created_at,
        href: '/admin/enquiries',
        status: 'pending',
      });
    }

    for (const r of rfqsRes.data || []) {
      const customer = r.customer as { full_name?: string } | null;
      items.push({
        id: `attn-rfq-${r.id}`,
        type: 'rfq',
        typeLabel: 'RFQ',
        entity: r.rfq_number,
        party: customer?.full_name || 'Buyer',
        timestamp: r.created_at,
        href: '/admin/rfqs',
        status: r.status === 'under_review' ? 'in_progress' : 'pending',
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      data: { items: items.slice(0, limit) },
    };
  } catch (error) {
    console.error('[getNeedsAttentionItems] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to load attention queue', code: 'INTERNAL_ERROR' },
    };
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

    const [pendingSuppliers, newProductRequests, productUpdateRequests] = await Promise.all([
      exactCount(
        adminClient
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ),
      exactCount(
        adminClient
          .from('product_approval_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('request_type', 'new_product')
      ),
      exactCount(
        adminClient
          .from('product_approval_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'update_pending')
          .eq('request_type', 'update')
      ),
    ]);

    return {
      success: true,
      data: {
        pendingSuppliers,
        newProductRequests,
        productUpdateRequests,
        total: pendingSuppliers + newProductRequests + productUpdateRequests,
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
}): Promise<
  ServerResult<{
    pendingSuppliers: any[];
    newProductRequests: any[];
    productUpdateRequests: any[];
  }>
> {
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
        .select(
          `
          id,
          status,
          request_type,
          proposed_data,
          rejection_reason,
          created_at,
          product:products(
            id,
            name,
            category:categories(name),
            supplier:suppliers(id, company_name, contact_person)
          )
        `
        )
        .eq('status', 'pending')
        .eq('request_type', 'new_product')
        .order('created_at', { ascending: false })
        .limit(limit),
      adminClient
        .from('product_approval_requests')
        .select(
          `
          id,
          status,
          request_type,
          proposed_data,
          rejection_reason,
          created_at,
          product:products(
            id,
            name,
            category:categories(name),
            supplier:suppliers(id, company_name, contact_person)
          )
        `
        )
        .eq('status', 'update_pending')
        .eq('request_type', 'update')
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const queryErrors = [
      pendingSuppliersRes.error,
      newProductRequestsRes.error,
      productUpdateRequestsRes.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      const message = queryErrors.map((e) => e?.message).filter(Boolean).join('; ') || 'Database error';
      return {
        success: false,
        error: { message, code: 'DATABASE_ERROR' },
      };
    }

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
