// BaseButton — reusable button with variants, loading, disabled
import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { colors, typography, radii, spacing } from '../theme/tokens';

export default function BaseButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // primary | secondary | outline | ghost | danger
  size = 'md', // sm | md | lg
  fullWidth = false,
  iconLeft,
  iconRight,
  accessibilityLabel,
}) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const getButtonStyle = () => {
    const base = [
      styles.button,
      fullWidth && styles.fullWidth,
      size === 'sm' && styles.sm,
      size === 'md' && styles.md,
      size === 'lg' && styles.lg,
    ];
    if (isPrimary) return [...base, styles.primary];
    if (isSecondary) return [...base, styles.secondary];
    if (isOutline) return [...base, styles.outline];
    if (isGhost) return [...base, styles.ghost];
    if (isDanger) return [...base, styles.danger];
    return base;
  };

  const getLabelStyle = () => {
    const base = [
      styles.label,
      typography.fontFamily.medium,
      typography.weights.semibold,
      sizes[size]?.fontSize,
    ];
    if (isPrimary || isDanger) return [...base, styles.onPrimary];
    if (isSecondary || isOutline || isGhost) return [...base, styles.onSurface];
    return [...base, styles.onSurface];
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        getButtonStyle(),
        pressed && !disabled && !loading && styles.pressed,
        disabled && styles.disabled,
        loading && styles.loading,
      ]}
    >
      {loading ? (
        <>
          <Text style={[styles.label, styles.loadingLabel]}>Memproses…</Text>
          <View style={styles.spinner} />
        </>
      ) : (
        <>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text style={getLabelStyle()} numberOfLines={1}>
            {label}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </Pressable>
  );
}

const sizes = {
  sm: {
    height: 36,
    fontSize: typography.sizes.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  md: {
    height: 44,
    fontSize: typography.sizes.base,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  lg: {
    height: 52,
    fontSize: typography.sizes.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
  },
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  sm: {
    ...sizes.sm,
  },
  md: {
    ...sizes.md,
  },
  lg: {
    ...sizes.lg,
  },
  primary: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  secondary: {
    backgroundColor: colors.light.background,
    borderColor: colors.light.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.light.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.light.danger,
    borderColor: colors.light.danger,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
  },
  onPrimary: {
    color: colors.light.onPrimary,
  },
  onSecondary: {
    color: colors.light.textPrimary,
  },
  onSurface: {
    color: colors.light.textPrimary,
  },
  onDanger: {
    color: colors.light.onPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  loading: {
    opacity: 1,
  },
  loadingLabel: {
    color: colors.light.onPrimary,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  spinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderTopColor: colors.light.onPrimary,
    borderRightColor: colors.light.onPrimary,
    borderBottomColor: colors.light.onPrimary,
    borderLeftColor: colors.light.onPrimary,
    borderRadius: 8,
    animation: 'spin 1s linear infinite',
  },
});
