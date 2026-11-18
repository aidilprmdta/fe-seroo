// Badge — small label/tag with variants
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function Badge({
  label,
  variant = 'default', // default | success | danger | warning | info | primary
  size = 'md', // sm | md
  style,
}) {
  const getVariantStyle = () => {
    const base = [
      styles.badge,
      size === 'sm' && styles.sm,
      size === 'md' && styles.md,
    ];
    switch (variant) {
      case 'success':
        return [...base, styles.success];
      case 'danger':
        return [...base, styles.danger];
      case 'warning':
        return [...base, styles.warning];
      case 'info':
        return [...base, styles.info];
      case 'primary':
        return [...base, styles.primary];
      case 'default':
      default:
        return [...base, styles.default];
    }
  };

  return (
    <View style={[getVariantStyle(), style]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const sizes = {
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    fontSize: typography.sizes.sm,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    fontSize: typography.sizes.base,
  },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sm: {
    ...sizes.sm,
  },
  md: {
    ...sizes.md,
  },
  default: {
    backgroundColor: colors.light.surfaceSecondary,
    borderRadius: radii.md,
  },
  success: {
    backgroundColor: colors.light.successSurface,
    borderRadius: radii.md,
  },
  danger: {
    backgroundColor: colors.light.dangerSurface,
    borderRadius: radii.md,
  },
  warning: {
    backgroundColor: colors.light.warningSurface,
    borderRadius: radii.md,
  },
  info: {
    backgroundColor: colors.light.infoSurface,
    borderRadius: radii.md,
  },
  primary: {
    backgroundColor: colors.light.primary,
    borderRadius: radii.md,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    color: colors.light.textPrimary,
  },
});
