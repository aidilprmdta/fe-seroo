// OfflineBanner — Figma 125:3 · koneksi terputus
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';

export default function OfflineBanner({ detail = 'Coba lagi saat koneksi kembali tersedia.' }) {
  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Koneksi terputus</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.light.primary },
  title: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.primary,
  },
  detail: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
});
