// ListItem — row for lists (menus, orders, etc.)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function ListItem({
  title,
  subtitle,
  right,
  onPress,
  showChevron = true,
  leading,
  bottomDivider = false,
  disabled = false,
  containerStyle,
}) {
  return (
    <TouchableOpacity
      style={[styles.container, containerStyle, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {leading && <View style={styles.leading}>{leading}</View>}
      <View style={styles.content}>
        <Text style={[styles.title, !subtitle && styles.titleNoSubtitle]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
      {showChevron && !disabled && (
        <View style={styles.chevron}>
          <Text style={styles.chevronIcon}>›</Text>
        </View>
      )}
      {bottomDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  leading: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  titleNoSubtitle: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chevron: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    fontSize: 24,
    color: colors.light.textSecondary,
  },
  disabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: colors.light.border,
    marginTop: spacing.sm,
  },
});
