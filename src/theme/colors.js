// Seroo Brand Palette - Ekstrak dari Figma "Brand palette Seroo Red Gold"
// Source: /mnt/c/Users/ASUS/Aidil/Figma/Seroo Mobile App UI_UX (Copy)/Brand palette Seroo Red Gold.png

// Light mode
export const light = {
  // Primary brand
  primary: '#A90D16',
  primaryLight: '#C8696D',
  primaryDark: '#865A52',
  onPrimary: '#FFFFFF',

  // Secondary brand
  secondary: '#76665A',
  accent: '#F2E9DD',

  // Background & surfaces
  background: '#F6F2ED',
  surface: '#FFFFFF',
  surfaceSecondary: '#FCF9F4',
  surfaceMuted: '#F2E9DD',

  // Text — Figma: Ink #29211E, Muted #76665A
  textPrimary: '#29211E',
  textSecondary: '#76665A',
  textTertiary: '#96897F',
  textDisabled: '#8A928F',

  // Brand extras dari Figma
  maroon: '#480808',
  ink: '#29211E',
  muted: '#76665A',
  goldLight: '#F2E9DD',
  goldBorder: '#D8BFA2',

  // Borders
  border: '#E8DCCB',
  borderLight: '#E8DCCB',
  borderMuted: '#D4DBD5',

  // States — Danger memakai Seroo Red, surface-nya Soft
  danger: '#A90D16',
  dangerSurface: '#F2E9DD',
  dangerText: '#480808',

  warning: '#E0A020',
  warningSurface: '#FEF3DA',

  info: '#2B6CF0',
  infoSurface: '#E9EFF3',

  success: '#1F7A4D',
  successSurface: '#E6F4EA',

  // Shadows
  shadow: 'rgba(20, 30, 25, 0.06)',
  shadowStrong: 'rgba(20, 30, 25, 0.12)',
  overlay: 'rgba(26, 29, 28, 0.55)',

  // UI elements
  navBg: '#F0F2F0',
  divider: '#E4E8E5',
};

// Dark mode
export const dark = {
  background: '#121413',
  surface: '#1A1D1C',
  surfaceSecondary: '#222523',
  textPrimary: '#F0F2F0',
  textSecondary: '#A8AEAA',
  textTertiary: '#7A807D',
  primary: '#A90D16',
  primaryLight: '#C8696D',
  primaryDark: '#865A52',
  onPrimary: '#FFFFFF',
  border: '#3A403D',
  danger: '#C43D3D',
  dangerSurface: '#3A2020',
  dangerText: '#E07070',
  warning: '#E0A020',
  warningSurface: '#3A3000',
  info: '#2B6CF0',
  infoSurface: '#102030',
  success: '#1F7A4D',
  successSurface: '#0A2018',
  shadow: 'rgba(0, 0, 0, 0.4)',
  shadowStrong: 'rgba(0, 0, 0, 0.6)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  navBg: '#1A1D1C',
  divider: '#3A403D',
};

// Export combined object for backward compatibility
export const colors = { light, dark };

// Semantic color shortcuts (uses light mode by default)
export const semantic = {
  primary: light.primary,
  textPrimary: light.textPrimary,
  textSecondary: light.textSecondary,
  border: light.border,
  danger: light.danger,
  warning: light.warning,
  info: light.info,
  success: light.success,
  surface: light.surface,
  background: light.background,
};

// Terminal shorthands
export const T = light;
export const D = dark;
