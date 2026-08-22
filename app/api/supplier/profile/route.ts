import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: supplier, error: supError } = await admin
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json({ success: false, error: { message: 'Supplier profile not found' } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { supplier }
    });
  } catch (err: any) {
    console.error('Supplier profile GET error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: supplier, error: supError } = await admin
      .from('suppliers')
      .select('id, status')
      .eq('user_id', user.id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json({ success: false, error: { message: 'Supplier profile not found' } }, { status: 404 });
    }

    const body = await request.json();
    const updatePayload: Record<string, any> = {};

    if (body.companyName !== undefined) updatePayload.company_name = body.companyName.trim();
    if (body.contactPerson !== undefined) updatePayload.contact_person = body.contactPerson.trim();
    if (body.phone !== undefined) updatePayload.phone = body.phone.trim();
    if (body.address !== undefined) updatePayload.address = body.address?.trim() || null;
    if (body.country !== undefined) updatePayload.country = body.country.trim();
    if (body.website !== undefined) updatePayload.website = body.website?.trim() || null;

    // Resubmission flow: If resubmitting from rejected state
    if (body.resubmit && (supplier as any).status === 'rejected') {
      updatePayload.status = 'pending';
      updatePayload.rejection_reason = null;
    }

    const { data: updated, error: updateError } = await admin
      .from('suppliers')
      .update(updatePayload as any)
      .eq('id', (supplier as any).id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: { supplier: updated }
    });
  } catch (err: any) {
    console.error('Supplier profile PUT error:', err);
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Internal server error' } },
      { status: 500 }
    );
  }
}
