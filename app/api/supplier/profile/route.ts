import { NextRequest, NextResponse } from 'next/server';
import { requireSupplierRole } from '@/lib/server/auth/get-session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupplierRole();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const { data: supplier, error: supError } = await admin
      .from('suppliers')
      .select('*')
      .eq('user_id', auth.session.user.id)
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
    const auth = await requireSupplierRole();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const { data: supplier, error: supError } = await admin
      .from('suppliers')
      .select('id, status')
      .eq('user_id', auth.session.user.id)
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

    if (body.notificationPreferences !== undefined) {
      const prefs = body.notificationPreferences;
      updatePayload.notification_preferences = {
        emailRfqs: Boolean(prefs.emailRfqs),
        emailOrders: Boolean(prefs.emailOrders),
        emailApprovals: Boolean(prefs.emailApprovals),
      };
    }

    // Resubmission flow: If resubmitting from rejected state (service-role only).
    // Never allow clients to self-activate (pending/rejected → active).
    if (body.resubmit && (supplier as any).status === 'rejected') {
      updatePayload.status = 'pending';
      updatePayload.rejection_reason = null;
    }

    // Strip any client-supplied status other than the rejected → pending path above
    if (updatePayload.status && updatePayload.status !== 'pending') {
      delete updatePayload.status;
    }
    if (body.status === 'active' || body.status === 'archived') {
      // Explicitly ignore privilege-escalation attempts
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
