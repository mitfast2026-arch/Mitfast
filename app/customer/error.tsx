'use client';

import RouteError from '@/components/shared/RouteError';

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      homeHref="/customer/dashboard"
      homeLabel="Buyer dashboard"
    />
  );
}
