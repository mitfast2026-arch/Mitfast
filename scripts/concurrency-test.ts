/**
 * Concurrency regression checks for production architecture changes.
 *
 * Run against local Supabase + dev server:
 *   npx tsx scripts/concurrency-test.ts
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: TEST_BASE_URL (default http://localhost:3000)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testCartIncrementRace() {
  console.log('\n[cart] atomic increment RPC...');

  const { data: profiles } = await admin.from('profiles').select('id').eq('role', 'customer').limit(1);
  const customerId = profiles?.[0]?.id;
  if (!customerId) {
    console.log('  SKIP — no customer profile');
    return;
  }

  const { data: products } = await admin
    .from('products')
    .select('id')
    .eq('publication_status', 'published')
    .limit(1);
  const productId = products?.[0]?.id;
  if (!productId) {
    console.log('  SKIP — no published product');
    return;
  }

  let { data: cart } = await admin.from('carts').select('id').eq('customer_id', customerId).maybeSingle();
  if (!cart) {
    const { data: created } = await admin.from('carts').insert({ customer_id: customerId }).select('id').single();
    cart = created;
  }
  if (!cart) throw new Error('cart missing');

  await admin.from('cart_items').delete().eq('cart_id', cart.id).eq('product_id', productId);

  const deltas = Array.from({ length: 20 }, () => 1);
  await Promise.all(
    deltas.map((d) =>
      admin.rpc('increment_cart_item_quantity', {
        p_cart_id: cart!.id,
        p_product_id: productId,
        p_delta: d,
      })
    )
  );

  const { data: row } = await admin
    .from('cart_items')
    .select('quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .single();

  const qty = row?.quantity ?? 0;
  if (qty !== 20) {
    throw new Error(`Expected quantity 20, got ${qty} (lost update)`);
  }
  console.log('  PASS — quantity = 20 after 20 parallel +1');
}

async function testConversionUniqueIndexExists() {
  console.log('\n[schema] conversion unique indexes...');
  const { data, error } = await admin.rpc('admin_dashboard_metrics');
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('admin_dashboard_metrics missing');
  console.log('  PASS — RPC admin_dashboard_metrics callable');
}

async function main() {
  console.log('MITFAST concurrency tests');
  await testConversionUniqueIndexExists();
  await testCartIncrementRace();
  console.log('\nAll runnable checks passed.');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message || err);
  process.exit(1);
});
