import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import {
  createProductBySupplier,
  approveProduct,
  rejectProduct,
  adminDirectUpdateProduct,
  submitProductUpdateBySupplier,
  getProductForAdminDetail,
} from '../lib/server/products/product-service';
import { addProductImage } from '../lib/server/products/product-image-service';
import { getStorefrontProductDetail } from '../lib/server/products/storefront-detail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('🚀 Running Product Lifecycle QA Tests...\n');

  // 1. Get an active supplier & category
  const { data: supplier } = await adminClient
    .from('suppliers')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .single();

  const { data: category } = await adminClient
    .from('categories')
    .select('id')
    .limit(1)
    .single();

  if (!supplier || !category) {
    throw new Error('Test requires an active supplier and at least one category in the DB.');
  }

  const supplierId = supplier.id;
  const categoryId = category.id;

  // ── TEST 1: Supplier creates product + 3 images + 4 specs → Admin approves ───────
  console.log('--- TEST 1: Supplier Product Creation & Approval Data Integrity ---');
  const createRes = await createProductBySupplier(supplierId, {
    name: `QA Test Product ${Date.now()}`,
    categoryId,
    description: '<p>High-grade <strong>aerospace bolt</strong> with spec table: <table><tr><td>Yield</td><td>1100 MPa</td></tr></table></p>',
    sku: `QA-SKU-${Date.now()}`,
    suggestedMoq: 150,
    supplierPrice: 250,
    specifications: [
      { spec_name: 'Material', spec_value: 'Inconel 718', sort_order: 0 },
      { spec_name: 'Thread', spec_value: 'M10x1.5', sort_order: 1 },
      { spec_name: 'Finish', spec_value: 'Passivated', sort_order: 2 },
      { spec_name: 'Standard', spec_value: 'AS9100', sort_order: 3 },
    ],
    imageUrls: [],
  });

  assert(createRes.success, 'Product created successfully by supplier');
  const productId = createRes.data!.productId;

  // Add 3 images directly to product_images
  const img1Url = `https://storage.test.com/qa-prod/${productId}/img1.webp`;
  const img2Url = `https://storage.test.com/qa-prod/${productId}/img2.webp`;
  const img3Url = `https://storage.test.com/qa-prod/${productId}/img3.webp`;

  await adminClient.from('product_images').insert([
    { product_id: productId, image_url: img1Url, sort_order: 0, is_primary: true },
    { product_id: productId, image_url: img2Url, sort_order: 1, is_primary: false },
    { product_id: productId, image_url: img3Url, sort_order: 2, is_primary: false },
  ]);

  // Find open approval request
  const { data: request } = await adminClient
    .from('product_approval_requests')
    .select('id')
    .eq('product_id', productId)
    .eq('status', 'pending')
    .single();

  assert(Boolean(request), 'Approval request created for new product');

  // Admin approves
  const approveRes = await approveProduct(request!.id);
  assert(approveRes.success, 'Admin approved new product');

  // Publish product so storefront can view
  await adminClient.from('products').update({ publication_status: 'published' }).eq('id', productId);

  // Verify product detail
  const detailRes = await getProductForAdminDetail(productId);
  assert(detailRes.success, 'Product detail loaded');
  const prodData = detailRes.data!.product;

  assert(prodData.images.length === 3, `Expected 3 images to remain after approval, got ${prodData.images.length}`);
  assert(prodData.images[0].image_url === img1Url && prodData.images[0].is_primary === true, 'Primary image preserved with sort_order 0');
  assert(prodData.specifications.length === 4, `Expected 4 specifications to remain after approval, got ${prodData.specifications.length}`);
  assert(prodData.description.includes('aerospace bolt'), 'Description rich text preserved');

  // ── TEST 2: Admin Reorders/Deletes Images ───────────────────────────────────────
  console.log('\n--- TEST 2: Admin Direct Image Reorder / Delete ---');
  // Admin reorders: img3 becomes primary, removes img2
  const adminUpdateRes = await adminDirectUpdateProduct({
    productId,
    imageUrls: [img3Url, img1Url],
  });
  assert(adminUpdateRes.success, 'Admin updated product images');

  const afterAdminDetail = await getProductForAdminDetail(productId);
  const updatedImages = afterAdminDetail.data!.product.images;
  assert(updatedImages.length === 2, `Expected 2 images after deletion, got ${updatedImages.length}`);
  assert(updatedImages[0].image_url === img3Url && updatedImages[0].is_primary === true, 'Image 3 is now primary at position 0');
  assert(updatedImages[1].image_url === img1Url && updatedImages[1].is_primary === false, 'Image 1 is now secondary at position 1');

  // ── TEST 3: Supplier Updates Price & Specs on Published Product ─────────────────
  console.log('\n--- TEST 3: Supplier Update Request Staging & Approval ---');
  const updateReqRes = await submitProductUpdateBySupplier(supplierId, {
    productId,
    name: `${prodData.name} (Updated)`,
    categoryId,
    supplierPrice: 320,
    suggestedMoq: 200,
    description: '<p>Updated description with new testing certs</p>',
    specifications: [
      { spec_name: 'Material', spec_value: 'Inconel 718 Grade 2', sort_order: 0 },
      { spec_name: 'Hardness', spec_value: '44 HRC', sort_order: 1 },
    ],
  });
  assert(updateReqRes.success, 'Supplier update request submitted');
  const updateRequestId = updateReqRes.data!.requestId;

  // Before approval, storefront product must still have original price and original specs
  const publicBefore = await getStorefrontProductDetail(productId);
  assert(publicBefore.success, 'Public storefront accessible');
  assert(publicBefore.data!.product.supplier_price === 250 || publicBefore.data!.product.selling_price < 320, 'Public price unchanged before approval');

  // Admin approves update request
  const approveUpdateRes = await approveProduct(updateRequestId);
  if (!approveUpdateRes.success) {
    console.error('approveUpdateRes error:', approveUpdateRes.error);
  }
  assert(approveUpdateRes.success, 'Admin approved update request');

  const publicAfter = await getStorefrontProductDetail(productId);
  assert(publicAfter.success, 'Public storefront accessible after update');
  assert(publicAfter.data!.product.name.includes('(Updated)'), 'Public product name updated');
  assert(publicAfter.data!.product.specifications.length === 2, 'Specifications updated to 2 rows');
  assert(publicAfter.data!.product.images.length === 2, 'Images preserved across text/spec update');

  // ── TEST 4: Supplier Proposes Image Changes on Published Product (Staging) ──────
  console.log('\n--- TEST 4: Image Staging & Rejection on Published Product ---');
  // Propose update with new image set
  const stagedImgUrl = `https://storage.test.com/qa-prod/${productId}/staged-new.webp`;
  const imgUpdateReqRes = await submitProductUpdateBySupplier(supplierId, {
    productId,
    imageUrls: [stagedImgUrl, img3Url],
    suggestedMoq: 200,
    supplierPrice: 320,
  });
  assert(imgUpdateReqRes.success, 'Image update request submitted');
  const imgReqId = imgUpdateReqRes.data!.requestId;

  // Verify storefront still sees only the 2 original images (stagedImgUrl is NOT visible publicly)
  const publicDuringUpdate = await getStorefrontProductDetail(productId);
  const publicImgs = publicDuringUpdate.data!.product.images;
  assert(!publicImgs.some((img: any) => img.image_url === stagedImgUrl), 'Staged image is NOT publicly visible before approval');

  // Admin rejects update
  const rejectRes = await rejectProduct({
    requestId: imgReqId,
    rejectionReason: 'Photos do not meet clarity standards',
  });
  assert(rejectRes.success, 'Admin rejected update request');

  // Verify storefront still has the original 2 images
  const publicAfterReject = await getStorefrontProductDetail(productId);
  assert(publicAfterReject.data!.product.images.length === 2, 'Original images remained after rejection');

  // ── TEST 5: Admin MOQ Protection ───────────────────────────────────────────────
  console.log('\n--- TEST 5: Catalog MOQ Protection During Supplier Update ---');
  // Admin sets catalog moq to 500
  await adminDirectUpdateProduct({
    productId,
    moq: 500,
  });

  const checkAdminMoq = await getProductForAdminDetail(productId);
  assert(checkAdminMoq.data!.product.moq === 500, 'Admin catalog MOQ set to 500');

  // Supplier submits price update with suggested_moq: 50
  const moqUpdateReqRes = await submitProductUpdateBySupplier(supplierId, {
    productId,
    supplierPrice: 350,
    suggestedMoq: 50,
  });
  assert(moqUpdateReqRes.success, 'Supplier submitted update with suggested MOQ 50');

  // Admin approves update
  const approveMoqRes = await approveProduct(moqUpdateReqRes.data!.requestId);
  assert(approveMoqRes.success, 'Admin approved supplier update');

  const afterMoqApproval = await getProductForAdminDetail(productId);
  assert(afterMoqApproval.data!.product.moq === 500, `Catalog MOQ remained 500, got ${afterMoqApproval.data!.product.moq}`);
  assert(afterMoqApproval.data!.product.suggested_moq === 50, `Supplier suggested MOQ updated to 50, got ${afterMoqApproval.data!.product.suggested_moq}`);

  // Cleanup QA product
  await adminClient.from('products').delete().eq('id', productId);
  console.log('\n✨ All 6 Product Lifecycle Tests Passed Successfully!');
}

run().catch((err) => {
  console.error('\nQA Test Failed:', err);
  process.exit(1);
});
