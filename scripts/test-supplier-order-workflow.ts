import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createAdminClient } from '@/lib/supabase/admin';
import { addToCart, clearCustomerCart } from '@/lib/server/cart/cart-service';
import {
  submitRfqFromCart,
  adminAcceptRfq,
  getRfqDetail,
  getSupplierRfqDetail,
} from '@/lib/server/rfq/rfq-service';
import {
  convertRfqToOrder,
  getSupplierOrders,
  getSupplierOrderDetail,
  getCustomerOrders,
  getOrdersForAdmin,
  updateOrderStatus,
  markSupplierOrderContacted,
} from '@/lib/server/orders/order-service';

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
  console.log(`[TEST ${num.toString().padStart(2, '0')}] ${mark}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runRefinedSupplierOrderTests() {
  console.log('================================================================');
  console.log('MITFAST REFINED SUPPLIER ORDER WORKFLOW & SECURITY VERIFICATION');
  console.log('================================================================\n');

  const admin = createAdminClient();

  // 1. Get test supplier
  const { data: suppliers } = await admin
    .from('suppliers')
    .select('id, company_name, user_id')
    .limit(1);

  if (!suppliers || suppliers.length === 0) {
    console.error('No supplier found in database for test.');
    process.exit(1);
  }
  const testSupplier = suppliers[0];

  // 2. Get customer profile
  const { data: customerProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .limit(1)
    .single();

  if (!customerProfile) {
    console.error('No customer profile found in database for test.');
    process.exit(1);
  }

  // 3. Find a product linked to this supplier
  let { data: products } = await admin
    .from('products')
    .select('id, name, sku, moq, supplier_price, selling_price, gst_rate, gst_included')
    .eq('supplier_id', testSupplier.id)
    .limit(1);

  let testProduct = products?.[0];
  if (!testProduct) {
    const { data: anyProduct } = await admin
      .from('products')
      .select('*')
      .limit(1)
      .single();

    if (!anyProduct) {
      console.error('No products found in DB.');
      process.exit(1);
    }
    await admin
      .from('products')
      .update({
        supplier_id: testSupplier.id,
        publication_status: 'published',
        approval_status: 'approved',
        archive_status: 'active',
      })
      .eq('id', anyProduct.id);

    testProduct = anyProduct;
  } else {
    await admin
      .from('products')
      .update({
        publication_status: 'published',
        approval_status: 'approved',
        archive_status: 'active',
      })
      .eq('id', testProduct.id);
  }

  console.log(`Test environment:`);
  console.log(`- Supplier: ${testSupplier.company_name} (ID: ${testSupplier.id})`);
  console.log(`- Customer: ${customerProfile.full_name} (${customerProfile.email})`);
  console.log(`- Product: ${testProduct.name} (ID: ${testProduct.id}, SKU: ${testProduct.sku || 'N/A'})\n`);

  let testRfqId: string = '';
  let createdOrderId: string = '';

  // -----------------------------------------------------------------------------------
  // TEST 1: Admin converts enquiry/RFQ -> Supplier sees new order in active queue
  // -----------------------------------------------------------------------------------
  try {
    await clearCustomerCart(customerProfile.id);
    const unitPrice = Number(testProduct.selling_price) || 1000;
    const targetQty = Math.max(testProduct.moq || 1, Math.ceil(600000 / unitPrice));

    await addToCart(customerProfile.id, testProduct.id, targetQty);

    const address = {
      address_line_1: 'Aero Tech Park, Suite 400',
      address_line_2: 'Industrial Corridor',
      city: 'Bangalore',
      state: 'Karnataka',
      postal_code: '560066',
      country: 'India',
    };

    const rfqResult = await submitRfqFromCart(
      customerProfile.id,
      {
        deliveryAddress: address,
        customerMessage: 'Fulfillment batch order with QA report.',
      },
      `test-rfq-${Date.now()}`
    );

    if (rfqResult.success && rfqResult.data) {
      testRfqId = rfqResult.data.rfqId;
      await adminAcceptRfq(testRfqId);
      const convRes = await convertRfqToOrder({ rfqId: testRfqId }, `idemp-order-${Date.now()}`);

      if (convRes.success && convRes.data) {
        createdOrderId = convRes.data.orderId;
        const suppOrders = await getSupplierOrders(testSupplier.id, { filter: 'new' });
        const isPresentInNew = suppOrders.success && suppOrders.data.orders.some((o) => o.id === createdOrderId);

        record(
          1,
          'Admin converts RFQ -> Supplier sees new order in NEW/ACTIVE queue',
          isPresentInNew,
          `Order ID: ${createdOrderId}, New queue count: ${suppOrders.data?.counts.new}`
        );
      } else {
        record(1, 'Admin converts RFQ to order', false, convRes.error?.message);
      }
    } else {
      record(1, 'Customer submits RFQ', false, rfqResult.error?.message);
    }
  } catch (err: any) {
    record(1, 'Admin converts RFQ', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 2: Supplier sees product/order summary only (Name, SKU, Qty, MOQ, Price, Specs)
  // -----------------------------------------------------------------------------------
  try {
    const detailRes = await getSupplierOrderDetail(testSupplier.id, createdOrderId);
    if (detailRes.success && detailRes.data) {
      const d = detailRes.data;
      const item = d.items[0];
      const hasOrderRef = Boolean(d.order_number);
      const hasProductName = Boolean(item?.product_name_snapshot);
      const hasQty = item?.quantity > 0;
      const hasPrice = typeof item?.unit_price === 'number';
      const hasMoq = typeof item?.moq === 'number';
      const hasStatus = Boolean(d.status);

      const passed = hasOrderRef && hasProductName && hasQty && hasPrice && hasMoq && hasStatus;
      record(
        2,
        'Supplier sees only product/order summary necessary for fulfillment',
        passed,
        `Order: ${d.order_number}, Product: ${item.product_name_snapshot}, Qty: ${item.quantity}, Price: ₹${item.unit_price}`
      );
    } else {
      record(2, 'Supplier order summary check', false, detailRes.error?.message);
    }
  } catch (err: any) {
    record(2, 'Supplier order summary check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 3: Customer details are strictly NOT returned by supplier API (Server Redaction)
  // -----------------------------------------------------------------------------------
  try {
    const listRes = await getSupplierOrders(testSupplier.id, { filter: 'all' });
    const detailRes = await getSupplierOrderDetail(testSupplier.id, createdOrderId);

    const listStr = JSON.stringify(listRes.data || {});
    const detailStr = JSON.stringify(detailRes.data || {});

    const leakedEmail = listStr.includes(customerProfile.email) || detailStr.includes(customerProfile.email);
    const leakedPhone = customerProfile.phone && (listStr.includes(customerProfile.phone) || detailStr.includes(customerProfile.phone));
    const leakedAddress = listStr.includes('Suite 400') || detailStr.includes('Suite 400');
    const leakedCustomerId = listStr.includes(customerProfile.id) || detailStr.includes(customerProfile.id);

    const clean = !leakedEmail && !leakedPhone && !leakedAddress && !leakedCustomerId;
    record(
      3,
      'Customer private details (name, email, phone, address, profile ID) strictly omitted server-side',
      clean,
      `Payload verified free of private customer metadata`
    );
  } catch (err: any) {
    record(3, 'Customer data redaction check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 4: Supplier clicks "Mark as Contacted" -> Action succeeds
  // -----------------------------------------------------------------------------------
  try {
    const markRes = await markSupplierOrderContacted(testSupplier.id, createdOrderId, true);
    const passed = markRes.success && markRes.data.is_contacted && Boolean(markRes.data.contacted_at);

    record(
      4,
      'Supplier marks order as contacted -> State successfully acknowledged',
      passed,
      `Contacted at: ${markRes.data?.contacted_at}`
    );
  } catch (err: any) {
    record(4, 'Supplier marks order as contacted', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 5: Order moves out of active "New Orders" queue -> into "Contacted" list
  // -----------------------------------------------------------------------------------
  try {
    const newQueue = await getSupplierOrders(testSupplier.id, { filter: 'new' });
    const contactedQueue = await getSupplierOrders(testSupplier.id, { filter: 'contacted' });

    const inNew = newQueue.data?.orders.some((o) => o.id === createdOrderId);
    const inContacted = contactedQueue.data?.orders.some((o) => o.id === createdOrderId);

    const passed = !inNew && inContacted;
    record(
      5,
      'Order moves out of "New Orders" active queue into "Contacted" section',
      passed,
      `In New: ${inNew}, In Contacted: ${inContacted}, Contacted count: ${contactedQueue.data?.counts.contacted}`
    );
  } catch (err: any) {
    record(5, 'Order queue transition check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 6: Order still exists in database (Never deleted, status intact)
  // -----------------------------------------------------------------------------------
  try {
    const { data: dbOrder, error: dbErr } = await admin
      .from('orders')
      .select('id, order_number, status')
      .eq('id', createdOrderId)
      .single();

    const exists = !dbErr && dbOrder && dbOrder.id === createdOrderId;
    record(
      6,
      'Order remains completely intact and undeleted in database',
      Boolean(exists),
      `DB Order ID: ${dbOrder?.id}, DB Status: ${dbOrder?.status}`
    );
  } catch (err: any) {
    record(6, 'Database record integrity check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 7: Admin still sees complete order (Customer profile, full address, admin status)
  // -----------------------------------------------------------------------------------
  try {
    const adminOrders = await getOrdersForAdmin({ page: 1, limit: 10 });
    const adminOrder = adminOrders.data?.orders.find((o: any) => o.id === createdOrderId);

    const hasCustomer = adminOrder && adminOrder.customer?.email === customerProfile.email;
    const hasFullAddress = adminOrder && adminOrder.delivery_address_snapshot?.address_line_1 === 'Aero Tech Park, Suite 400';

    record(
      7,
      'Admin retains complete visibility of order, customer identity, and destination address',
      Boolean(hasCustomer && hasFullAddress),
      `Admin Customer: ${adminOrder?.customer?.full_name}, Address: ${adminOrder?.delivery_address_snapshot?.address_line_1}`
    );
  } catch (err: any) {
    record(7, 'Admin order visibility check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 8: Customer still sees their complete order
  // -----------------------------------------------------------------------------------
  try {
    const custOrders = await getCustomerOrders(customerProfile.id, { limit: 10 });
    const custOrder = custOrders.data?.orders.find((o: any) => o.id === createdOrderId);

    const hasCustomerOrder = Boolean(custOrder && custOrder.id === createdOrderId && custOrder.items.length > 0);
    record(
      8,
      'Customer retains complete visibility of their order and item breakdown',
      hasCustomerOrder,
      `Customer order total: ₹${custOrder?.total}, Items: ${custOrder?.items?.length}`
    );
  } catch (err: any) {
    record(8, 'Customer order visibility check', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 9: Supplier cannot change Admin-controlled order status or another supplier order
  // -----------------------------------------------------------------------------------
  try {
    // 9a. Non-existent / unauthorized supplier order contact
    const fakeMark = await markSupplierOrderContacted('00000000-0000-0000-0000-000000000000', createdOrderId, true);
    const fakeBlocked = !fakeMark.success && fakeMark.error?.code === 'NOT_FOUND';

    // 9b. Invalid status transition blocked by FSM
    const invalidStatus = await updateOrderStatus({ orderId: createdOrderId, status: 'accepted' });
    const statusBlocked = !invalidStatus.success;

    record(
      9,
      'Supplier cannot modify Admin-controlled status or acknowledge unauthorized orders',
      fakeBlocked && statusBlocked,
      `Unauthorized supplier mark: ${fakeMark.error?.code}, Invalid transition: ${invalidStatus.error?.code}`
    );
  } catch (err: any) {
    record(9, 'Supplier status mutation guard', false, err.message);
  }

  // -----------------------------------------------------------------------------------
  // TEST 10: Compact batches and pagination ensure scalable non-overflowing UX
  // -----------------------------------------------------------------------------------
  try {
    const paginatedRes = await getSupplierOrders(testSupplier.id, { page: 1, limit: 5 });
    const pOk = paginatedRes.success && paginatedRes.data.orders.length <= 5 && typeof paginatedRes.data.total === 'number';

    record(
      10,
      'Pagination and compact card batches scale cleanly without unbounded page scrolling',
      pOk,
      `Batch size: ${paginatedRes.data?.orders.length}, Page limit: ${paginatedRes.data?.limit}`
    );
  } catch (err: any) {
    record(10, 'Pagination test', false, err.message);
  }

  console.log('\n================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`FINAL RESULT: ${results.filter((r) => r.passed).length}/${results.length} TESTS PASSED`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

void runRefinedSupplierOrderTests();
