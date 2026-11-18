// Chip — small clickable tag
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function Chip({
  label,
  onPress,
  variant = 'default', // default | primary | secondary | success | danger
  size = 'sm',
  disabled = false,
}) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'success':
        return styles.success;
      case 'danger':
        return styles.danger;
      default:
        return styles.default;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.chip, getVariantStyle(), size === 'sm' && styles.sm, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, size === 'sm' && styles.smLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  default: {
    backgroundColor: colors.light.surfaceSecondary,
  },
  primary: {
    backgroundColor: colors.light.primary,
  },
  secondary: {
    backgroundColor: colors.light.surface,
  },
  success: {
    backgroundColor: colors.light.successSurface,
  },
  danger: {
    backgroundColor: colors.light.dangerSurface,
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    color: colors.light.textPrimary,
  },
  smLabel: {
    fontSize: typography.sizes.sm,
  },
});
