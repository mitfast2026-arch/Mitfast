/**
 * Single-flight client helper for POST /api/guest/merge.
 * Prevents stacked merges from auth + callback + cart on the same session.
 */

let inFlight: Promise<boolean> | null = null;
let mergedThisSession = false;

export async function mergeGuestStateOnce(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (mergedThisSession) return true;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch('/api/guest/merge', { method: 'POST' });
      if (res.ok) {
        mergedThisSession = true;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
