// BantuanResetPasswordScreen — Figma 03/04 · Handphone & Tablet
import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import BaseButton from '../../src/components/BaseButton';
import ScreenFrame from '../../src/components/ScreenFrame';
import { ROUTES } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

const STEPS = [
  {
    title: 'Hubungi Owner Pusat',
    text: 'Gunakan kanal internal resmi yang disepakati Seroo.',
  },
  {
    title: 'Verifikasi identitas',
    text: 'Sebutkan username dan outlet terdaftar. Jangan kirim password lama.',
  },
  {
    title: 'Terima password sementara',
    text: 'Owner Pusat melakukan reset setelah memverifikasi permintaan.',
  },
  {
    title: 'Ganti setelah login',
    text: 'Password sementara wajib diganti sebelum menggunakan aplikasi.',
  },
];

export default function BantuanResetPasswordScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const handleBack = useCallback(() => {
    router.replace(ROUTES.login);
  }, [router]);

  const content = (
    <>
      {isTablet ? (
        <>
          <Text style={styles.tabletHeading}>Lupa password?</Text>
          <Text style={styles.tabletSubtitle}>Ikuti langkah pemulihan akses berikut.</Text>
        </>
      ) : (
        <>
          <Text style={styles.wordmark}>Seroo.</Text>
          <Text style={styles.eyebrow}>BANTUAN AKUN</Text>
          <Text style={styles.title}>Butuh reset password?</Text>
          <Text style={styles.subtitle}>
            Reset dilakukan oleh Owner Pusat untuk menjaga akses akun.
          </Text>
        </>
      )}

      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View style={[styles.stepCard, isTablet && styles.tabletStepCard]} key={step.title}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.security, isTablet && styles.tabletSecurity]}>
        <Text style={styles.securityTitle}>
          {isTablet ? 'Catatan keamanan' : 'Keamanan'}
        </Text>
        <Text style={styles.securityText}>
          {isTablet
            ? 'Rancangan ini belum menggunakan email OTP atau tautan reset otomatis. Password sementara disampaikan melalui kanal internal yang terverifikasi.'
            : 'Tidak ada pendaftaran mandiri atau reset otomatis melalui email/OTP pada rancangan ini.'}
        </Text>
      </View>

      <Pressable onPress={() => router.push(ROUTES.changePassword)}>
        <Text style={styles.previewLink}>Lihat contoh layar ganti password →</Text>
      </Pressable>

      <BaseButton
        label="Kembali ke login"
        onPress={handleBack}
        fullWidth
        size="lg"
      />
    </>
  );

  return (
    <ScreenFrame>
      {isTablet ? (
        <View style={styles.tabletRow}>
          <View style={[styles.sidebar, { width: Math.min(360, width * 0.3) }]}>
            <Text style={styles.sidebarWordmark}>Seroo.</Text>
            <Text style={styles.sidebarEyebrow}>SISTEM OPERASIONAL SEROO</Text>
            <Text style={styles.sidebarHeadline}>Pemulihan akses akun</Text>
            <Text style={styles.sidebarCopy}>
              Akun dikelola oleh Owner Pusat. Reset dilakukan setelah identitas pengguna diverifikasi.
            </Text>
            <Text style={styles.sidebarFootnote}>Tidak ada pendaftaran mandiri.</Text>
          </View>
          <ScrollView
            style={styles.tabletScroll}
            contentContainerStyle={styles.tabletContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tabletCard}>{content}</View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.phoneContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  phoneContent: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  wordmark: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 28,
    color: colors.light.primary,
  },
  eyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 10,
    color: colors.light.textSecondary,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 25,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
  },
  tabletRow: { flex: 1, flexDirection: 'row', backgroundColor: colors.light.background },
  sidebar: {
    backgroundColor: colors.light.maroon,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sidebarWordmark: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 36,
    color: colors.light.surface,
  },
  sidebarEyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 11,
    color: colors.light.primary,
    marginTop: spacing.md,
  },
  sidebarHeadline: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 30,
    lineHeight: 38,
    color: colors.light.surface,
    marginTop: spacing.xl,
  },
  sidebarCopy: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    lineHeight: 18,
    color: colors.light.surface,
    marginTop: spacing.md,
  },
  sidebarFootnote: {
    ...typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.surface,
    marginTop: 'auto',
  },
  tabletScroll: { flex: 1 },
  tabletContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  tabletCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing.xl + spacing.md,
    gap: spacing.md,
    maxWidth: 790,
    alignSelf: 'center',
    width: '100%',
  },
  tabletHeading: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 28,
    color: colors.light.textPrimary,
  },
  tabletSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: 13,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
  },
  steps: { gap: spacing.sm },
  stepCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tabletStepCard: { minHeight: 76 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.primary,
  },
  stepBody: { flex: 1, gap: spacing.xs },
  stepTitle: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 11,
    color: colors.light.textPrimary,
  },
  stepText: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    lineHeight: 13,
    color: colors.light.textSecondary,
  },
  security: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tabletSecurity: { minHeight: 74 },
  securityTitle: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 11,
    color: colors.light.maroon,
  },
  securityText: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    lineHeight: 13,
    color: colors.light.textPrimary,
  },
  previewLink: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    color: colors.light.primary,
    marginVertical: spacing.sm,
  },
});
