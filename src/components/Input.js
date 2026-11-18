// Input — text input with label, error, disabled states
import React, { useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  disabled = false,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  returnKeyType = 'done',
  maxLength,
  leftIcon,
  rightIcon,
  hideLabel = false,
  onFocus,
  onBlur,
}) {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (onFocus) onFocus();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (onBlur) onBlur();
  }, [onBlur]);

  return (
    <View style={styles.container}>
      {!hideLabel && label && (
        <Text style={[styles.label, isFocused && error ? styles.labelError : styles.labelNormal]}>
          {label}
        </Text>
      )}
      <View style={styles.inputContainer}>
        {leftIcon}
        <TextInput
          style={[
            styles.input,
            disabled && styles.inputDisabled,
            error && !isFocused && styles.inputError,
            isFocused && error && styles.inputErrorFocused,
            isFocused && !error && styles.inputFocused,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.light.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {rightIcon}
      </View>
      {error && !isFocused && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const sizes = {
  sm: {
    height: 36,
    fontSize: typography.sizes.sm,
  },
  md: {
    height: 44,
    fontSize: typography.sizes.base,
  },
  lg: {
    height: 52,
    fontSize: typography.sizes.lg,
  },
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
  labelError: {
    color: colors.light.danger,
  },
  labelNormal: {
    color: colors.light.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.surface,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    height: sizes.md.height,
    ...typography.fontFamily.regular,
    fontSize: sizes.md.fontSize,
    color: colors.light.textPrimary,
    padding: 0,
  },
  inputDisabled: {
    backgroundColor: colors.light.surfaceSecondary,
    color: colors.light.textTertiary,
  },
  inputError: {
    borderColor: colors.light.danger,
  },
  inputErrorFocused: {
    borderColor: colors.light.danger,
    borderWidth: 2,
  },
  inputFocused: {
    borderColor: colors.light.primary,
    borderWidth: 2,
  },
  errorText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.danger,
  },
});
