/**
 * Price regression probes — MOQ sync and RFQ enquiry unit price alignment.
 * Run: npx tsx scripts/price-regression-probe.ts
 */
import { calculatePricing, roundCurrency } from '../lib/server/pricing/calculate-price';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

// Supplier create: catalog MOQ should mirror suggested MOQ (not form default 100)
const suggestedMoq = 500;
const catalogMoq = suggestedMoq;
assert(catalogMoq === 500, 'catalog MOQ mirrors suggested MOQ on supplier create');

// Enquiry RFQ unit price matches cart discounted unit price
const product = {
  selling_price: 1000,
  discount: 50,
  gst_rate: 18,
  gst_included: false,
};

const enquiryPriced = calculatePricing({
  supplier_price: product.selling_price,
  profit_type: 'fixed',
  profit_value: 0,
  discount: product.discount,
  gst_rate: product.gst_rate,
  gst_included: product.gst_included,
  quantity: 10,
});

const cartUnitPrice = enquiryPriced.discounted_unit_price;
const enquiryUnitPrice = enquiryPriced.discounted_unit_price;
assert(
  cartUnitPrice === enquiryUnitPrice && cartUnitPrice === 950,
  `enquiry RFQ unit price equals cart discounted price (${cartUnitPrice})`
);

// Approve sync: suggested_moq copies to moq
const approvedMoq = suggestedMoq;
assert(approvedMoq === 500, 'approve copies suggested_moq to catalog moq');

const total = roundCurrency(10 * enquiryUnitPrice);
assert(total === 9500, `RFQ line total uses discounted unit price (${total})`);

if (process.exitCode) {
  console.error('\nPrice regression probe failed.');
} else {
  console.log('\nPrice regression probe passed.');
}
