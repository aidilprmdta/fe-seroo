// Design tokens Seroo
// Import via: import { colors, spacing, radii, shadows, typography } from '../theme/tokens';

import { colors as baseColors, light, dark } from './colors';
import { Dimensions } from 'react-native';
import { FONT } from './fonts';

// Export colors dengan backward compatibility:
// - colors.surface, colors.primary, dll → langsung dari light mode (flat, lama)
// - colors.light.primary, colors.dark.primary → nested (baru)
// Tidak menggunakan Proxy karena Hermes (React Native) tidak fully support ES6 Proxy.
export const colors = {
  // Flat (backward compat — akses langsung: colors.surface, colors.primary, dll)
  ...light,
  // Nested (baru: colors.light.*, colors.dark.*)
  light,
  dark,
};

// Spacing scale (8px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  screenPadding: 16,
};

// Border radius
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  xxl: 20,
  full: 9999,
};

// Shadows
export const shadows = {
  sm: {
    elevation: 1,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  md: {
    elevation: 2,
    shadowColor: 'rgba(0,0,0,0.10)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  lg: {
    elevation: 4,
    shadowColor: 'rgba(0,0,0,0.14)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
};

// Typography
export const typography = {
  fontFamily: {
    regular: FONT.regular,
    medium: FONT.medium,
    semibold: FONT.semibold,
    bold: FONT.bold,
    display: FONT.display,
    displayItalic: FONT.displayItalic,
  },
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    h5: 16,
    h6: 14,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// Screen dimensions
export const screen = {
  height: Dimensions.get('window').height,
  width: Dimensions.get('window').width,
};

// Status bar style
export const statusBar = {
  dark: 'light-content',
  light: 'dark-content',
};

// Safe area
export const safeArea = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

// Tab bar
export const tabBar = {
  height: 60,
  activeTextColor: colors.light.primary,
  inactiveTextColor: colors.light.textSecondary,
  labelFont: typography.fontFamily.medium,
};
