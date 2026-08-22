import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getServerSession,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/server/auth/get-session';
import {
  addProductImage,
  deleteProductImage,
  reorderProductImages,
  type ProductImageActor,
} from '@/lib/server/products/product-image-service';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

async function requireAdminOrProductOwner(productId: string): Promise<
  | { ok: true; actor: ProductImageActor }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) return { ok: false, response: unauthorizedResponse() };

  if (session.profile.role === 'admin') {
    return { ok: true, actor: { role: 'admin' } };
  }

  if (session.profile.role === 'supplier' && session.supplier?.status === 'active') {
    const { data: product } = await createAdminClient()
      .from('products')
      .select('supplier_id')
      .eq('id', productId)
      .maybeSingle();

    if (product && product.supplier_id === session.supplier.id) {
      return { ok: true, actor: { role: 'supplier', supplierId: session.supplier.id } };
    }
  }

  return { ok: false, response: forbiddenResponse() };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: 'A file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const isPrimaryRaw = formData.get('isPrimary');
    const isPrimary = isPrimaryRaw === 'true' || isPrimaryRaw === '1';

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await addProductImage(
      params.id,
      {
        buffer,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        isPrimary: isPrimary || undefined,
      },
      auth.actor
    );

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    deferRevalidateProduct(params.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    const imageId = new URL(request.url).searchParams.get('imageId');
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: { message: 'imageId query parameter is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await deleteProductImage(params.id, imageId, auth.actor);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const orderedImageIds = body.orderedImageIds;

    if (!Array.isArray(orderedImageIds) || orderedImageIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json(
        { success: false, error: { message: 'orderedImageIds must be an array of strings', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await reorderProductImages(params.id, orderedImageIds, auth.actor);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
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
