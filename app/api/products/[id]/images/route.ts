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
import { syncPendingApprovalImageUrls } from '@/lib/server/products/product-service';
import { withIdempotency } from '@/lib/server/db/idempotency';
import { assertRateLimit, rateLimitedResponse } from '@/lib/server/db/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

function statusForError(code?: string): number {
  switch (code) {
    case 'RATE_LIMITED':
      return 429;
    case 'IDEMPOTENCY_IN_PROGRESS':
    case 'CONCURRENT_UPDATE':
      return 409;
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
    case 'PUBLISHED_PRODUCT_LOCKED':
      return 403;
    case 'DATABASE_MISCONFIGURED':
      return 503;
    default:
      return 400;
  }
}

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

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    if (auth.actor.role === 'supplier' && auth.actor.supplierId) {
      const limited = await assertRateLimit({
        scope: 'supplier_image_upload',
        key: `supplier:${auth.actor.supplierId}`,
        windowSeconds: 60,
        maxHits: 120,
      });
      if (!limited.ok) {
        return NextResponse.json(rateLimitedResponse('Too many image uploads'), {
          status: 429,
          headers: { 'Retry-After': '60' },
        });
      }
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: 'A file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    // Align with Vercel ~4.5 MB body limit
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Image exceeds 4 MB upload limit (compress or use WebP)',
            code: 'VALIDATION_ERROR',
          },
        },
        { status: 400 }
      );
    }

    const isPrimaryRaw = formData.get('isPrimary');
    const isPrimary = isPrimaryRaw === 'true' || isPrimaryRaw === '1';
    const uploadId =
      request.headers.get('X-Upload-Id') ||
      (typeof formData.get('uploadId') === 'string' ? (formData.get('uploadId') as string) : null);
    const idempotencyKey = uploadId ? `${params.id}:${uploadId}` : request.headers.get('Idempotency-Key');

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await withIdempotency('upload_product_image', idempotencyKey, () =>
      addProductImage(
        params.id,
        {
          buffer,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          isPrimary: isPrimary || undefined,
        },
        auth.actor
      )
    );

    if (!result.success) {
      return NextResponse.json(result, { status: statusForError(result.error?.code) });
    }

    deferRevalidateProduct(params.id);
    await syncPendingApprovalImageUrls(params.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    if (auth.actor.role === 'supplier' && auth.actor.supplierId) {
      const limited = await assertRateLimit({
        scope: 'supplier_image_mutate',
        key: `supplier:${auth.actor.supplierId}`,
        windowSeconds: 60,
        maxHits: 60,
      });
      if (!limited.ok) {
        return NextResponse.json(rateLimitedResponse('Too many image mutations'), {
          status: 429,
          headers: { 'Retry-After': '60' },
        });
      }
    }

    const imageId = new URL(request.url).searchParams.get('imageId');
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: { message: 'imageId query parameter is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await deleteProductImage(params.id, imageId, auth.actor);

    if (!result.success) {
      return NextResponse.json(result, { status: statusForError(result.error?.code) });
    }

    deferRevalidateProduct(params.id);
    await syncPendingApprovalImageUrls(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdminOrProductOwner(params.id);
    if (!auth.ok) return auth.response;

    if (auth.actor.role === 'supplier' && auth.actor.supplierId) {
      const limited = await assertRateLimit({
        scope: 'supplier_image_mutate',
        key: `supplier:${auth.actor.supplierId}`,
        windowSeconds: 60,
        maxHits: 60,
      });
      if (!limited.ok) {
        return NextResponse.json(rateLimitedResponse('Too many image mutations'), {
          status: 429,
          headers: { 'Retry-After': '60' },
        });
      }
    }

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
      return NextResponse.json(result, { status: statusForError(result.error?.code) });
    }

    deferRevalidateProduct(params.id);
    await syncPendingApprovalImageUrls(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
