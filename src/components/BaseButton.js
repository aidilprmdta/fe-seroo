
// BaseButton — reusable button with variants, loading, disabled
import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';

import {
  colors,
  typography,
  radii,
  spacing,
} from '../theme/tokens';

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

const variantStyles = {
  primary: styles => styles.primary,
  secondary: styles => styles.secondary,
  outline: styles => styles.outline,
  ghost: styles => styles.ghost,
  danger: styles => styles.danger,
};

export default function BaseButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  accessibilityLabel,
}) {
  const buttonSize = sizes[size] ?? sizes.md;

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const isLightText = isPrimary || isDanger;

  const textColorStyle = isLightText
    ? styles.onPrimary
    : styles.onSurface;

  const indicatorColor = isLightText
    ? colors.light.onPrimary
    : colors.light.textPrimary;

  const selectedVariant =
    variantStyles[variant]?.(styles) ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,

        fullWidth && styles.fullWidth,

        {
          height: buttonSize.height,
          paddingHorizontal: buttonSize.paddingHorizontal,
          borderRadius: buttonSize.borderRadius,
        },

        selectedVariant,

        pressed && !disabled && !loading && styles.pressed,
        disabled && styles.disabled,
        loading && styles.loading,
      ]}
    >
      {loading ? (
        <>
          <Text
            style={[
              styles.label,
              { fontSize: buttonSize.fontSize },
              textColorStyle,
            ]}
          >
            Memproses…
          </Text>

          <ActivityIndicator
            size="small"
            color={indicatorColor}
            style={styles.indicator}
          />
        </>
      ) : (
        <>
          {iconLeft && (
            <View style={styles.iconLeft}>
              {iconLeft}
            </View>
          )}

          <Text
            style={[
              styles.label,
              { fontSize: buttonSize.fontSize },
              textColorStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>

          {iconRight && (
            <View style={styles.iconRight}>
              {iconRight}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

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

  onSurface: {
    color: colors.light.textPrimary,
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

  indicator: {
    marginLeft: spacing.sm,
  },

  iconLeft: {
    marginRight: spacing.sm,
  },

  iconRight: {
    marginLeft: spacing.sm,
  },
});
