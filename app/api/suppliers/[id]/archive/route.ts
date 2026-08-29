import { NextResponse, type NextRequest } from 'next/server';
import { archiveSupplier } from '@/lib/server/suppliers/supplier-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const supplierId = params.id;
    const result = await archiveSupplier(supplierId);

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
