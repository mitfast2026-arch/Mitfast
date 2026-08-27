/**
 * Bounded storefront prefetch — warm at most one PDP API at a time on hover/focus.
 * Never prefetch all visible cards (that would create request storms).
 */

let lastPrefetchedId: string | null = null;
const warmed = new Set<string>();

export function prefetchStorefrontProduct(productId: string) {
  if (typeof window === 'undefined' || !productId) return;
  if (warmed.has(productId) || lastPrefetchedId === productId) return;
  lastPrefetchedId = productId;
  warmed.add(productId);
  // Cap memory of warmed ids
  if (warmed.size > 40) {
    const first = warmed.values().next().value;
    if (first) warmed.delete(first);
  }
  void fetch(`/api/products/${productId}`, { priority: 'low' as RequestPriority }).catch(() => {});
}
