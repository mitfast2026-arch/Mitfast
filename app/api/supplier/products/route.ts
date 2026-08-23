import { NextResponse, type NextRequest } from 'next/server';
import { requireSupplier } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;

    const supplierId = auth.session.supplier!.id;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim();

    const adminClient = createAdminClient();
    let query = adminClient
      .from('products')
      .select(
        `
        id,
        name,
        description,
        category_id,
        sku,
        moq,
        suggested_moq,
        supplier_price,
        selling_price,
        approval_status,
        publication_status,
        archive_status,
        created_at,
        updated_at,
        category:categories(id, name)
      `,
        { count: 'exact' }
      )
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        products: products || [],
        total: count || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
