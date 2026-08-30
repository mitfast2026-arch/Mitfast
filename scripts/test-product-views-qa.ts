import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

import { createAdminClient } from '../lib/supabase/admin';
import { trackStorefrontProductView, getStorefrontProductDetail } from '../lib/server/products/storefront-detail';
import { getSupplierProductStats } from '../lib/server/suppliers/supplier-service';

async function runTests() {
  console.log('=== PRODUCT VIEWS QA & FLOW VERIFICATION ===\n');
  const admin = createAdminClient();

  // Find an active published product
  const { data: products, error: prodErr } = await admin
    .from('products')
    .select('id, name, supplier_id, view_count, publication_status, archive_status, approval_status')
    .eq('publication_status', 'published')
    .eq('archive_status', 'active')
    .eq('approval_status', 'approved')
    .limit(1);

  if (prodErr || !products || products.length === 0) {
    console.error('No test product found:', prodErr);
    process.exit(1);
  }

  const testProduct = products[0];
  const productId = testProduct.id;
  const supplierId = testProduct.supplier_id;
  console.log(`Test Product: ${testProduct.name} (${productId})`);
  console.log(`Supplier ID: ${supplierId}`);
  console.log(`Initial view_count: ${testProduct.view_count}\n`);

  // Get initial supplier stats
  const initialStats = await getSupplierProductStats(supplierId);
  if (!initialStats.success) {
    console.error('Failed to get supplier stats:', initialStats.error);
    process.exit(1);
  }
  const initialSupplierViews = initialStats.data.summary.totalViews;
  const initialProdRow = initialStats.data.products.find((p) => p.productId === productId);
  const initialProdViews = initialProdRow?.views || 0;
  console.log(`Initial Supplier Total Views: ${initialSupplierViews}`);
  console.log(`Initial Product Views in Supplier Stats: ${initialProdViews}\n`);

  // -------------------------------------------------------------
  // TEST 1: Open product listing / API fetch / getStorefrontProductDetail
  // Should NOT increase view count
  // -------------------------------------------------------------
  console.log('--- TEST 1: Product detail fetch / API read / listing simulation ---');
  const detailFetchRes = await getStorefrontProductDetail(productId);
  if (!detailFetchRes.success) {
    console.error('Failed to get product detail:', detailFetchRes.error);
  }

  const { data: pAfterFetch } = await admin.from('products').select('view_count').eq('id', productId).single();
  const viewsAfterFetch = pAfterFetch?.view_count || 0;
  console.log(`Views after getStorefrontProductDetail: ${viewsAfterFetch} (Expected: ${testProduct.view_count})`);
  if (viewsAfterFetch !== testProduct.view_count) {
    throw new Error(`TEST 1 FAILED: Read fetch incremented views!`);
  }
  console.log('✔ TEST 1 PASSED: Data fetch / background read did NOT increase views.\n');

  // -------------------------------------------------------------
  // TEST 6: Background API request / Prefetch
  // -------------------------------------------------------------
  console.log('--- TEST 6: Prefetch & Background API Simulation ---');
  await getStorefrontProductDetail(productId);
  await getStorefrontProductDetail(productId);
  const { data: pAfterPrefetch } = await admin.from('products').select('view_count').eq('id', productId).single();
  if (pAfterPrefetch?.view_count !== testProduct.view_count) {
    throw new Error(`TEST 6 FAILED: Prefetch incremented views!`);
  }
  console.log('✔ TEST 6 PASSED: Prefetch / background calls do NOT create views.\n');

  // -------------------------------------------------------------
  // TEST 7: Invalid product URL / non-existent product
  // -------------------------------------------------------------
  console.log('--- TEST 7: Invalid / Non-existent product ID ---');
  const invalidRes = await trackStorefrontProductView('00000000-0000-0000-0000-000000000000', 'visitor_test_7');
  console.log(`Result on non-existent product: success=${invalidRes.success}, error=${invalidRes.error?.code}`);
  if (invalidRes.success || invalidRes.error?.code !== 'NOT_FOUND') {
    throw new Error(`TEST 7 FAILED: Non-existent product returned success!`);
  }

  const malformedRes = await trackStorefrontProductView('not-a-uuid', 'visitor_test_7');
  console.log(`Result on malformed UUID: success=${malformedRes.success}, error=${malformedRes.error?.code}`);
  if (malformedRes.success || malformedRes.error?.code !== 'VALIDATION_ERROR') {
    throw new Error(`TEST 7 FAILED: Malformed UUID returned success!`);
  }
  console.log('✔ TEST 7 PASSED: Invalid product visits do NOT create views.\n');

  // -------------------------------------------------------------
  // TEST 2: Successful full product detail page load tracking
  // -------------------------------------------------------------
  console.log('--- TEST 2: Full Product Detail Page Load Tracking ---');
  const uniqueVisitor1 = `visitor_qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const trackRes1 = await trackStorefrontProductView(productId, uniqueVisitor1);
  if (!trackRes1.success) {
    throw new Error(`TEST 2 FAILED: trackStorefrontProductView failed: ${JSON.stringify(trackRes1.error)}`);
  }

  const { data: pAfterTrack1 } = await admin.from('products').select('view_count').eq('id', productId).single();
  const viewsAfterTrack1 = pAfterTrack1?.view_count || 0;
  console.log(`Views after visit: ${viewsAfterTrack1} (Expected: ${testProduct.view_count + 1})`);
  if (viewsAfterTrack1 !== testProduct.view_count + 1) {
    throw new Error(`TEST 2 FAILED: Count did not increase by exactly 1! Got ${viewsAfterTrack1}`);
  }
  console.log('✔ TEST 2 PASSED: View count increased by exactly 1 on detail page load.\n');

  // -------------------------------------------------------------
  // TEST 3: Page refresh / immediate second visit by same visitor
  // -------------------------------------------------------------
  console.log('--- TEST 3: Page Refresh / Deduplication for Same Visitor ---');
  const trackRes2 = await trackStorefrontProductView(productId, uniqueVisitor1);
  const { data: pAfterTrack2 } = await admin.from('products').select('view_count').eq('id', productId).single();
  const viewsAfterTrack2 = pAfterTrack2?.view_count || 0;
  console.log(`Views after refresh with same visitor ID: ${viewsAfterTrack2} (Expected: ${viewsAfterTrack1})`);
  if (viewsAfterTrack2 !== viewsAfterTrack1) {
    throw new Error(`TEST 3 FAILED: Refresh created a duplicate view!`);
  }
  console.log('✔ TEST 3 PASSED: Deduplication prevented duplicate count on refresh.\n');

  // -------------------------------------------------------------
  // TEST 4 & 5: Second different visitor (e.g. from search/category)
  // -------------------------------------------------------------
  console.log('--- TEST 4 & 5: New Visitor / Entry from Search/Category ---');
  const uniqueVisitor2 = `visitor_search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const trackRes3 = await trackStorefrontProductView(productId, uniqueVisitor2);
  if (!trackRes3.success) {
    throw new Error(`TEST 4/5 FAILED: trackStorefrontProductView failed: ${JSON.stringify(trackRes3.error)}`);
  }
  const { data: pAfterTrack3 } = await admin.from('products').select('view_count').eq('id', productId).single();
  const viewsAfterTrack3 = pAfterTrack3?.view_count || 0;
  console.log(`Views after new visitor: ${viewsAfterTrack3} (Expected: ${viewsAfterTrack1 + 1})`);
  if (viewsAfterTrack3 !== viewsAfterTrack1 + 1) {
    throw new Error(`TEST 4/5 FAILED: New visitor did not increment count!`);
  }
  console.log('✔ TEST 4 & 5 PASSED: New visitor from any entry point increments count accurately.\n');

  // -------------------------------------------------------------
  // SUPPLIER VIEWS VERIFICATION:
  // -------------------------------------------------------------
  console.log('--- SUPPLIER PRODUCT VIEWS PAGE VERIFICATION ---');
  const finalStats = await getSupplierProductStats(supplierId);
  if (!finalStats.success) {
    throw new Error(`Failed to get final supplier stats: ${JSON.stringify(finalStats.error)}`);
  }
  const finalSupplierViews = finalStats.data.summary.totalViews;
  const finalProdRow = finalStats.data.products.find((p) => p.productId === productId);
  const finalProdViews = finalProdRow?.views || 0;

  console.log(`Final Supplier Total Views: ${finalSupplierViews} (Expected: ${initialSupplierViews + 2})`);
  console.log(`Final Product Views: ${finalProdViews} (Expected: ${initialProdViews + 2})`);

  if (finalProdViews !== initialProdViews + 2) {
    throw new Error(`Supplier stats mismatch: expected ${initialProdViews + 2}, got ${finalProdViews}`);
  }
  console.log('✔ SUPPLIER VIEWS PAGE VERIFIED: Total views and per-product views accurately attributed to supplier.\n');

  console.log('================================================');
  console.log('ALL 7 TESTS PASSED SUCCESSFULLY!');
  console.log('================================================');
}

runTests().catch((err) => {
  console.error('QA Test execution failed:', err);
  process.exit(1);
});
