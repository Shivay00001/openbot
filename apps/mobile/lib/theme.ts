/**
 * OpenBot Mobile — Design System & Theme Tokens
 * Premium dark glassmorphism aesthetic matching the web app.
 */

export const Colors = {
  // Core backgrounds
  bgPrimary: '#0a0e1a',
  bgSecondary: '#0f1424',
  bgTertiary: '#161d2f',
  bgCard: 'rgba(18, 24, 42, 0.85)',
  bgGlass: 'rgba(14, 18, 32, 0.75)',
  bgInput: 'rgba(0, 0, 0, 0.35)',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Accents
  accentCyan: '#00f2fe',
  accentEmerald: '#10b981',
  accentPurple: '#8b5cf6',
  accentAmber: '#f59e0b',
  accentBlue: '#3b82f6',
  accentRed: '#ef4444',
  accentPink: '#ec4899',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.12)',

  // Gradients (for linear gradient arrays)
  gradientBrand: ['#00f2fe', '#4facfe', '#00f2fe'] as const,
  gradientEmerald: ['#10b981', '#059669'] as const,
  gradientPurple: ['#8b5cf6', '#ec4899'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  hero: 28,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
