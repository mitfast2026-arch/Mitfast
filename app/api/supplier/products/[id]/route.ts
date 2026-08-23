import { NextResponse, type NextRequest } from 'next/server';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const adminClient = createAdminClient();

    const { data: product, error } = await adminClient
      .from('products')
      .select(
        `
        *,
        category:categories(id, name),
        supplier:suppliers(id, company_name, country, status),
        images:product_images(id, image_url, sort_order, is_primary),
        specifications:product_specifications(id, spec_name, spec_value, sort_order)
      `
      )
      .eq('id', params.id)
      .eq('supplier_id', supplierId)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const { data: pendingRequest } = await adminClient
      .from('product_approval_requests')
      .select('id, request_type, status, proposed_data, created_at, reviewed_at, rejection_reason')
      .eq('product_id', params.id)
      .in('status', ['pending', 'update_pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        product: {
          ...product,
          pendingRequest: pendingRequest ?? null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
