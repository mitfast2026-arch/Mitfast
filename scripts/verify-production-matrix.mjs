import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  let val = m[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('missing env', { url: !!url, key: !!key });
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const results = [];

function push(t, pass, detail) {
  results.push({ t, pass, detail });
}

const productId = 'cd0d7121-50c1-49c5-83ec-c831a2d3dd34';

const { data: prod } = await sb
  .from('products')
  .select('id,sku,stock_quantity')
  .eq('id', productId)
  .single();
push('sku_stock_columns', !!prod && prod.sku === 'AF-Ti-M8x50' && prod.stock_quantity === 250, prod);

const path = `${productId}/verify-${Date.now()}.png`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const up = await sb.storage.from('product-images').upload(path, png, {
  contentType: 'image/png',
  upsert: true,
});
push('storage_upload', !up.error, up.error?.message || path);

const { data: pub } = sb.storage.from('product-images').getPublicUrl(path);
const ins = await sb
  .from('product_images')
  .insert({
    product_id: productId,
    image_url: pub.publicUrl,
    storage_path: path,
    is_primary: false,
    sort_order: 99,
  })
  .select('id')
  .single();
push('product_images_insert', !ins.error && !!ins.data?.id, ins.error?.message || ins.data?.id);

if (ins.data?.id) {
  await sb.from('product_images').delete().eq('id', ins.data.id);
  const del = await sb.storage.from('product-images').remove([path]);
  push('storage_delete', !del.error, del.error?.message || 'ok');
}

const { data: carts } = await sb.from('carts').select('id,customer_id').limit(2);
if (carts?.length) {
  const { data: items } = await sb
    .from('cart_items')
    .select('id,cart_id')
    .eq('cart_id', carts[0].id)
    .limit(1);
  if (items?.[0]) {
    const { data: row } = await sb
      .from('cart_items')
      .select('id, cart:carts!inner(customer_id)')
      .eq('id', items[0].id)
      .single();
    const owner = row?.cart?.customer_id;
    const wrong = '00000000-0000-0000-0000-000000000000';
    push('cart_idor_owner_mismatch', !!owner && owner !== wrong, { owner, item: items[0].id });
  } else {
    push('cart_idor_owner_mismatch', null, 'no cart items');
  }
} else {
  push('cart_idor_owner_mismatch', null, 'no carts');
}

const { data: list } = await sb
  .from('products')
  .select(
    'id,name,sku,stock_quantity,supplier:suppliers(country,address),images:product_images(image_url)'
  )
  .eq('publication_status', 'published')
  .eq('archive_status', 'active')
  .limit(3);
push(
  'storefront_select_sku_stock_supplier',
  Array.isArray(list) && list.length > 0,
  list?.map((p) => ({
    id: p.id,
    sku: p.sku,
    stock: p.stock_quantity,
    country: p.supplier?.country,
    imgs: p.images?.length,
  }))
);

const { data: bs } = await sb
  .from('business_settings')
  .select('products_banner_url,logo_url,minimum_rfq_value')
  .limit(1)
  .single();
push('banner_url_present', !!bs?.products_banner_url, bs);
push('minimum_rfq_value_500000', Number(bs?.minimum_rfq_value) === 500000, bs?.minimum_rfq_value);

const { data: enq } = await sb
  .from('enquiries')
  .select('id,attachment_url,attachment_path,response_message,product_id')
  .limit(3);
push('enquiry_attachment_columns_readable', Array.isArray(enq), enq?.length);

const { count: archived } = await sb
  .from('products')
  .select('*', { count: 'exact', head: true })
  .eq('archive_status', 'archived');
const { count: publishedActive } = await sb
  .from('products')
  .select('*', { count: 'exact', head: true })
  .eq('publication_status', 'published')
  .eq('archive_status', 'active');
push('archive_vs_published_counts', true, { archived, publishedActive });

// documents bucket upload for enquiry attachment path pattern
const enqId = enq?.[0]?.id || '00000000-0000-0000-0000-000000000001';
const docPath = `${enqId}/verify-${Date.now()}.txt`;
const docUp = await sb.storage.from('documents').upload(docPath, Buffer.from('verify'), {
  contentType: 'text/plain',
  upsert: true,
});
push('documents_bucket_upload', !docUp.error, docUp.error?.message || docPath);
if (!docUp.error) {
  await sb.storage.from('documents').remove([docPath]);
}

console.log(JSON.stringify(results, null, 2));
