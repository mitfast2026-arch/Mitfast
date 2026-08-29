/**
 * Concurrent business-ops load test (free-tier safe).
 *
 * Scenarios:
 * 1. Cart quantity updates (parallel +1)
 * 2. RFQ → Order conversion race
 * 3. Supplier approve/reject race
 * 4. Duplicate RFQ idempotency claim
 *
 * Tags [LOADTEST:<runId>] and always cleans up.
 *
 *   $env:LOAD_TEST_CONFIRM=1; npx tsx scripts/concurrent-business-ops-load-test.ts
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(process.cwd(), '.env.development.local'), override: true });

const CONFIRM = process.env.LOAD_TEST_CONFIRM === '1';
const MARKER_PREFIX = '[LOADTEST:';

type Result = { name: string; pass: boolean; detail: string; duplicates?: number };

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

async function cartQuantityRace(admin: SupabaseClient, runId: string): Promise<Result> {
  const email = `loadtest.cart.${runId}@mitfast.test`;
  const password = `LoadCart!${runId}Aa1`;
  let userId: string | null = null;
  let profileId: string | null = null;
  let cartId: string | null = null;
  let productId: string | null = null;

  try {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: `${MARKER_PREFIX}${runId}] Cart` },
    });
    if (error || !created.user) throw new Error(error?.message || 'createUser');
    userId = created.user.id;

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          role: 'customer',
          full_name: `${MARKER_PREFIX}${runId}] Cart`,
          email,
          phone: '',
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();
    if (profErr || !profile) throw new Error(profErr?.message || 'profile upsert');
    profileId = profile.id;

    const { data: product } = await admin
      .from('products')
      .select('id')
      .eq('publication_status', 'published')
      .limit(1)
      .maybeSingle();
    if (!product?.id) return { name: 'cart-qty', pass: false, detail: 'SKIP — no published product' };
    productId = product.id;

    const { data: cart, error: cartErr } = await admin
      .from('carts')
      .insert({ customer_id: profileId })
      .select('id')
      .single();
    if (cartErr || !cart) throw new Error(cartErr?.message || 'cart insert');
    cartId = cart.id;

    await admin.from('cart_items').delete().eq('cart_id', cartId).eq('product_id', productId);

    const n = 20;
    const deltas = Array.from({ length: n }, () => 1);
    const rpcResults = await Promise.all(
      deltas.map((d) =>
        admin.rpc('increment_cart_item_quantity', {
          p_cart_id: cartId,
          p_product_id: productId,
          p_delta: d,
          p_moq: 1,
        } as any)
      )
    );
    const rpcFails = rpcResults.filter((r) => r.error);
    if (rpcFails.length) {
      return {
        name: 'cart-qty',
        pass: false,
        detail: `rpc_errors=${rpcFails.length} sample=${rpcFails[0].error?.message}`,
      };
    }

    const { data: row } = await admin
      .from('cart_items')
      .select('quantity')
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .single();

    const qty = row?.quantity ?? 0;
    const { count } = await admin
      .from('cart_items')
      .select('id', { count: 'exact', head: true })
      .eq('cart_id', cartId)
      .eq('product_id', productId);

    const duplicates = (count ?? 0) > 1 ? (count ?? 0) - 1 : 0;
    return {
      name: 'cart-qty',
      pass: qty === n && duplicates === 0,
      detail: `qty=${qty} expect=${n} duplicate_rows=${duplicates}`,
      duplicates,
    };
  } finally {
    if (cartId) {
      await admin.from('cart_items').delete().eq('cart_id', cartId);
      await admin.from('carts').delete().eq('id', cartId);
    }
    if (userId) {
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function rfqToOrderRace(admin: SupabaseClient, runId: string): Promise<Result> {
  const email = `loadtest.rfqord.${runId}@mitfast.test`;
  let userId: string | null = null;
  let profileId: string | null = null;
  let rfqId: string | null = null;
  let productId: string | null = null;
  let orderIds: string[] = [];

  try {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: `LoadRfq!${runId}Aa1`,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: `${MARKER_PREFIX}${runId}] RfqOrd` },
    });
    if (error || !created.user) throw new Error(error?.message || 'createUser');
    userId = created.user.id;

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          role: 'customer',
          full_name: `${MARKER_PREFIX}${runId}] RfqOrd`,
          email,
          phone: '',
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();
    if (profErr || !profile) throw new Error(profErr?.message || 'profile upsert');
    profileId = profile.id;

    const { data: product } = await admin
      .from('products')
      .select('id, name, supplier_id, selling_price, gst_rate, gst_included, discount')
      .eq('publication_status', 'published')
      .limit(1)
      .maybeSingle();
    if (!product?.id) return { name: 'rfq-to-order', pass: false, detail: 'SKIP — no published product' };
    productId = product.id;

    const rfqNumber = `LT-RFQ-${runId}`;
    const { data: rfq, error: rfqErr } = await admin
      .from('rfqs')
      .insert({
        customer_id: profileId,
        rfq_number: rfqNumber,
        status: 'accepted',
        original_total: 100,
        delivery_address_snapshot: {
          label: `${MARKER_PREFIX}${runId}]`,
          line1: 'Load Test Street',
          city: 'TestCity',
          state: 'TS',
          postal_code: '000000',
          country: 'IN',
        },
        customer_message: `${MARKER_PREFIX}${runId}] concurrent convert`,
      } as any)
      .select('id')
      .single();
    if (rfqErr || !rfq) throw new Error(rfqErr?.message || 'rfq insert');
    rfqId = rfq.id;

    await admin.from('rfq_items').insert({
      rfq_id: rfqId,
      product_id: productId,
      quantity: 10,
      unit_price: product.selling_price ?? 10,
      product_name_snapshot: product.name,
      supplier_id: product.supplier_id,
    } as any);

    const orderItem = {
      product_id: productId,
      supplier_id: product.supplier_id,
      product_name_snapshot: product.name || 'LT Product',
      supplier_name_snapshot: 'LT Supplier',
      quantity: 10,
      unit_price: Number(product.selling_price ?? 10),
      currency_code: 'INR',
      gst_rate: Number(product.gst_rate ?? 18),
      gst_included: Boolean(product.gst_included),
      discount: Number(product.discount ?? 0),
      subtotal: 100,
      gst_amount: 18,
      total: 118,
    };

    const parallel = 15;
    const results = await Promise.all(
      Array.from({ length: parallel }, (_, i) =>
        admin.rpc('convert_rfq_to_order_atomic', {
          p_rfq_id: rfqId,
          p_order_number: `LT-ORD-${runId}-${i}`,
          p_tracking_token: `lt-track-${runId}-${i}`,
          p_subtotal: 100,
          p_total: 118,
          p_order_items: [orderItem],
        })
      )
    );

    const successes = results.filter((r) => !r.error && r.data).length;
    const failures = results.filter((r) => r.error).length;

    const { data: orders } = await admin.from('orders').select('id').eq('rfq_id', rfqId);
    orderIds = (orders || []).map((o) => o.id);
    const duplicates = Math.max(0, orderIds.length - 1);

    return {
      name: 'rfq-to-order',
      pass: orderIds.length === 1 && successes === 1,
      detail: `orders=${orderIds.length} successes=${successes} failures=${failures} (expect 1 order)`,
      duplicates,
    };
  } finally {
    if (orderIds.length) {
      await admin.from('order_items').delete().in('order_id', orderIds);
      await admin.from('orders').delete().in('id', orderIds);
    }
    if (rfqId) {
      await admin.from('rfq_items').delete().eq('rfq_id', rfqId);
      await admin.from('rfqs').delete().eq('id', rfqId);
    }
    if (userId) {
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function supplierApproveRejectRace(admin: SupabaseClient, runId: string): Promise<Result> {
  const email = `loadtest.apprej.${runId}@mitfast.test`;
  let userId: string | null = null;
  let supplierId: string | null = null;

  try {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: `LoadAR!${runId}Aa1`,
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: `${MARKER_PREFIX}${runId}] AppRej` },
    });
    if (error || !created.user) throw new Error(error?.message || 'createUser');
    userId = created.user.id;

    await admin.from('profiles').upsert(
      {
        user_id: userId,
        role: 'supplier',
        full_name: `${MARKER_PREFIX}${runId}] AppRej`,
        email,
        phone: '',
      },
      { onConflict: 'user_id' }
    );

    const { data: supplier, error: supErr } = await admin
      .from('suppliers')
      .insert({
        user_id: userId,
        company_name: `${MARKER_PREFIX}${runId}] AppRej Co`,
        status: 'pending',
        email,
        contact_person: 'LoadTest',
        phone: '0000000000',
        country: 'India',
      } as any)
      .select('id')
      .single();
    if (supErr || !supplier) throw new Error(supErr?.message || 'supplier insert');
    supplierId = supplier.id;

    const approve = () =>
      admin
        .from('suppliers')
        .update({ status: 'active', rejection_reason: null })
        .eq('id', supplierId!)
        .eq('status', 'pending')
        .select('id');

    const reject = () =>
      admin
        .from('suppliers')
        .update({ status: 'rejected', rejection_reason: `${MARKER_PREFIX}${runId}] race` })
        .eq('id', supplierId!)
        .eq('status', 'pending')
        .select('id');

    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => approve()),
      ...Array.from({ length: 5 }, () => reject()),
    ]);

    const winners = results.filter((r) => !r.error && (r.data?.length ?? 0) > 0).length;
    const { data: final } = await admin.from('suppliers').select('status').eq('id', supplierId).single();

    return {
      name: 'supplier-approve-reject',
      pass: winners === 1 && (final?.status === 'active' || final?.status === 'rejected'),
      detail: `winners=${winners} final_status=${final?.status} (expect exactly 1 winner)`,
      duplicates: Math.max(0, winners - 1),
    };
  } finally {
    if (supplierId) await admin.from('suppliers').delete().eq('id', supplierId);
    if (userId) {
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function duplicateRfqIdempotency(admin: SupabaseClient, runId: string): Promise<Result> {
  const key = `${MARKER_PREFIX}${runId}]:submit_rfq:${randomUUID()}`;
  const scope = 'submit_rfq_from_cart';

  const insertOne = () =>
    admin.from('idempotency_keys').insert({
      key,
      scope,
      status: 'in_progress',
      response: null,
    });

  const results = await Promise.all(Array.from({ length: 10 }, () => insertOne()));
  const successes = results.filter((r) => !r.error).length;
  const conflicts = results.filter(
    (r) => r.error && (r.error.code === '23505' || r.error.message?.includes('duplicate'))
  ).length;

  await admin.from('idempotency_keys').delete().eq('key', key);

  return {
    name: 'duplicate-rfq-idempotency',
    pass: successes === 1 && conflicts === 9,
    detail: `successes=${successes} conflicts=${conflicts} (expect 1/9)`,
    duplicates: Math.max(0, successes - 1),
  };
}

async function leftoverLoadtestScan(admin: SupabaseClient): Promise<Result> {
  const { count: products } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .ilike('name', `${MARKER_PREFIX}%`);
  const { count: suppliers } = await admin
    .from('suppliers')
    .select('id', { count: 'exact', head: true })
    .ilike('company_name', `${MARKER_PREFIX}%`);
  const { count: rfqs } = await admin
    .from('rfqs')
    .select('id', { count: 'exact', head: true })
    .ilike('customer_message', `${MARKER_PREFIX}%`);

  const leftovers = (products ?? 0) + (suppliers ?? 0) + (rfqs ?? 0);
  return {
    name: 'leftover-scan',
    pass: leftovers === 0,
    detail: `products=${products ?? 0} suppliers=${suppliers ?? 0} rfqs=${rfqs ?? 0}`,
    duplicates: leftovers,
  };
}

async function main() {
  if (!CONFIRM) {
    console.error('Refusing to run without LOAD_TEST_CONFIRM=1');
    process.exit(1);
  }

  const { url, key } = requireEnv();
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID().slice(0, 8);

  console.log(`\n=== Concurrent business ops ===`);
  console.log(`  runId=${runId}`);

  const results: Result[] = [];
  results.push(await cartQuantityRace(admin, runId));
  results.push(await rfqToOrderRace(admin, runId));
  results.push(await supplierApproveRejectRace(admin, runId));
  results.push(await duplicateRfqIdempotency(admin, runId));
  results.push(await leftoverLoadtestScan(admin));

  let failed = 0;
  let dupes = 0;
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${r.name}: ${r.detail}`);
    if (!r.pass) failed += 1;
    dupes += r.duplicates ?? 0;
  }

  console.log(`\n  duplicate_records_total=${dupes}`);
  if (failed > 0) {
    console.error(`\nFAIL — ${failed} scenario(s) failed`);
    process.exit(1);
  }
  console.log('\nPASS — concurrent business ops');
}

main().catch((err) => {
  console.error('\nFAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
