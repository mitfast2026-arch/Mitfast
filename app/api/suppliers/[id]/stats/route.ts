import { NextResponse, type NextRequest } from 'next/server';
import { getSupplierProductStats } from '@/lib/server/suppliers/supplier-service';
import { getServerSession, unauthorizedResponse, forbiddenResponse } from '@/lib/server/auth/get-session';

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const supplierId = params.id;
    const isAdmin = session.profile.role === 'admin';
    const isOwnSupplier = session.profile.role === 'supplier' && session.supplier?.id === supplierId;

    if (!isAdmin && !isOwnSupplier) {
      return forbiddenResponse();
    }

    const result = await getSupplierProductStats(supplierId);

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
