type CartLineLike = {
  quantity: number;
  subtotalPerUnit?: number;
  itemTotal?: number;
  product?: {
    isAvailable?: boolean;
    actualUnitPrice?: number;
    sellingPrice?: number;
    discount?: number;
  };
};

export function sumCartQuantities(items: CartLineLike[]): number {
  return items.reduce((acc, item) => acc + (item.quantity || 0), 0);
}

export function computeOptimisticSubtotal(items: CartLineLike[]): number {
  return Math.round(
    items.reduce((acc, item) => {
      const perUnit =
        item.subtotalPerUnit ??
        (item.quantity > 0 && item.itemTotal != null
          ? item.itemTotal / item.quantity
          : item.product?.actualUnitPrice ?? 0);
      return acc + perUnit * item.quantity;
    }, 0) * 100
  ) / 100;
}

export function computeOptimisticLineTotal(item: CartLineLike, quantity: number): number {
  const perUnit =
    item.subtotalPerUnit ??
    (item.quantity > 0 && item.itemTotal != null
      ? item.itemTotal / item.quantity
      : item.product?.actualUnitPrice ?? 0);
  return Math.round(perUnit * quantity * 100) / 100;
}

export function gstLabelFromItems(
  items: CartLineLike[],
  fallbackRate = 0
): string {
  const available = items.filter((i) => i.product?.isAvailable !== false);
  if (available.length === 0) return 'Estimated GST';

  const rates = new Set(
    available.map((i) => {
      const p = i.product as { gstRate?: number } | undefined;
      return p?.gstRate ?? fallbackRate;
    })
  );

  if (rates.size === 1) {
    const rate = [...rates][0];
    return rate > 0 ? `Estimated GST (${rate}% B2B)` : 'GST (0% Exempt)';
  }
  return 'Estimated GST';
}
