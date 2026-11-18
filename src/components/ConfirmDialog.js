// ConfirmDialog — Figma 125:252 · dialog konfirmasi tindakan
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Modal from './Modal';
import BaseButton from './BaseButton';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  body,
  badge,
  cancelLabel = 'Batal',
  confirmLabel = 'Ya, lanjutkan',
  confirmVariant = 'danger',
  loading = false,
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      width="92%"
      maxHeight="70%"
      footer={
        <View style={styles.footer}>
          <View style={styles.button}>
            <BaseButton label={cancelLabel} onPress={onClose} variant="secondary" size="lg" fullWidth disabled={loading} />
          </View>
          <View style={styles.button}>
            <BaseButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={confirmVariant}
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
            />
          </View>
        </View>
      }
    >
      {badge ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      ) : null}
      <Text style={styles.body}>{body}</Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1, minWidth: 120 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    color: colors.light.maroon,
  },
  body: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.light.textSecondary,
  },
});
