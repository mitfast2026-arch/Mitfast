import { calculatePricing, roundCurrency } from '@/lib/server/pricing/calculate-price';

export type CartProductPricingInput = {
  selling_price: number;
  discount?: number | null;
  gst_rate?: number | null;
  gst_included?: boolean | null;
};

export function priceCartLine(product: CartProductPricingInput, quantity: number) {
  const priced = calculatePricing({
    supplier_price: product.selling_price || 0,
    profit_type: 'fixed',
    profit_value: 0,
    discount: product.discount || 0,
    gst_rate: product.gst_rate || 0,
    gst_included: product.gst_included || false,
    quantity,
  });

  return {
    itemTotal: priced.subtotal,
    subtotalPerUnit:
      quantity > 0 ? roundCurrency(priced.subtotal / quantity) : 0,
    lineGst: priced.total_gst_amount,
    lineGrandTotal: priced.total,
    actualUnitPrice: priced.discounted_unit_price,
  };
}

export function aggregateCartTotals(
  lines: { itemTotal: number; lineGst: number; lineGrandTotal: number; isAvailable: boolean }[]
) {
  let subtotal = 0;
  let totalGst = 0;
  let grandTotal = 0;

  for (const line of lines) {
    if (!line.isAvailable) continue;
    subtotal += line.itemTotal;
    totalGst += line.lineGst;
    grandTotal += line.lineGrandTotal;
  }

  return {
    subtotal: roundCurrency(subtotal),
    totalGst: roundCurrency(totalGst),
    grandTotal: roundCurrency(grandTotal),
  };
}
