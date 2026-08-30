import { NextResponse, type NextRequest } from 'next/server';
import { getCategories, createCategory, deleteCategory } from '@/lib/server/categories/category-service';
import { getCachedPublicCategories } from '@/lib/server/products/cached-storefront';
import { requireAdmin } from '@/lib/server/auth/get-session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modeParam = searchParams.get('mode');
    const statusParam = searchParams.get('status');

    const mode = modeParam === 'admin' ? 'admin' : 'public';
    let status: 'active' | 'archived' | 'all' = 'active';

    if (mode === 'admin') {
      const auth = await requireAdmin();
      if (!auth.ok) return auth.response;

      if (statusParam === 'archived' || statusParam === 'all' || statusParam === 'active') {
        status = statusParam;
      } else {
        status = 'all';
      }
    }

    const result =
      mode === 'public'
        ? await getCachedPublicCategories()
        : await getCategories({ mode, status });
    if (!result.success) return NextResponse.json(result, { status: 400 });

    const headers: Record<string, string> =
      mode === 'admin'
        ? { 'Cache-Control': 'no-store' }
        : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const result = await createCategory(body);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: { message: 'Category ID is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await deleteCategory({ categoryId });
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
