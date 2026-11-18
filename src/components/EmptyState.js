// EmptyState — empty state display
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      {title && (
        <Text style={[styles.title, !subtitle && styles.titleNoSubtitle]}>
          {title}
        </Text>
      )}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: radii.xxl,
    backgroundColor: colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xl,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  titleNoSubtitle: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: spacing.md,
  },
});
