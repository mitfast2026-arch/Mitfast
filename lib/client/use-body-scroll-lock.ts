'use client';

import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow: string | null = null;

/**
 * Ref-counted body scroll lock. Nested overlays share one lock; overflow is
 * restored only when the last overlay unmounts or unlocks.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow ?? '';
        previousOverflow = null;
      }
    };
  }, [locked]);
}
