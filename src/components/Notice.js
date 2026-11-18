// Notice — info/danger/success banner
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function Notice({ message, type = 'info', style }) {
  if (!message) return null;

  const getStyle = () => {
    switch (type) {
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      case 'success':
        return styles.success;
      default:
        return styles.info;
    }
  };

  return (
    <View style={[styles.container, getStyle(), style]}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  info: {
    backgroundColor: colors.light.infoSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.info,
  },
  success: {
    backgroundColor: colors.light.successSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.success,
  },
  warning: {
    backgroundColor: colors.light.warningSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.warning,
  },
  error: {
    backgroundColor: colors.light.dangerSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.light.danger,
  },
  message: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
});
