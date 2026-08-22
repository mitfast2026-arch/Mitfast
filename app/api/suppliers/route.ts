import { NextResponse, type NextRequest } from 'next/server';
import { createSupplierByAdmin, getSuppliersForAdmin } from '@/lib/server/suppliers/supplier-service';
import type { SupplierStatus } from '@/types/database';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as SupplierStatus) || undefined;
    const country = searchParams.get('country') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || undefined;

    const result = await getSuppliersForAdmin({ page, limit, search, status, country, sortBy });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
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
    const result = await createSupplierByAdmin(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
