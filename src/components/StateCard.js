// StateCard — Figma 125:3 · pola status & feedback (loading/empty/error/validation/success/action)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

const TONES = {
  loading: { accent: colors.light.maroon, tag: 'LOADING' },
  empty: { accent: colors.light.maroon, tag: 'EMPTY' },
  error: { accent: colors.light.primary, tag: 'ERROR' },
  validation: { accent: colors.light.primary, tag: 'VALIDATION' },
  success: { accent: '#55724D', tag: 'SUCCESS' },
  action: { accent: colors.light.maroon, tag: 'ACTION' },
};

export default function StateCard({
  title,
  tone = 'loading',
  description,
  detail,
  actionLabel,
  onAction,
  style,
}) {
  const config = TONES[tone] || TONES.loading;

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.accent, { backgroundColor: config.accent }]} />
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <Text style={[styles.tag, { color: config.accent }]}>{config.tag}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      {tone === 'loading' ? (
        <View style={styles.skeletons}>
          <View style={[styles.skeleton, { width: '100%' }]} />
          <View style={[styles.skeleton, { width: '76%' }]} />
        </View>
      ) : null}

      {tone === 'empty' ? (
        <View style={styles.emptyRow}>
          <View style={styles.emptyCircle}><Text style={styles.emptyGlyph}>—</Text></View>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
      ) : null}

      {tone === 'error' && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.action}>{actionLabel || 'Coba lagi'} →</Text>
        </TouchableOpacity>
      ) : null}

      {tone === 'validation' ? (
        <View style={styles.inputError}>
          <Text style={styles.inputErrorText}>{detail || 'Wajib diisi'}</Text>
        </View>
      ) : null}

      {tone === 'success' ? (
        <View style={styles.successBadge}><Text style={styles.successText}>TERSIMPAN</Text></View>
      ) : null}

      {tone === 'action' && detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 148,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg - 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  accent: { width: 4, height: 24, borderRadius: 2, position: 'absolute', left: spacing.md, top: spacing.md },
  title: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 13,
    color: colors.light.textPrimary,
    marginLeft: spacing.md,
  },
  tag: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    marginLeft: spacing.md,
  },
  description: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
  },
  skeletons: { gap: spacing.sm, marginTop: spacing.sm },
  skeleton: { height: 8, borderRadius: 4, backgroundColor: colors.light.background },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  emptyCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyph: { ...typography.fontFamily.bold, fontSize: 12, color: colors.light.textSecondary },
  detail: { ...typography.fontFamily.regular, fontSize: 10, color: colors.light.textSecondary },
  action: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.primary,
    marginTop: spacing.sm,
  },
  inputError: {
    height: 28,
    borderWidth: 1,
    borderColor: colors.light.primary,
    borderRadius: radii.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  inputErrorText: { ...typography.fontFamily.medium, fontSize: 9, color: colors.light.primary },
  successBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.background,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  successText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: '#55724D' },
});
