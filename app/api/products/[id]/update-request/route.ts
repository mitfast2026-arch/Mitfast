import { NextResponse, type NextRequest } from 'next/server';
import { submitProductUpdateBySupplier } from '@/lib/server/products/product-service';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const supplierId = auth.session.supplier!.id;

    const { data: existing } = await createAdminClient()
      .from('products')
      .select('id, name, category_id')
      .eq('id', params.id)
      .eq('supplier_id', supplierId)
      .maybeSingle();

    const suggestedMoqRaw =
      body.suggestedMoq !== undefined
        ? body.suggestedMoq
        : body.suggested_moq !== undefined
          ? body.suggested_moq
          : body.moq;

    const specifications =
      body.specifications !== undefined
        ? (body.specifications || []).map((s: any, idx: number) => ({
            spec_name: s.spec_name || s.key || s.name || `Spec ${idx + 1}`,
            spec_value: s.spec_value || s.value || '',
            sort_order: s.sort_order !== undefined ? s.sort_order : idx,
          }))
        : undefined;

    const payload: Record<string, unknown> = {
      productId: params.id,
      name: body.name || existing?.name,
      categoryId: body.categoryId || body.category_id || existing?.category_id,
      description: body.description,
      sku: body.sku !== undefined ? (body.sku === '' ? null : body.sku) : undefined,
      suggestedMoq: suggestedMoqRaw !== undefined ? Number(suggestedMoqRaw) : undefined,
      supplierPrice:
        body.supplierPrice !== undefined
          ? Number(body.supplierPrice)
          : body.supplier_price !== undefined
            ? Number(body.supplier_price)
            : undefined,
    };

    if (specifications !== undefined) {
      payload.specifications = specifications;
    }

    const imageUrls = body.imageUrls || body.images;
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      payload.imageUrls = imageUrls;
    }

    const result = await submitProductUpdateBySupplier(supplierId, payload);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
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
