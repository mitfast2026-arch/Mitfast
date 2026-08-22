'use client';

import { useCallback, useRef, useState } from 'react';
import type { MutationErrorKind, MutationResult } from '@/lib/client/api-client';

export type MutationKey = string;

export interface RunMutationOptions<T> {
  /** Unique key for per-entity pending state, e.g. `${productId}:publish` */
  key: MutationKey;
  /** Called immediately before the request (for safe optimistic updates) */
  optimistic?: () => void;
  /** Roll back optimistic update on failure */
  rollback?: () => void;
  /** Called after a successful mutation */
  onSuccess?: (data: T) => void;
  /** Called after a failed mutation */
  onError?: (message: string, kind: MutationErrorKind) => void;
}

export interface UseMutationState {
  /** Check if a specific mutation key is in flight */
  isPending: (key: MutationKey) => boolean;
  /** Any mutation in flight */
  isAnyPending: boolean;
  /** Last error message (cleared on next mutation start) */
  lastError: string | null;
  lastErrorKind: MutationErrorKind | null;
  clearError: () => void;
  run: <T>(
    fn: () => Promise<MutationResult<T>>,
    options: RunMutationOptions<T>
  ) => Promise<MutationResult<T>>;
}

/**
 * Per-entity mutation pending + in-flight lock to prevent duplicate submissions.
 */
export function useMutation(): UseMutationState {
  const [pendingKeys, setPendingKeys] = useState<Set<MutationKey>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorKind, setLastErrorKind] = useState<MutationErrorKind | null>(null);
  const inFlightRef = useRef<Set<MutationKey>>(new Set());

  const isPending = useCallback(
    (key: MutationKey) => pendingKeys.has(key),
    [pendingKeys]
  );

  const clearError = useCallback(() => {
    setLastError(null);
    setLastErrorKind(null);
  }, []);

  const run = useCallback(
    async <T>(
      fn: () => Promise<MutationResult<T>>,
      options: RunMutationOptions<T>
    ): Promise<MutationResult<T>> => {
      const { key, optimistic, rollback, onSuccess, onError } = options;

      if (inFlightRef.current.has(key)) {
        return { ok: false, kind: 'conflict', message: 'Action already in progress' };
      }

      inFlightRef.current.add(key);
      setPendingKeys((prev) => new Set(prev).add(key));
      setLastError(null);
      setLastErrorKind(null);

      optimistic?.();

      try {
        const result = await fn();

        if (result.ok) {
          onSuccess?.(result.data);
        } else {
          rollback?.();
          setLastError(result.message);
          setLastErrorKind(result.kind);
          onError?.(result.message, result.kind);
        }

        return result;
      } catch (err) {
        rollback?.();
        const message = err instanceof Error ? err.message : 'Unexpected error';
        setLastError(message);
        setLastErrorKind('network');
        onError?.(message, 'network');
        return { ok: false, kind: 'network', message };
      } finally {
        inFlightRef.current.delete(key);
        setPendingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  return {
    isPending,
    isAnyPending: pendingKeys.size > 0,
    lastError,
    lastErrorKind,
    clearError,
    run,
  };
}

export function mutationKey(entityId: string, action: string): MutationKey {
  return `${entityId}:${action}`;
}
