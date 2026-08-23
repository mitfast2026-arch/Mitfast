export type ChartKind = 'timeseries' | 'proportion' | 'kpi' | 'compare' | 'tabular';

export type ChartSelection = 'bar' | 'line' | 'donut' | 'kpi' | 'table';

/**
 * Auto-pick visualization from data shape (UI-only helper).
 * Never invents metrics — callers pass existing on-page data shape.
 */
export function selectChart(input: {
  kind: ChartKind;
  categoryCount?: number;
}): ChartSelection {
  const { kind, categoryCount = 0 } = input;

  if (kind === 'tabular') return 'table';
  if (kind === 'kpi') return 'kpi';
  if (kind === 'timeseries') return 'bar';
  if (kind === 'proportion') return 'donut';

  // compare
  if (categoryCount > 5) return 'bar';
  return 'donut';
}
