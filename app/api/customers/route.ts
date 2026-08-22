import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const { data: customers, error } = await adminClient
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { customers: customers || [] } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
