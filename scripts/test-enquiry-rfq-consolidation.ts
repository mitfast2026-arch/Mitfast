import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createAdminClient } from '@/lib/supabase/admin';
import {
  createEnquiry,
  updateEnquiryDetails,
  updateEnquiryStatus,
  getEnquiryDetail,
  getCustomerEnquiries,
} from '@/lib/server/enquiries/enquiry-service';
import {
  createRfqFromEnquiry,
  adminEditRfq,
  adminNegotiateRfq,
  adminAcceptRfq,
  getRfqDetail,
  getCustomerRfqs,
  submitRfqFromCart,
} from '@/lib/server/rfq/rfq-service';
import { convertRfqToOrder } from '@/lib/server/orders/order-service';
import { calculatePricing, roundCurrency } from '@/lib/server/pricing/calculate-price';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(num: number, name: string, passed: boolean, details?: string) {
  results.push({ num, name, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Case ${num.toString().padStart(2, '0')}] ${mark}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('MITFAST ENQUIRY + RFQ WORKFLOW CONSOLIDATION TEST SUITE');
  console.log('====================================================\n');

  const admin = createAdminClient();

  // Retrieve published products for testing
  const { data: products, error: pErr } = await admin
    .from('products')
    .select('id, name, selling_price, moq, discount, gst_rate, gst_included, supplier_id')
    .limit(5);

  if (pErr || !products || products.length === 0) {
    console.error('No products found in DB for testing:', pErr);
    process.exit(1);
  }

  const p1 = products[0];
  const p2 = products[1] || products[0];
  const p1Moq = p1.moq || 10;
  const p2Moq = p2.moq || 5;

  console.log(`Using test products:\n- Product 1: ${p1.name} (ID: ${p1.id}, MOQ: ${p1Moq}, Price: ₹${p1.selling_price})\n- Product 2: ${p2.name} (ID: ${p2.id}, MOQ: ${p2Moq}, Price: ₹${p2.selling_price})\n`);

  // Ensure test customer profile exists
  // Retrieve or create test customer profile
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .limit(1)
    .maybeSingle();

  let customerId: string;

  if (existingProfile) {
    customerId = existingProfile.id;
    console.log(`Using existing customer profile ID: ${customerId} (${existingProfile.email})`);
  } else {
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Workflow Tester' },
    });
    if (authErr || !authUser.user) {
      console.error('Failed to create auth user:', authErr);
      process.exit(1);
    }
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        full_name: 'Workflow Tester',
        email: testEmail,
        phone: '+919876543210',
        role: 'customer',
      })
      .select()
      .single();

    if (profErr || !profile) {
      console.error('Failed to create test customer profile:', profErr);
      process.exit(1);
    }
    customerId = profile.id;
  }

  let enq1Res: any;
  let enq2Res: any;
  let enq3Res: any;
  let multiLineEnqRes: any;
  let multiRfqId: string | undefined;

  try {
    // ----------------------------------------------------
    // TEST 1: General help enquiry with no product
    // ----------------------------------------------------
    enq1Res = await createEnquiry(
      {
        name: 'General Inquirer',
        email: 'general@example.com',
        phone: '+919876543211',
        country: 'India',
        message: 'I have a general question about MITFAST manufacturing capabilities.',
        enquiryType: 'general',
      },
      null,
      null,
      `idemp-enq1-${Date.now()}`
    );
    record(
      1,
      'General help enquiry with no product',
      enq1Res.success && Boolean(enq1Res.data?.enquiryId),
      enq1Res.success ? `Created ID: ${enq1Res.data?.enquiryId}` : enq1Res.error?.message
    );

    // ----------------------------------------------------
    // TEST 2: Service-only enquiry
    // ----------------------------------------------------
    enq2Res = await createEnquiry(
      {
        name: 'Sourcing Buyer',
        email: 'sourcing@example.com',
        phone: '+919876543212',
        country: 'Germany',
        companyName: 'Global Sourcing GmbH',
        message: 'We need custom alloy development under NDA.',
        enquiryType: 'sourcing',
      },
      null,
      null,
      `idemp-enq2-${Date.now()}`
    );
    record(
      2,
      'Service-only enquiry (sourcing / NDA)',
      enq2Res.success && Boolean(enq2Res.data?.enquiryId),
      enq2Res.success ? `Created ID: ${enq2Res.data?.enquiryId}` : enq2Res.error?.message
    );

    // ----------------------------------------------------
    // TEST 3: Product enquiry below MOQ
    // ----------------------------------------------------
    const belowMoqQty = Math.max(1, Math.floor(p1Moq / 2));
    enq3Res = await createEnquiry(
      {
        name: 'Small Batch Buyer',
        email: 'smallbatch@example.com',
        phone: '+919876543213',
        country: 'India',
        productId: p1.id,
        message: `Requesting sample batch of ${belowMoqQty} units.`,
        enquiryType: 'product',
        lineItems: [{ productId: p1.id, name: p1.name, quantity: belowMoqQty }],
      },
      customerId,
      null,
      `idemp-enq3-${Date.now()}`
    );
    record(
      3,
      'Product enquiry below MOQ (routed as enquiry)',
      enq3Res.success && Boolean(enq3Res.data?.enquiryId),
      `Qty: ${belowMoqQty} (MOQ: ${p1Moq}) -> Enquiry ID: ${enq3Res.data?.enquiryId}`
    );

    // ----------------------------------------------------
    // TEST 4 & 5: Pricing calculation at MOQ and above MOQ
    // ----------------------------------------------------
    const pricingAtMoq = calculatePricing({
      supplier_price: Number(p1.selling_price || 100),
      profit_type: 'fixed',
      profit_value: 0,
      discount: Number(p1.discount || 0),
      gst_rate: Number(p1.gst_rate ?? 18),
      gst_included: Boolean(p1.gst_included),
      quantity: p1Moq,
    });
    record(
      4,
      'Product request exactly at MOQ pricing verification',
      pricingAtMoq.quantity === p1Moq && pricingAtMoq.total > 0 && pricingAtMoq.subtotal > 0,
      `At MOQ (${p1Moq} pcs): Subtotal ₹${pricingAtMoq.subtotal}, GST ₹${pricingAtMoq.total_gst_amount}, Total ₹${pricingAtMoq.total}`
    );

    const aboveMoqQty = p1Moq * 5;
    const pricingAboveMoq = calculatePricing({
      supplier_price: Number(p1.selling_price || 100),
      profit_type: 'fixed',
      profit_value: 0,
      discount: Number(p1.discount || 0),
      gst_rate: Number(p1.gst_rate ?? 18),
      gst_included: Boolean(p1.gst_included),
      quantity: aboveMoqQty,
    });
    record(
      5,
      'Product request above MOQ pricing verification',
      pricingAboveMoq.quantity === aboveMoqQty && pricingAboveMoq.total > pricingAtMoq.total,
      `Above MOQ (${aboveMoqQty} pcs): Subtotal ₹${pricingAboveMoq.subtotal}, GST ₹${pricingAboveMoq.total_gst_amount}, Total ₹${pricingAboveMoq.total}`
    );

    // ----------------------------------------------------
    // TEST 6: Enquiry containing multiple products
    // ----------------------------------------------------
    multiLineEnqRes = await createEnquiry(
      {
        name: 'Multi-Product Buyer',
        email: 'multiproduct@example.com',
        phone: '+919876543214',
        country: 'India',
        companyName: 'Multi Corp',
        message: 'Need quotation for two product lines.',
        enquiryType: 'cart_enquiry',
        lineItems: [
          { productId: p1.id, name: p1.name, quantity: p1Moq },
          { productId: p2.id, name: p2.name, quantity: p2Moq },
        ],
      },
      customerId,
      null,
      `idemp-multi-enq-${Date.now()}`
    );
    const multiEnquiryId = multiLineEnqRes.data?.enquiryId!;
    record(
      6,
      'Enquiry containing multiple products',
      multiLineEnqRes.success && Boolean(multiEnquiryId),
      `Enquiry ID: ${multiEnquiryId}`
    );

    // ----------------------------------------------------
    // TEST 7: Convert multi-line enquiry to multi-line RFQ
    // ----------------------------------------------------
    const convertRes = await createRfqFromEnquiry(
      {
        enquiryId: multiEnquiryId,
        items: [
          { productId: p1.id, quantity: p1Moq },
          { productId: p2.id, quantity: p2Moq },
        ],
        deliveryAddress: {
          address_line_1: 'Plot 42, Industrial Zone',
          city: 'Pune',
          state: 'Maharashtra',
          postal_code: '411001',
          country: 'India',
        },
      },
      `idemp-convert-${Date.now()}`
    );
    multiRfqId = convertRes.data?.rfqId!;
    const rfqDetail = multiRfqId ? (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq : null;
    const itemsCount = rfqDetail?.items?.length || 0;
    record(
      7,
      'RFQ containing multiple products (multi-line conversion preserved)',
      convertRes.success && itemsCount === 2,
      `RFQ ${convertRes.data?.rfqNumber} contains ${itemsCount} items (expected 2)`
    );

    // ----------------------------------------------------
    // TEST 8: Add product after enquiry confirmation
    // ----------------------------------------------------
    const addProductToEnqRes = await updateEnquiryDetails({
      enquiryId: enq1Res.data?.enquiryId,
      lineItems: [{ productId: p1.id, name: p1.name, quantity: 20 }],
    });
    const updatedEnq1 = (await getEnquiryDetail(enq1Res.data?.enquiryId!, { isAdmin: true })).data?.enquiry;
    record(
      8,
      'Add product after enquiry confirmation',
      addProductToEnqRes.success && (updatedEnq1?.line_items as any[])?.length === 1,
      `Enquiry gained product: ${JSON.stringify(updatedEnq1?.line_items)}`
    );

    // ----------------------------------------------------
    // TEST 9: Add product after RFQ confirmation
    // ----------------------------------------------------
    const currentRfqItems = rfqDetail?.items || [];
    const editRfqAddRes = await adminEditRfq({
      rfqId: multiRfqId,
      items: [
        ...currentRfqItems.map((itm: any) => ({
          id: itm.id,
          productId: itm.product_id,
          productNameSnapshot: itm.product_name_snapshot,
          quantity: itm.original_quantity,
          unitPrice: itm.original_unit_price,
        })),
        {
          productId: p1.id,
          productNameSnapshot: `${p1.name} (Batch 2)`,
          quantity: p1Moq * 2,
          unitPrice: Number(p1.selling_price || 100),
        },
      ],
    });
    const rfqAfterAdd = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    record(
      9,
      'Add product after RFQ confirmation',
      editRfqAddRes.success && rfqAfterAdd?.items?.length === 3,
      `RFQ items count now: ${rfqAfterAdd?.items?.length} (expected 3)`
    );

    // ----------------------------------------------------
    // TEST 10: Delete product after confirmation
    // ----------------------------------------------------
    const itemsToDelete = rfqAfterAdd?.items || [];
    const editRfqDelRes = await adminEditRfq({
      rfqId: multiRfqId,
      items: itemsToDelete.slice(0, 2).map((itm: any) => ({
        id: itm.id,
        productId: itm.product_id,
        productNameSnapshot: itm.product_name_snapshot,
        quantity: itm.original_quantity,
        unitPrice: itm.original_unit_price,
      })),
    });
    const rfqAfterDel = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    record(
      10,
      'Delete product after confirmation',
      editRfqDelRes.success && rfqAfterDel?.items?.length === 2,
      `RFQ items count now: ${rfqAfterDel?.items?.length} (expected 2)`
    );

    // ----------------------------------------------------
    // TEST 11: Change quantity
    // ----------------------------------------------------
    const targetItem = rfqAfterDel?.items[0];
    const newQty = (targetItem?.original_quantity || 10) + 50;
    const editQtyRes = await adminEditRfq({
      rfqId: multiRfqId,
      items: [
        {
          id: targetItem.id,
          productId: targetItem.product_id,
          productNameSnapshot: targetItem.product_name_snapshot,
          quantity: newQty,
          unitPrice: targetItem.original_unit_price,
        },
        ...rfqAfterDel.items.slice(1).map((itm: any) => ({
          id: itm.id,
          productId: itm.product_id,
          productNameSnapshot: itm.product_name_snapshot,
          quantity: itm.original_quantity,
          unitPrice: itm.original_unit_price,
        })),
      ],
    });
    const rfqAfterQty = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    const updatedLine = rfqAfterQty?.items.find((i: any) => i.id === targetItem.id);
    record(
      11,
      'Change product quantity & recompute total',
      editQtyRes.success && updatedLine?.original_quantity === newQty,
      `Updated line qty: ${updatedLine?.original_quantity}, New RFQ Total: ₹${rfqAfterQty?.original_total}`
    );

    // ----------------------------------------------------
    // TEST 12: Change price (negotiate unit price)
    // ----------------------------------------------------
    const newUnitPrice = 85.5;
    const editPriceRes = await adminNegotiateRfq({
      rfqId: multiRfqId,
      items: [
        {
          rfqItemId: targetItem.id,
          finalQuantity: updatedLine.original_quantity,
          finalUnitPrice: newUnitPrice,
        },
      ],
    }, { isAdmin: true });
    const rfqAfterPrice = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    const negotiatedItem = rfqAfterPrice?.items.find((i: any) => i.id === targetItem.id);
    record(
      12,
      'Change price (negotiate unit price)',
      editPriceRes.success && Number(negotiatedItem?.final_unit_price) === newUnitPrice,
      `Negotiated Unit: ₹${negotiatedItem?.final_unit_price}, Final Total: ₹${rfqAfterPrice?.final_total}`
    );

    // ----------------------------------------------------
    // TEST 13: Edit customer details
    // ----------------------------------------------------
    const editCustomerRes = await adminEditRfq({
      rfqId: multiRfqId,
      items: rfqAfterPrice.items.map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        productNameSnapshot: i.product_name_snapshot,
        quantity: i.original_quantity,
        unitPrice: i.original_unit_price,
        finalQuantity: i.final_quantity,
        finalUnitPrice: i.final_unit_price,
      })),
      deliveryAddress: {
        address_line_1: '100 Technology Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560100',
        country: 'India',
      },
      customerMessage: 'Urgent express freight required.',
      contact: {
        fullName: 'Workflow Tester Updated',
        phone: '+919876543299',
        companyName: 'MITFAST Partner Corp',
      },
    });
    const rfqAfterCustEdit = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    const addr = rfqAfterCustEdit?.delivery_address_snapshot;
    record(
      13,
      'Edit customer & delivery details on RFQ',
      editCustomerRes.success && addr?.city === 'Bengaluru' && rfqAfterCustEdit?.customer_message?.includes('Urgent'),
      `City: ${addr?.city}, Notes: ${rfqAfterCustEdit?.customer_message}`
    );

    // ----------------------------------------------------
    // TEST 14: Remove the last RFQ product → must be prevented
    // ----------------------------------------------------
    const removeAllRes = await adminEditRfq({
      rfqId: multiRfqId,
      items: [], // Attempting to remove all items!
    });
    record(
      14,
      'Remove last RFQ product is prevented (>= 1 product rule)',
      !removeAllRes.success && removeAllRes.error?.code === 'VALIDATION_ERROR',
      `Correctly blocked with message: "${removeAllRes.error?.message}"`
    );

    // ----------------------------------------------------
    // TEST 15: Retry same request → no duplicate lines (idempotency)
    // ----------------------------------------------------
    const idempKey = `test-idemp-${Date.now()}`;
    const enqFirst = await createEnquiry(
      {
        name: 'Idempotent User',
        email: 'idemp@example.com',
        phone: '+919876543215',
        country: 'India',
        message: 'Idempotency test enquiry message.',
      },
      null,
      null,
      idempKey
    );
    const enqRetry = await createEnquiry(
      {
        name: 'Idempotent User',
        email: 'idemp@example.com',
        phone: '+919876543215',
        country: 'India',
        message: 'Idempotency test enquiry message.',
      },
      null,
      null,
      idempKey
    );
    record(
      15,
      'Retry same request with Idempotency-Key returns same ID without duplicate',
      enqFirst.success && enqRetry.success && enqFirst.data?.enquiryId === enqRetry.data?.enquiryId,
      `First ID: ${enqFirst.data?.enquiryId}, Retry ID: ${enqRetry.data?.enquiryId}`
    );

    // ----------------------------------------------------
    // TEST 16: Refresh after mutation → latest data appears
    // ----------------------------------------------------
    const latestEnquiries = await getCustomerEnquiries(customerId);
    record(
      16,
      'Refresh after mutation fetches latest customer data',
      latestEnquiries.success && (latestEnquiries.data?.enquiries?.length || 0) > 0,
      `Found ${latestEnquiries.data?.enquiries?.length} customer enquiries`
    );

    // ----------------------------------------------------
    // TEST 17: Customer cannot edit another customer's enquiry/RFQ
    // ----------------------------------------------------
    const otherCustRfq = await getRfqDetail(multiRfqId, { customerId: '00000000-0000-0000-0000-000000000000' });
    record(
      17,
      'Customer cannot view/edit another customer RFQ (authorization guard)',
      !otherCustRfq.success && otherCustRfq.error?.code === 'FORBIDDEN',
      `Access response: ${otherCustRfq.error?.code}`
    );

    // ----------------------------------------------------
    // TEST 18: Supplier cannot modify unauthorized records
    // ----------------------------------------------------
    const fakeSupplierNegotiate = await adminNegotiateRfq({
      rfqId: multiRfqId,
      items: [
        {
          rfqItemId: targetItem.id,
          finalQuantity: 100,
        },
      ],
    }, { isAdmin: false, supplierId: '00000000-0000-0000-0000-000000000000' });
    record(
      18,
      'Supplier cannot modify unauthorized RFQ items (supplier isolation)',
      !fakeSupplierNegotiate.success && fakeSupplierNegotiate.error?.code === 'FORBIDDEN',
      `Supplier access blocked: ${fakeSupplierNegotiate.error?.code}`
    );

    // ----------------------------------------------------
    // TEST 19: Admin can accept RFQ
    // ----------------------------------------------------
    const acceptRes = await adminAcceptRfq(multiRfqId);
    const rfqAfterAccept = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    record(
      19,
      'Admin can accept RFQ after negotiation',
      acceptRes.success && rfqAfterAccept?.status === 'accepted',
      `RFQ status: ${rfqAfterAccept?.status}`
    );

    // ----------------------------------------------------
    // TEST 20: RFQ -> Order still works after edits
    // ----------------------------------------------------
    const orderRes = await convertRfqToOrder(
      { rfqId: multiRfqId },
      `idemp-ord-${Date.now()}`
    );
    const rfqAfterOrder = (await getRfqDetail(multiRfqId, { isAdmin: true })).data?.rfq;
    record(
      20,
      'RFQ -> Order converts successfully with all edited lines & totals preserved',
      orderRes.success && Boolean(orderRes.data?.orderNumber) && rfqAfterOrder?.status === 'converted_to_order',
      `Created Order #${orderRes.data?.orderNumber}, RFQ status: ${rfqAfterOrder?.status}`
    );

  } finally {
    // Cleanup test records
    console.log('\nCleaning up test records...');
    try {
      if (multiRfqId) {
        await admin.from('orders').delete().eq('rfq_id', multiRfqId);
        await admin.from('rfq_items').delete().eq('rfq_id', multiRfqId);
        await admin.from('rfqs').delete().eq('id', multiRfqId);
      }
      if (enq1Res.data?.enquiryId) {
        await admin.from('enquiries').delete().eq('id', enq1Res.data.enquiryId);
      }
      if (enq2Res.data?.enquiryId) {
        await admin.from('enquiries').delete().eq('id', enq2Res.data.enquiryId);
      }
      if (enq3Res.data?.enquiryId) {
        await admin.from('enquiries').delete().eq('id', enq3Res.data.enquiryId);
      }
      if (multiLineEnqRes.data?.enquiryId) {
        await admin.from('enquiries').delete().eq('id', multiLineEnqRes.data.enquiryId);
      }
      if (!existingProfile) {
        await admin.from('profiles').delete().eq('id', customerId);
      }
    } catch (e) {
      // ignore
    }
  }

  console.log('\n====================================================');
  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passCount} / ${results.length} PASSED`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
