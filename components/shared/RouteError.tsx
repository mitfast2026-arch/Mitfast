'use client';

import { useEffect } from 'react';
import Link from 'next/link';

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
};

export default function RouteError({
  error,
  reset,
  homeHref = '/',
  homeLabel = 'Back to home',
}: RouteErrorProps) {
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-xs font-mono uppercase tracking-widest text-[#6B7280]">Error</p>
        <h1 className="type-page text-xl">Something went wrong</h1>
        <p className="type-subtitle">
          An unexpected error occurred. You can try again or return to a safe page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button type="button" onClick={reset} className="saas-btn-primary text-xs">
            Try again
          </button>
          <Link href={homeHref} className="saas-btn-secondary text-xs">
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
