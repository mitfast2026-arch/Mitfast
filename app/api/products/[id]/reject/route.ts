import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rejectProduct } from '@/lib/server/products/product-service';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const rejectionReason = body.rejectionReason || body.reason;

    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: { message: 'Rejection reason is required (minimum 3 characters)', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const targetId = params.id;

    // Check if targetId is an approval request ID
    const { data: req } = await adminClient
      .from('product_approval_requests')
      .select('id, product_id')
      .eq('id', targetId)
      .maybeSingle();

    if (req) {
      const result = await rejectProduct({ requestId: req.id, rejectionReason });
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
      const result = await rejectProduct({ requestId: latestPendingReq.id, rejectionReason });
      if (!result.success) return NextResponse.json(result, { status: 400 });
      deferRevalidateProduct(targetId);
      return NextResponse.json(result);
    }

    // Otherwise reject product directly in database
    const { data: prod, error: prodErr } = await adminClient
      .from('products')
      .select('id')
      .eq('id', targetId)
      .single();

    if (prodErr || !prod) {
      return NextResponse.json(
        { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const { error: updateErr } = await adminClient
      .from('products')
      .update({
        approval_status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: { message: updateErr.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    deferRevalidateProduct(targetId);
    return NextResponse.json({ success: true, data: { rejected: true } });
  } catch (error) {
    console.error('[POST /api/products/[id]/reject] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
