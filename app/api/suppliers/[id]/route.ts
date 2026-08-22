import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const supabase = createAdminClient();
    const { id } = params;

    const { data: supplier, error: supError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { success: false, error: { message: 'Supplier not found' } },
        { status: 404 }
      );
    }

    const { data: products } = await supabase
      .from('products')
      .select('*, category:categories(id, name)')
      .eq('supplier_id', id);

    return NextResponse.json({
      success: true,
      data: {
        supplier,
        products: products || []
      }
    });
  } catch (err: any) {
    console.error('Supplier GET [id] error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
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

    const supabase = createAdminClient();
    const { id } = params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.companyName !== undefined) updatePayload.company_name = body.companyName;
    if (body.contactPerson !== undefined) updatePayload.contact_person = body.contactPerson;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.country !== undefined) updatePayload.country = body.country;
    if (body.website !== undefined) updatePayload.website = body.website;
    if (body.status !== undefined) updatePayload.status = body.status;

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(updatePayload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { supplier: updated }
    });
  } catch (err: any) {
    console.error('Supplier PUT [id] error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
