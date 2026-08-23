'use client';

import React from 'react';

/** Content-area skeleton shown immediately on portal nav click (before route settles). */
export default function PortalRouteSkeleton() {
  return (
    <div
      className="space-y-6 w-full animate-pulse"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-portal-inset" />
        <div className="h-4 w-72 max-w-full rounded-md bg-portal-inset/70" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="saas-panel h-28 rounded-xl" />
        ))}
      </div>
      <div className="saas-panel rounded-xl p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-portal-inset/80" />
        ))}
      </div>
    </div>
  );
}
