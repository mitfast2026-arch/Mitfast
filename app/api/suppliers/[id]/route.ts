import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  allowedFrom,
  SUPPLIER_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const supabase = createAdminClient();
    const { id } = params;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const offset = (page - 1) * limit;

    const [supplierResult, productsResult] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase
        .from('products')
        .select('id, name, supplier_price, moq, approval_status, category_id, category:categories(id, name)', { count: 'exact' })
        .eq('supplier_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    const { data: supplier, error: supError } = supplierResult;
    if (supError || !supplier) {
      return NextResponse.json(
        { success: false, error: { message: 'Supplier not found' } },
        { status: 404 }
      );
    }

    const products = productsResult.data;

    return NextResponse.json({
      success: true,
      data: {
        supplier,
        products: products || [],
        total: productsResult.count ?? (products?.length || 0),
        page,
        limit,
      }
    });
  } catch (err: any) {
    console.error('Supplier GET [id] error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const supabase = createAdminClient();
    const { id } = params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.companyName !== undefined) updatePayload.company_name = body.companyName;
    if (body.contactPerson !== undefined) updatePayload.contact_person = body.contactPerson;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.country !== undefined) updatePayload.country = body.country;
    if (body.website !== undefined) updatePayload.website = body.website;
    if (body.website !== undefined) updatePayload.website = body.website;

    if (body.status !== undefined) {
      const newStatus = body.status as string;
      const allowed = allowedFrom(SUPPLIER_TRANSITIONS, newStatus);
      if (allowed.length === 0) {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid supplier status transition', code: 'INVALID_STATUS' } },
          { status: 400 }
        );
      }
      const tr = await transitionStatus(
        supabase,
        'suppliers',
        id,
        'status',
        newStatus,
        allowed,
        newStatus === 'archived' ? { archived_at: new Date().toISOString() } : newStatus === 'active' ? { archived_at: null } : {}
      );
      if (!tr.ok) {
        return NextResponse.json(
          { success: false, error: { message: 'Supplier status cannot be changed from its current state', code: 'INVALID_STATUS' } },
          { status: 409 }
        );
      }
      invalidateAdminCaches();
      return NextResponse.json({ success: true, data: { supplier: tr.row } });
    }

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(updatePayload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { supplier: updated }
    });
  } catch (err: any) {
    console.error('Supplier PUT [id] error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
