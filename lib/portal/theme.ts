export const portalTokens = {
  canvas: '#ECEEF0',
  card: '#F7F7F8',
  hero: '#111315',
  hover: '#E8EAED',
  border: '#D9DCE1',
  textPrimary: '#111315',
  textSecondary: '#6B7280',
  accentBlue: '#2563EB',
  success: '#15803D',
  danger: '#B91C1C',
  warning: '#B45309',
  infoOrange: '#C2410C',
  statusBlue: '#1D4ED8',
  statusOrange: '#B45309',
  statusYellow: '#A16207',
  statusGreen: '#15803D',
  statusText: '#FFFFFF',
} as const;

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'pending';

export function statusToneClasses(tone: StatusTone): string {
  switch (tone) {
    case 'success':
      return 'saas-badge-success';
    case 'danger':
      return 'saas-badge-danger';
    case 'warning':
    case 'pending':
      return 'saas-badge-warning';
    case 'info':
      return 'saas-badge-info';
    default:
      return 'saas-badge-neutral';
  }
}

export const CHART_COLORS = [
  portalTokens.accentBlue,
  portalTokens.success,
  portalTokens.warning,
  portalTokens.infoOrange,
  portalTokens.danger,
  '#7C3AED',
  '#0891B2',
] as const;
