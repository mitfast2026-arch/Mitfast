import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { sanitizePostgrestSearch } from '@/lib/server/db/sanitize-search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const rawSearch = searchParams.get('search')?.trim() || '';

    const adminClient = createAdminClient();
    let query = adminClient
      .from('profiles')
      .select('id, full_name, email, phone', { count: 'exact' })
      .eq('role', 'customer');

    if (rawSearch.length >= 2) {
      const q = sanitizePostgrestSearch(rawSearch);
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      }
    }

    const { data: customers, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { customers: customers || [], total: count ?? 0, page, limit },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
