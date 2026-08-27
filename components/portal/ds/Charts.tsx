'use client';

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, portalTokens } from '@/lib/portal/theme';

type Datum = { name: string; value: number };

const tooltipStyle: React.CSSProperties = {
  background: '#171717',
  border: '1px solid #262626',
  borderRadius: 12,
  color: '#F5F5F5',
  fontSize: 12,
};

/** Largest-remainder so displayed % always sum to 100 */
function allocatePercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map((v) => Math.floor(v));
  let rem = 100 - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < rem; k++) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}

export function PortalBarChart({ data, height = 220 }: { data: Datum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: portalTokens.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: portalTokens.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={portalTokens.accentBlue} radius={[8, 8, 0, 0]} maxBarSize={48} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

/**
 * Perfect-round pie with center total + compact legend (count + %).
 * Prefer this over stretched donuts with wide legend gaps.
 */
export function PortalDonutChart({
  data,
  solid = true,
}: {
  data: Datum[];
  /** true = solid pie (perfect round); false = hollow donut */
  solid?: boolean;
}) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const percents = useMemo(
    () => allocatePercents(data.map((d) => d.value)),
    [data]
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full min-w-0">
      <div className="relative shrink-0 w-[168px] h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={solid ? 0 : 52}
              outerRadius={78}
              paddingAngle={data.length > 1 ? 1.5 : 0}
              stroke={portalTokens.card}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        {solid ? null : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-portal-muted">Total</span>
            <span className="text-xl font-bold tabular-nums text-portal-text">
              {total.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      <ul className="w-full max-w-[220px] space-y-2.5 shrink-0">
        {data.map((d, i) => (
          <li
            key={d.name}
            className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-x-2.5 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              aria-hidden
            />
            <span className="truncate text-portal-text font-medium" title={d.name}>
              {d.name}
            </span>
            <span className="font-mono tabular-nums text-portal-muted text-xs">
              {d.value.toLocaleString('en-IN')}
            </span>
            <span className="font-mono tabular-nums text-portal-text w-10 text-right">
              {percents[i]}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Perfect-round mix chart: circular donut + center total + compact legend */
export function PortalPieChart({ data }: { data: Datum[] }) {
  return <PortalDonutChart data={data} solid={false} />;
}
