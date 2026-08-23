'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

type EmptyStateProps = {
  label: string;
  icon?: LucideIcon;
  className?: string;
  action?: React.ReactNode;
};

export function EmptyState({ label, icon: Icon = Inbox, className, action }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center',
        className
      )}
    >
      <span className="saas-icon-well-lg">
        <Icon className="w-6 h-6" aria-hidden />
      </span>
      <p className="type-empty-title">{label}</p>
      {action}
    </div>
  );
}

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('saas-skeleton', className)} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="saas-panel p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonTableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="saas-table-container divide-y divide-portal-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
