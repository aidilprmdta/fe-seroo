// CooldownScreen — Figma 07/08 · Login cooldown (HP & Tablet)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BaseButton from '../../src/components/BaseButton';
import ScreenFrame from '../../src/components/ScreenFrame';
import { ROUTES } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`;
}

export default function CooldownScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [remaining, setRemaining] = useState(() => {
    const parsed = Number(params.seconds);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
  });

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining > 0]);

  const handleBack = useCallback(() => {
    router.replace(ROUTES.login);
  }, [router]);

  const timerPanel = (
    <View style={[styles.timerCard, isTablet && styles.tabletTimerCard]}>
      <Text style={styles.timerLabel}>WAKTU TUNGGU</Text>
      <Text style={[styles.timerValue, isTablet && styles.tabletTimerValue]}>
        {formatCountdown(remaining)}
      </Text>
      <Text style={styles.timerHint}>Sisa waktu diperbarui otomatis oleh sistem.</Text>
    </View>
  );

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={[styles.content, isTablet && styles.tabletContent]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.brandName, isTablet && styles.tabletBrandName]}>Seroo.</Text>

        {isTablet ? (
          <View style={styles.tabletPanel}>
            <Text style={styles.panelEyebrow}>AKSES AKUN</Text>
            <Text style={styles.tabletTitle}>Login sementara dibatasi</Text>
            <Text style={styles.tabletDescription}>
              Terlalu banyak percobaan kata sandi yang tidak sesuai. Sistem akan mengizinkan
              percobaan kembali setelah pembatasan berakhir.
            </Text>
            {timerPanel}
          </View>
        ) : (
          <>
            <View style={styles.warning}>
              <View style={styles.warningCircle}>
                <Text style={styles.warningMark}>!</Text>
              </View>
            </View>
            <Text style={styles.title}>Login sementara dibatasi</Text>
            <Text style={styles.description}>
              Terlalu banyak percobaan kata sandi yang tidak sesuai. Untuk sementara,
              sistem membatasi percobaan login.
            </Text>
            {timerPanel}
          </>
        )}

        <View style={isTablet && styles.tabletButtonWrap}>
          <BaseButton
            label="Kembali ke halaman login"
            onPress={handleBack}
            variant="outline"
            fullWidth
            size="lg"
          />
        </View>

        <Text style={[styles.note, isTablet && styles.tabletNote]}>
          {isTablet
            ? 'Pembatasan tetap berlaku meskipun aplikasi ditutup atau dibuka kembali.'
            : 'Menutup atau membuka ulang aplikasi tidak menghapus pembatasan yang masih aktif. Login berhasil dan re-login normal tidak memicu jeda.'}
        </Text>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  tabletContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  brandName: {
    ...typography.fontFamily.display,
    fontSize: 42,
    color: colors.light.primary,
  },
  tabletBrandName: { fontSize: 46, alignSelf: 'flex-start', marginBottom: spacing.xl },
  warning: { alignItems: 'center', marginTop: spacing.xl },
  warningCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.light.goldBorder,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningMark: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 33,
    color: colors.light.primary,
  },
  title: {
    ...typography.fontFamily.display,
    fontSize: 34,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  tabletPanel: {
    width: '100%',
    maxWidth: 516,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignSelf: 'center',
  },
  panelEyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 10,
    color: colors.light.maroon,
  },
  tabletTitle: {
    ...typography.fontFamily.display,
    fontSize: 28,
    color: colors.light.textPrimary,
  },
  tabletDescription: {
    ...typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.light.textSecondary,
  },
  timerCard: {
    width: '100%',
    minHeight: 114,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: spacing.lg,
  },
  tabletTimerCard: {
    minHeight: 150,
    marginVertical: 0,
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  timerLabel: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    color: colors.light.maroon,
  },
  timerValue: {
    ...typography.fontFamily.display,
    fontSize: 30,
    color: colors.light.primary,
  },
  tabletTimerValue: { fontSize: 38 },
  timerHint: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  tabletButtonWrap: { alignSelf: 'center', width: 276, marginTop: spacing.lg },
  note: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  tabletNote: { fontSize: 10, marginTop: spacing.md },
});
