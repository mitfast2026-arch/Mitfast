import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCustomer } from '@/lib/server/auth/get-session';
import { signedDocumentUrl } from '@/lib/server/storage/storage-service';

export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const targetCustomerId = auth.session.profile.id;
    const customerEmail = auth.session.profile.email;

    let query = adminClient
      .from('enquiries')
      .select(`
        *,
        product:products(id, name, selling_price)
      `)
      .order('created_at', { ascending: false });

    if (targetCustomerId && customerEmail) {
      query = query.or(`customer_id.eq.${targetCustomerId},guest_email.eq.${customerEmail}`);
    } else {
      query = query.eq('customer_id', targetCustomerId);
    }

    const { data: enquiries, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } },
        { status: 500 }
      );
    }

    const signed = await Promise.all(
      (enquiries || []).map(async (row) => {
        if (!row.attachment_path) return row;
        const url = await signedDocumentUrl(row.attachment_path);
        return url ? { ...row, attachment_url: url } : row;
      })
    );

    return NextResponse.json({
      success: true,
      data: { enquiries: signed },
    });
  } catch (error) {
    console.error('[GET /api/customer/enquiries] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
