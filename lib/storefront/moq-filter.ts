/** Shared MOQ catalog filter bounds (matches ProductsCatalogClient MOQ_OPTIONS). */
const MOQ_OPTIONS = [
  { id: '1-100', min: 1, max: 100 },
  { id: '101-500', min: 101, max: 500 },
  { id: '501-1000', min: 501, max: 1000 },
  { id: '1000+', min: 1000, max: Infinity },
] as const;

export function parseMoqFilterBounds(moqParam: string): {
  moqMin?: number;
  moqMax?: number;
} {
  if (!moqParam.trim()) return {};

  const ids = moqParam.split(',').filter(Boolean);
  const ranges = MOQ_OPTIONS.filter((o) => ids.includes(o.id));
  if (ranges.length === 0) return {};

  const moqMin = Math.min(...ranges.map((r) => r.min));
  const finiteMaxes = ranges.map((r) => r.max).filter((m) => Number.isFinite(m));
  const moqMax = finiteMaxes.length ? Math.max(...finiteMaxes) : undefined;

  return { moqMin, moqMax };
}
