'use client';

import RouteError from '@/components/shared/RouteError';

export default function AdminError({
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
      homeHref="/admin/dashboard"
      homeLabel="Admin dashboard"
    />
  );
}
