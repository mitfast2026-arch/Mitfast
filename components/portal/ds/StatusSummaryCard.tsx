'use client';

import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts';
import { portalTokens } from '@/lib/portal/theme';

type StatusSummaryTone = 'blue' | 'orange' | 'yellow' | 'green';

const toneBg: Record<StatusSummaryTone, string> = {
  blue: 'bg-portal-status-blue',
  orange: 'bg-portal-status-orange',
  yellow: 'bg-portal-status-yellow',
  green: 'bg-portal-status-green',
};

type StatusSummaryCardProps = {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: number;
  tone?: StatusSummaryTone;
  sparkline?: number[];
  className?: string;
};

export function StatusSummaryCard({
  label,
  value,
  subtext,
  delta,
  tone = 'blue',
  sparkline,
  className,
  compact = false,
}: StatusSummaryCardProps & { compact?: boolean }) {
  const positive = (delta ?? 0) >= 0;
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
  const data = (sparkline || []).map((v, i) => ({ i, v }));

  return (
    <div
      className={clsx(
        'relative overflow-hidden text-portal-status-text',
        compact ? 'rounded-2xl p-3' : 'rounded-[24px] p-6',
        toneBg[tone],
        className
      )}
    >
      <p className={clsx('capitalize opacity-80', compact ? 'text-[11px]' : 'text-[13px]')}>
        {label}
      </p>
      <div className={clsx('flex items-end gap-2 flex-wrap', compact ? 'mt-1' : 'mt-2')}>
        <p
          className={clsx(
            'font-bold tabular-nums leading-none',
            compact ? 'text-[22px] sm:text-[26px]' : 'text-[32px] sm:text-[40px]'
          )}
        >
          {value}
        </p>
        {delta !== undefined ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium">
            <DeltaIcon className="w-3 h-3" aria-hidden />
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      {subtext ? (
        <p className={clsx('opacity-70', compact ? 'mt-1 text-[10px]' : 'mt-2 text-xs')}>{subtext}</p>
      ) : null}
      {data.length > 1 ? (
        <div className="absolute bottom-3 right-3 w-20 h-10 opacity-70 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={portalTokens.statusText}
                fill={portalTokens.statusText}
                fillOpacity={0.15}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
