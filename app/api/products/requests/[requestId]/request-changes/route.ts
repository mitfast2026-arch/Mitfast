import { NextResponse, type NextRequest } from 'next/server';
import { requestProductChanges } from '@/lib/server/products/product-service';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function POST(request: NextRequest, props: { params: Promise<{ requestId: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const { data: reqRow } = await createAdminClient()
      .from('product_approval_requests')
      .select('product_id')
      .eq('id', params.requestId)
      .maybeSingle();

    const result = await requestProductChanges(
      {
        requestId: params.requestId,
        reviewNote: body.reviewNote || body.rejectionReason,
      },
      body.adminUserId
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    deferRevalidateProduct(reqRow?.product_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
