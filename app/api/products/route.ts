import { NextResponse, type NextRequest } from 'next/server';
import {
  createProductBySupplier,
  createProductByAdmin,
  getStorefrontProducts,
  getProductsForAdmin,
} from '@/lib/server/products/product-service';
import { getServerSession, requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/server/auth/get-session';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';

function normalizeProductPayload(body: any) {
  return {
    ...body,
    categoryId: body.categoryId || body.category_id,
    supplierId: body.supplierId || body.supplier_id,
    sku: body.sku !== undefined ? (body.sku === '' ? null : body.sku) : undefined,
    stockQuantity:
      body.stockQuantity !== undefined
        ? Number(body.stockQuantity)
        : body.stock_quantity !== undefined
          ? Number(body.stock_quantity)
          : undefined,
    supplierPrice: body.supplierPrice !== undefined ? Number(body.supplierPrice) : (body.supplier_price !== undefined ? Number(body.supplier_price) : undefined),
    gstRate: body.gstRate !== undefined ? Number(body.gstRate) : undefined,
    gstIncluded: body.gstIncluded,
    discount: body.discount !== undefined ? Number(body.discount) : 0,
    minOrderValue: body.minOrderValue !== undefined && body.minOrderValue !== '' ? Number(body.minOrderValue) : null,
    specifications: (body.specifications || []).map((s: any, idx: number) => ({
      spec_name: s.spec_name || s.key || s.name || `Spec ${idx + 1}`,
      spec_value: s.spec_value || s.value || '',
      sort_order: s.sort_order !== undefined ? s.sort_order : idx,
    })),
    imageUrls: body.imageUrls || body.images || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'admin' or 'storefront' (default)

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || undefined;
    const minPriceRaw = searchParams.get('minPrice');
    const maxPriceRaw = searchParams.get('maxPrice');
    const moqMinRaw = searchParams.get('moqMin');
    const moqMaxRaw = searchParams.get('moqMax');
    const inStockOnly = searchParams.get('inStock') === '1' || searchParams.get('inStock') === 'true';

    if (mode === 'admin') {
      const auth = await requireAdmin();
      if (!auth.ok) return auth.response;
      const supplierId = searchParams.get('supplierId') || undefined;
      const approvalStatus = (searchParams.get('approvalStatus') as any) || undefined;
      const publicationStatus = (searchParams.get('publicationStatus') as any) || undefined;
      const archiveStatus = (searchParams.get('archiveStatus') as any) || undefined;

      const result = await getProductsForAdmin({
        page,
        limit,
        search,
        categoryId,
        supplierId,
        approvalStatus,
        publicationStatus,
        archiveStatus,
        sortBy,
      });

      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    const result = await getStorefrontProducts({
      categoryId,
      search,
      page,
      limit,
      sortBy,
      minPrice: minPriceRaw != null && minPriceRaw !== '' ? Number(minPriceRaw) : undefined,
      maxPrice: maxPriceRaw != null && maxPriceRaw !== '' ? Number(maxPriceRaw) : undefined,
      moqMin: moqMinRaw != null && moqMinRaw !== '' ? Number(moqMinRaw) : undefined,
      moqMax: moqMaxRaw != null && moqMaxRaw !== '' ? Number(moqMaxRaw) : undefined,
      inStockOnly,
    });
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const productPayload = normalizeProductPayload(body);

    if (session.profile.role === 'admin') {
      const result = await createProductByAdmin(productPayload);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      deferRevalidateProduct(result.data.productId);
      return NextResponse.json(result, { status: 201 });
    }

    if (session.profile.role === 'supplier') {
      if (!session.supplier || session.supplier.status !== 'active') {
        return forbiddenResponse('Active supplier session required');
      }

      const supplierId = session.supplier.id;
      const result = await createProductBySupplier(supplierId, productPayload);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      deferRevalidateProduct(result.data.productId);
      return NextResponse.json(result, { status: 201 });
    }

    return forbiddenResponse();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
