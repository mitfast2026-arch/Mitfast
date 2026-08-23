import { NextResponse, type NextRequest } from 'next/server';
import {
  getStorefrontProductDetail,
  getProductForAdminDetail,
  adminDirectUpdateProduct,
  deleteProduct,
} from '@/lib/server/products/product-service';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const mode = new URL(request.url).searchParams.get('mode');

    if (mode === 'admin') {
      const auth = await requireAdmin();
      if (!auth.ok) return auth.response;
      const result = await getProductForAdminDetail(productId);
      if (!result.success) {
        return NextResponse.json(result, { status: result.error.code === 'NOT_FOUND' ? 404 : 400 });
      }
      return NextResponse.json(result);
    }

    const result = await getStorefrontProductDetail(productId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await adminDirectUpdateProduct({
      productId: params.id,
      ...body,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    deferRevalidateProduct(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await deleteProduct(params.id);
    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND'
          ? 404
          : result.error.code === 'PUBLISHED'
            ? 409
            : 400;
      return NextResponse.json(result, { status });
    }

    deferRevalidateProduct(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
