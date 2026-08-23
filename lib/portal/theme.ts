export const portalTokens = {
  canvas: '#0A0A0A',
  card: '#171717',
  hero: '#FFFFFF',
  hover: '#212121',
  border: '#262626',
  textPrimary: '#F5F5F5',
  textSecondary: '#8C8C8C',
  accentBlue: '#5B8DEF',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
  infoOrange: '#FB923C',
  statusBlue: '#93C5FD',
  statusOrange: '#FDBA74',
  statusYellow: '#FDE68A',
  statusGreen: '#6EE7B7',
  statusText: '#0A0A0A',
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
  '#A78BFA',
  '#22D3EE',
] as const;
