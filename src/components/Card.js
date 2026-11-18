// Card — container with surface background and elevation
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radii, shadows } from '../theme/tokens';

export default function Card({ children, style, variant = 'default', padding = 'md' }) {
  const getStyle = () => {
    const base = [
      styles.card,
      variant === 'elevated' && styles.elevated,
      variant === 'outlined' && styles.outlined,
    ];
    const paddingMap = {
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
    };
    return [...base, { padding: paddingMap[padding] }, style];
  };

  return <View style={getStyle()}>{children}</View>;
}

const sizes = {
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  elevated: {
    ... shadows.md,
    shadowColor: colors.light.shadow,
  },
  outlined: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderLight,
  },
});
