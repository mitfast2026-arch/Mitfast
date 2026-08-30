import type { ProfitType } from '@/types/database';

export interface PricingInput {
  supplier_price: number;
  profit_type: ProfitType;
  profit_value: number;
  discount?: number;
  gst_rate: number;
  gst_included: boolean;
  quantity?: number;
}

export interface PricingOutput {
  supplier_price: number;
  profit_amount: number;
  selling_price: number;
  discount: number;
  discounted_unit_price: number;
  gst_rate: number;
  gst_included: boolean;
  gst_amount_per_unit: number;
  final_unit_price: number;
  quantity: number;
  subtotal: number;
  total_gst_amount: number;
  total: number;
}

/**
 * Safely parses any value into a finite number.
 */
export function safeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Rounds a number to exactly two decimal places avoiding floating-point inaccuracies.
 */
export function roundCurrency(amount: number): number {
  const num = safeNumber(amount);
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Centralized pricing engine for the MITFAST platform.
 * Single source of truth for all product pricing, RFQ estimates, and order computations.
 * Always operates on the product's own per-product GST rate and inclusion mode.
 */
export function calculatePricing(input: PricingInput): PricingOutput {
  const supplierPrice = Math.max(0, safeNumber(input.supplier_price));
  const profitValue = Math.max(0, safeNumber(input.profit_value));
  const discount = Math.max(0, safeNumber(input.discount, 0));
  const gstRate = Math.max(0, Math.min(100, safeNumber(input.gst_rate, 0)));
  const gstIncluded = Boolean(input.gst_included);
  const quantity = Math.max(1, Math.floor(safeNumber(input.quantity, 1)));

  // 1. Calculate profit amount & base selling price
  let profitAmount = 0;
  if (input.profit_type === 'percentage') {
    profitAmount = roundCurrency(supplierPrice * (profitValue / 100));
  } else {
    profitAmount = roundCurrency(profitValue);
  }

  const sellingPrice = roundCurrency(supplierPrice + profitAmount);

  // 2. Apply discount
  const discountedUnitPrice = roundCurrency(Math.max(0, sellingPrice - discount));

  // 3. Calculate GST and final customer unit price
  let gstAmountPerUnit = 0;
  let finalUnitPrice = 0;
  let subtotalPerUnit = 0;

  if (gstIncluded) {
    // Total price already contains GST
    finalUnitPrice = discountedUnitPrice;
    if (gstRate > 0) {
      gstAmountPerUnit = roundCurrency(
        discountedUnitPrice - discountedUnitPrice / (1 + gstRate / 100)
      );
      subtotalPerUnit = roundCurrency(discountedUnitPrice - gstAmountPerUnit);
    } else {
      gstAmountPerUnit = 0;
      subtotalPerUnit = discountedUnitPrice;
    }
  } else {
    // GST is added on top of the discounted price
    subtotalPerUnit = discountedUnitPrice;
    if (gstRate > 0) {
      gstAmountPerUnit = roundCurrency(discountedUnitPrice * (gstRate / 100));
      finalUnitPrice = roundCurrency(discountedUnitPrice + gstAmountPerUnit);
    } else {
      gstAmountPerUnit = 0;
      finalUnitPrice = discountedUnitPrice;
    }
  }

  // 4. Calculate line item totals
  const subtotal = roundCurrency(subtotalPerUnit * quantity);
  const totalGstAmount = roundCurrency(gstAmountPerUnit * quantity);
  const total = roundCurrency(finalUnitPrice * quantity);

  return {
    supplier_price: supplierPrice,
    profit_amount: profitAmount,
    selling_price: sellingPrice,
    discount,
    discounted_unit_price: discountedUnitPrice,
    gst_rate: gstRate,
    gst_included: gstIncluded,
    gst_amount_per_unit: gstAmountPerUnit,
    final_unit_price: finalUnitPrice,
    quantity,
    subtotal,
    total_gst_amount: totalGstAmount,
    total,
  };
}
