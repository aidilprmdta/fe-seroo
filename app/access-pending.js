// AccessPendingScreen — pending access approval screen
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { colors, spacing, typography } from '../src/theme/tokens';
import ScreenFrame from '../src/components/ScreenFrame';

export default function AccessPendingScreen() {
  const { user } = useAuth();

  return (
    <ScreenFrame>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⏳</Text>
        </View>
        <Text style={styles.title}>Permintaan akses sedang diproses</Text>
        <Text style={styles.subtitle}>
          Admin pusat sedang meninjau akses Anda.
        </Text>
        <Text style={styles.subtitle2}>
          Akun: {user?.name} ({user?.email})
        </Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.light.infoSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle2: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
