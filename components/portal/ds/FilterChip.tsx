'use client';

import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

type FilterChipProps = {
  label: string;
  onRemove?: () => void;
  className?: string;
};

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full bg-portal-inset border border-portal-border px-3 py-1.5 text-sm text-portal-text',
        className
      )}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-portal-muted hover:text-portal-text"
          aria-label={`Remove ${label} filter`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </span>
  );
}

type FilterChipGroupProps = {
  children: React.ReactNode;
  onClearAll?: () => void;
  className?: string;
};

export function FilterChipGroup({ children, onClearAll, className }: FilterChipGroupProps) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {children}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-portal-accent hover:underline px-1"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
