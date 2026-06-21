export const colors = {
  bgPrimary: '#0a0f1e',
  bgSecondary: '#0d1529',
  bgCard: '#111827',
  accent: '#00f0ff',
  accentDim: 'rgba(0, 240, 255, 0.5)',
  purple: '#7b2fff',
  purpleDim: 'rgba(123, 47, 255, 0.3)',
  textPrimary: '#e0e0e0',
  textSecondary: '#8a8fa8',
  textMuted: '#4a5068',
  success: '#00ff88',
  warning: '#ffb800',
  danger: '#ff3366',
  border: 'rgba(0, 240, 255, 0.15)',
  borderHover: 'rgba(0, 240, 255, 0.35)',
} as const;

export const glow = {
  subtle: '0 0 20px rgba(0, 240, 255, 0.08)',
  medium: '0 0 30px rgba(0, 240, 255, 0.15)',
} as const;

export const chartColors = {
  pageview: '#00f0ff',
  click: '#00ff88',
  impression: '#7b2fff',
  form_interaction: '#ffb800',
  dwell: '#ff3366',
  custom: '#8a8fa8',
} as const;

export const sourceColors = {
  internal: '#00f0ff',
  external: '#7b2fff',
  direct: '#4a5068',
} as const;

export const gradients = {
  cyanVertical: ['#00f0ff', '#004d52'],
  purpleVertical: ['#7b2fff', '#2a0d5e'],
  mixed: ['#00f0ff', '#7b2fff'],
} as const;
