import { NextResponse, type NextRequest } from 'next/server';
import { publishProduct } from '@/lib/server/products/product-service';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await publishProduct(params.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    deferRevalidateProduct(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
