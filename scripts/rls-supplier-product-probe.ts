/**
 * Probe: authenticated supplier JWT must NOT be able to UPDATE privileged product columns.
 * Run with SUPABASE_URL + SUPABASE_ANON_KEY + SUPPLIER_ACCESS_TOKEN + PRODUCT_ID env vars.
 *
 * Expectation: update fails (RLS / privilege) after migration 040.
 */
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const token = process.env.SUPPLIER_ACCESS_TOKEN;
  const productId = process.env.PRODUCT_ID;

  if (!url || !anon || !token || !productId) {
    console.log('SKIP — set SUPABASE_URL, ANON_KEY, SUPPLIER_ACCESS_TOKEN, PRODUCT_ID');
    process.exit(0);
  }

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error } = await client
    .from('products')
    .update({ publication_status: 'published', approval_status: 'approved' })
    .eq('id', productId);

  if (!error) {
    console.error('FAIL — supplier was able to set publication/approval via anon client');
    process.exit(1);
  }

  console.log('PASS — supplier privileged UPDATE blocked:', error.message);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
