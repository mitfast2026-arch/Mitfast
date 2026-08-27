'use client';

import React from 'react';
import { Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  onExpand?: () => void;
  /** Hide decorative expand control when unused */
  showExpand?: boolean;
};

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  onExpand,
  showExpand = false,
}: ChartCardProps) {
  return (
    <div className={clsx('saas-panel p-4 flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 mb-2 shrink-0">
        <div className="min-w-0">
          <h3 className="type-section">{title}</h3>
          {subtitle ? <p className="type-desc mt-0.5">{subtitle}</p> : null}
        </div>
        {onExpand || showExpand ? (
          <button
            type="button"
            onClick={onExpand}
            disabled={!onExpand}
            className="saas-btn-ghost shrink-0"
            aria-label="Expand chart"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      <div className="w-full flex items-center justify-center min-w-0">{children}</div>
    </div>
  );
}
