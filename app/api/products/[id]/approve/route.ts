import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveProduct } from '@/lib/server/products/product-service';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const targetId = params.id;

    // Check if targetId is an approval request ID
    const { data: req } = await adminClient
      .from('product_approval_requests')
      .select('id, product_id')
      .eq('id', targetId)
      .maybeSingle();

    if (req) {
      const result = await approveProduct(req.id);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      deferRevalidateProduct(req.product_id);
      return NextResponse.json(result);
    }

    // Check if targetId is a direct product ID with a pending request
    const { data: latestPendingReq } = await adminClient
      .from('product_approval_requests')
      .select('id')
      .eq('product_id', targetId)
      .in('status', ['pending', 'update_pending'])
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (latestPendingReq) {
      const result = await approveProduct(latestPendingReq.id);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      deferRevalidateProduct(targetId);
      return NextResponse.json(result);
    }

    // Fail closed — approval must go through an open request with proposed_data.
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'No open approval request found for this product',
          code: 'NO_OPEN_REQUEST',
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/products/[id]/approve] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
