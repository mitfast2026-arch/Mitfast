import React from 'react';
import { StatusSummaryCard } from '@/components/portal/ds';

export type AdminStatItem = {
  label: string;
  value: number | string;
  highlight?: 'success' | 'warning' | 'danger' | 'default';
  onClick?: () => void;
  active?: boolean;
};

const toneFor: Record<
  NonNullable<AdminStatItem['highlight']>,
  'blue' | 'orange' | 'yellow' | 'green' | undefined
> = {
  default: 'blue',
  success: 'green',
  warning: 'yellow',
  danger: 'orange',
};

export default function AdminStatStrip({
  stats,
  className = '',
  compact = false,
}: {
  stats: AdminStatItem[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${
        compact ? 'gap-2.5' : 'gap-5'
      } ${className}`}
    >
      {stats.map((stat) => {
        const tone = toneFor[stat.highlight ?? 'default'] || 'blue';
        const card = (
          <StatusSummaryCard
            label={stat.label}
            value={stat.value}
            tone={tone}
            subtext={stat.active ? 'Filtered' : undefined}
            compact={compact}
          />
        );
        if (stat.onClick) {
          return (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className={`text-left transition ring-offset-2 ring-offset-portal-canvas ${
                compact ? 'rounded-2xl' : 'rounded-[24px]'
              } ${stat.active ? 'ring-2 ring-portal-accent' : ''}`}
            >
              {card}
            </button>
          );
        }
        return <React.Fragment key={stat.label}>{card}</React.Fragment>;
      })}
    </div>
  );
}
