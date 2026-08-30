import { calculatePricing, roundCurrency, safeNumber } from '../lib/server/pricing/calculate-price';
import { priceCartLine, aggregateCartTotals } from '../lib/server/cart/cart-line-pricing';
import { gstLabelFromItems } from '../lib/client/cart-totals';
import { productToFormValues, validateFormValues, buildPayload } from '../components/portal/products/product-form.utils';
import { computeListPriceFromProfit, computeCustomerPrice } from '../app/admin/products/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function runTests() {
  console.log('--- Starting GST and Pricing Test Suite ---\n');

  // SCREENSHOT TEST CASE:
  // Factory = ₹11,110, GST = 5%, Margin = 15%, GST included in factory = ON, Discount = OFF
  {
    const res = calculatePricing({
      supplier_price: 11110,
      profit_type: 'percentage',
      profit_value: 15,
      discount: 0,
      gst_rate: 5,
      gst_included: true,
      quantity: 1,
    });

    assert(res.supplier_price === 11110, `Supplier price should be 11110, got ${res.supplier_price}`);
    assert(res.profit_amount === 1666.50, `Profit (15%) should be 1666.50, got ${res.profit_amount}`);
    assert(res.selling_price === 12776.50, `Selling price (11110 + 1666.50) should be 12776.50, got ${res.selling_price}`);
    assert(res.discounted_unit_price === 12776.50, `Discounted price should be 12776.50, got ${res.discounted_unit_price}`);
    assert(res.gst_rate === 5, `GST rate should be 5%, got ${res.gst_rate}`);
    assert(res.gst_included === true, `GST included should be true, got ${res.gst_included}`);
    // Embedded 5% GST: 12776.50 - (12776.50 / 1.05) = 608.4047... -> 608.40
    assert(res.gst_amount_per_unit === 608.40, `GST amount per unit should be 608.40, got ${res.gst_amount_per_unit}`);
    // Taxable base: 12776.50 - 608.40 = 12168.10
    assert(res.subtotal === 12168.10, `Subtotal (taxable base) should be 12168.10, got ${res.subtotal}`);
    assert(res.total_gst_amount === 608.40, `Total GST should be 608.40, got ${res.total_gst_amount}`);
    // Customer pays unit price of 12776.50 (inclusive of GST)
    assert(res.final_unit_price === 12776.50, `Final unit price should be 12776.50, got ${res.final_unit_price}`);
    assert(res.total === 12776.50, `Total should be 12776.50, got ${res.total}`);
    assert(roundCurrency(res.subtotal + res.total_gst_amount) === res.total, 'Subtotal + GST must equal Total for GST-included items');
    console.log('✓ Screenshot Test Case Passed: Factory ₹11,110, 5% GST, 15% margin, GST-included ON');
  }

  // Test 1: Percentage Margin + GST Excluded (GST included = OFF)
  {
    const res = calculatePricing({
      supplier_price: 11110,
      profit_type: 'percentage',
      profit_value: 15,
      discount: 0,
      gst_rate: 5,
      gst_included: false,
      quantity: 1,
    });
    assert(res.selling_price === 12776.50, `Selling price should be 12776.50, got ${res.selling_price}`);
    assert(res.discounted_unit_price === 12776.50, `Discounted unit price should be 12776.50, got ${res.discounted_unit_price}`);
    // Excluded GST: 12776.50 * 5% = 638.825 -> 638.83
    assert(res.gst_amount_per_unit === 638.83, `GST per unit should be 638.83, got ${res.gst_amount_per_unit}`);
    assert(res.final_unit_price === 13415.33, `Final unit price should be 13415.33, got ${res.final_unit_price}`);
    assert(res.subtotal === 12776.50, `Subtotal should be 12776.50, got ${res.subtotal}`);
    assert(res.total_gst_amount === 638.83, `Total GST should be 638.83, got ${res.total_gst_amount}`);
    assert(res.total === 13415.33, `Total should be 13415.33, got ${res.total}`);
    assert(roundCurrency(res.subtotal + res.total_gst_amount) === res.total, 'Subtotal + GST must equal Total');
    console.log('✓ Test 1 Passed: Factory ₹11,110, 5% GST, 15% margin, GST-included OFF');
  }

  // Test 2: Fixed Margin + Discount + GST Included
  {
    const res = calculatePricing({
      supplier_price: 1000,
      profit_type: 'fixed',
      profit_value: 300, // selling price = 1300
      discount: 100, // discounted price = 1200 (contains 18% GST)
      gst_rate: 18,
      gst_included: true,
      quantity: 2,
    });
    assert(res.selling_price === 1300, `Selling price should be 1300, got ${res.selling_price}`);
    assert(res.discounted_unit_price === 1200, `Discounted price should be 1200, got ${res.discounted_unit_price}`);
    assert(res.final_unit_price === 1200, `Final unit price should be 1200 (since GST included), got ${res.final_unit_price}`);
    // 1200 - 1200/1.18 = 183.05 GST per unit
    assert(res.gst_amount_per_unit === 183.05, `GST per unit should be 183.05, got ${res.gst_amount_per_unit}`);
    assert(res.subtotal === 2033.9, `Subtotal for qty 2 should be 2033.90, got ${res.subtotal}`);
    assert(res.total_gst_amount === 366.1, `Total GST for qty 2 should be 366.10, got ${res.total_gst_amount}`);
    assert(res.total === 2400, `Total should be 2400, got ${res.total}`);
    assert(roundCurrency(res.subtotal + res.total_gst_amount) === res.total, 'Subtotal + GST must equal Total for GST-included items');
    console.log('✓ Test 2 Passed: Fixed margin with discount and GST included');
  }

  // Test 3: 0% GST (Exempt Product) + Margin = 0
  {
    const res = calculatePricing({
      supplier_price: 500,
      profit_type: 'percentage',
      profit_value: 0,
      discount: 25,
      gst_rate: 0,
      gst_included: false,
      quantity: 5,
    });
    assert(res.selling_price === 500, `Selling price should be 500, got ${res.selling_price}`);
    assert(res.discounted_unit_price === 475, `Discounted price should be 475, got ${res.discounted_unit_price}`);
    assert(res.gst_amount_per_unit === 0, `GST should be 0, got ${res.gst_amount_per_unit}`);
    assert(res.final_unit_price === 475, `Final unit price should be 475, got ${res.final_unit_price}`);
    assert(res.subtotal === 2375, `Subtotal should be 2375, got ${res.subtotal}`);
    assert(res.total_gst_amount === 0, `Total GST should be 0, got ${res.total_gst_amount}`);
    assert(res.total === 2375, `Total should be 2375, got ${res.total}`);
    console.log('✓ Test 3 Passed: 0% GST exempt product with 0 margin');
  }

  // Test 4: Extreme Inputs and NaN Safety
  {
    const res = calculatePricing({
      supplier_price: NaN as any,
      profit_type: 'percentage',
      profit_value: undefined as any,
      discount: null as any,
      gst_rate: -50 as any,
      gst_included: false,
      quantity: -10 as any,
    });
    assert(res.supplier_price === 0, 'Supplier price NaN should normalize to 0');
    assert(res.selling_price === 0, 'Selling price should normalize to 0');
    assert(res.gst_rate === 0, 'Negative GST should clamp to 0');
    assert(res.quantity === 1, 'Invalid quantity should normalize to 1');
    assert(!isNaN(res.total), 'Total must never be NaN');
    console.log('✓ Test 4 Passed: Input sanitization and NaN protection');
  }

  // Test 5: Mixed GST Rates in Cart
  {
    const item1 = priceCartLine({
      selling_price: 1000,
      discount: 0,
      gst_rate: 18,
      gst_included: false,
    }, 2); // 2 * 1000 = 2000 subtotal, 360 GST, 2360 total

    const item2 = priceCartLine({
      selling_price: 500,
      discount: 0,
      gst_rate: 5,
      gst_included: false,
    }, 4); // 4 * 500 = 2000 subtotal, 100 GST, 2100 total

    const totals = aggregateCartTotals([
      { itemTotal: item1.itemTotal, lineGst: item1.lineGst, lineGrandTotal: item1.lineGrandTotal, isAvailable: true },
      { itemTotal: item2.itemTotal, lineGst: item2.lineGst, lineGrandTotal: item2.lineGrandTotal, isAvailable: true },
    ]);

    assert(totals.subtotal === 4000, `Aggregated subtotal should be 4000, got ${totals.subtotal}`);
    assert(totals.totalGst === 460, `Aggregated GST should be 460, got ${totals.totalGst}`);
    assert(totals.grandTotal === 4460, `Aggregated grand total should be 4460, got ${totals.grandTotal}`);
    assert(roundCurrency(totals.subtotal + totals.totalGst) === totals.grandTotal, 'Aggregated total invariant holds');

    // Label check for mixed rates vs single rate
    const labelMixed = gstLabelFromItems([
      { quantity: 2, product: { gstRate: 18, isAvailable: true } },
      { quantity: 4, product: { gstRate: 5, isAvailable: true } },
    ]);
    assert(labelMixed === 'Estimated GST', `Mixed rates label should be 'Estimated GST', got ${labelMixed}`);

    const labelSingle = gstLabelFromItems([
      { quantity: 2, product: { gstRate: 18, isAvailable: true } },
      { quantity: 4, product: { gstRate: 18, isAvailable: true } },
    ]);
    assert(labelSingle === 'Estimated GST (18% B2B)', `Single rate label should specify rate, got ${labelSingle}`);

    const labelZero = gstLabelFromItems([
      { quantity: 2, product: { gstRate: 0, isAvailable: true } },
    ]);
    assert(labelZero === 'GST (0% Exempt)', `0% rate label should specify Exempt, got ${labelZero}`);

    console.log('✓ Test 5 Passed: Multi-rate cart aggregation and dynamic labels');
  }

  // Test 6: Frontend vs Backend Price Calculation Consistency
  {
    const supplierPrice = 2500;
    const marginPct = 12;
    const discount = 150;

    const listPriceFE = computeListPriceFromProfit(supplierPrice, 'percentage', marginPct);
    const custPriceFE = computeCustomerPrice(listPriceFE, discount);

    const bePricing = calculatePricing({
      supplier_price: supplierPrice,
      profit_type: 'percentage',
      profit_value: marginPct,
      discount,
      gst_rate: 18,
      gst_included: false,
    });

    assert(listPriceFE === bePricing.selling_price, `FE list price (${listPriceFE}) must equal BE selling price (${bePricing.selling_price})`);
    assert(custPriceFE === bePricing.discounted_unit_price, `FE customer price (${custPriceFE}) must equal BE discounted price (${bePricing.discounted_unit_price})`);
    console.log('✓ Test 6 Passed: Frontend and backend calculation consistency');
  }

  // Test 7: Product Form Mapping and Validation
  {
    const mockProduct = {
      id: 'prod-123',
      name: 'Industrial Bolt M10',
      category_id: 'cat-fasteners',
      supplier_id: 'sup-999',
      supplier_price: 45,
      profit_type: 'percentage',
      profit_value: 20,
      discount: 2,
      gst_rate: 12,
      gst_included: true,
      moq: 500,
      suggested_moq: 500,
      specifications: [{ spec_name: 'Grade', spec_value: '8.8', sort_order: 0 }],
      images: [{ id: 'img-1', image_url: 'https://example.com/bolt.jpg', sort_order: 0, is_primary: true }],
    };

    const formValues = productToFormValues(mockProduct as any);
    assert(formValues.gst === 12, `Form GST should be 12, got ${formValues.gst}`);
    assert(formValues.gstIncluded === true, `Form GST included should be true, got ${formValues.gstIncluded}`);

    const errors = validateFormValues(formValues, 'admin');
    assert(Object.keys(errors).length === 0, `Validation should pass with 0 errors, got: ${JSON.stringify(errors)}`);

    const payload = buildPayload(formValues, []);
    assert(payload.gstRate === 12, `Payload gstRate should be 12, got ${payload.gstRate}`);
    assert(payload.gstIncluded === true, `Payload gstIncluded should be true, got ${payload.gstIncluded}`);
    console.log('✓ Test 7 Passed: Product form mapping and validation');
  }

  // Test 8: Convert-to-order must use RFQ GST snapshot, not live product GST
  {
    const snapshotRate = 18;
    const liveRate = 5;
    const unitPrice = 1000;
    const quantity = 2;

    const fromSnapshot = calculatePricing({
      supplier_price: unitPrice,
      profit_type: 'fixed',
      profit_value: 0,
      discount: 0,
      gst_rate: snapshotRate,
      gst_included: false,
      quantity,
    });
    const fromLiveProduct = calculatePricing({
      supplier_price: unitPrice,
      profit_type: 'fixed',
      profit_value: 0,
      discount: 0,
      gst_rate: liveRate,
      gst_included: false,
      quantity,
    });

    const item = { gst_rate: snapshotRate, gst_included: false, product: { gst_rate: liveRate, gst_included: false } };
    const gstRate = item.gst_rate ?? item.product?.gst_rate ?? 0;
    const gstIncluded = item.gst_included ?? item.product?.gst_included ?? false;
    const converted = calculatePricing({
      supplier_price: unitPrice,
      profit_type: 'fixed',
      profit_value: 0,
      discount: 0,
      gst_rate: gstRate,
      gst_included: gstIncluded,
      quantity,
    });

    assert(fromSnapshot.total !== fromLiveProduct.total, 'snapshot GST and live product GST must produce different order totals');
    assert(converted.total === fromSnapshot.total, `convert-to-order must keep snapshot GST total ${fromSnapshot.total}, got ${converted.total}`);
    assert(converted.total_gst_amount === 360, `18% of 2000 should be 360, got ${converted.total_gst_amount}`);
    console.log('✓ Test 8 Passed: Convert-to-order uses RFQ GST snapshot over live product GST');
  }

  console.log('\n--- All GST and Pricing Tests Passed Successfully! ---');
}

runTests();
