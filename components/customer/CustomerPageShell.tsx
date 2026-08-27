'use client';

import React from 'react';
import { clsx } from 'clsx';

type CustomerPageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
};

export function CustomerPageShell({
  title,
  subtitle,
  actions,
  children,
  compact = false,
}: CustomerPageShellProps) {
  return (
    <div className={clsx('buyer-page', compact && 'buyer-page--compact')}>
      <header className="buyer-page-header">
        <div className="min-w-0">
          <h1 className="buyer-page-title">{title}</h1>
          {subtitle ? <p className="buyer-page-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="buyer-page-actions">{actions}</div> : null}
      </header>
      <div className="buyer-page-body">{children}</div>
    </div>
  );
}

export function CustomerPageSkeleton({
  blocks = 2,
  compact = false,
}: {
  blocks?: number;
  compact?: boolean;
}) {
  return (
    <div className={clsx('buyer-page animate-pulse', compact && 'buyer-page--compact')}>
      <div className="buyer-page-header">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-[#eceef0]" />
          <div className="h-4 w-64 rounded bg-[#eceef0]" />
        </div>
      </div>
      <div className="buyer-page-body">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="buyer-surface h-16" />
          ))}
        </div>
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="buyer-surface h-32" />
        ))}
      </div>
    </div>
  );
}
