// Toast — brief notification
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function Toast({ message, type = 'info', duration = 3000, onDismiss }) {
  const timeout = useRef();

  useEffect(() => {
    timeout.current = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, duration);
    return () => clearTimeout(timeout.current);
  }, [duration, onDismiss]);

  const getStyle = () => {
    switch (type) {
      case 'success':
        return styles.success;
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      case 'info':
      default:
        return styles.info;
    }
  };

  return (
    <View style={[styles.toast, getStyle()]}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  success: {
    backgroundColor: colors.light.successSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.success,
  },
  error: {
    backgroundColor: colors.light.dangerSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.danger,
  },
  warning: {
    backgroundColor: colors.light.warningSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.warning,
  },
  info: {
    backgroundColor: colors.light.infoSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.info,
  },
  message: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
});
