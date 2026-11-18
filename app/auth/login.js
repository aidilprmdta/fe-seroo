// LoginScreen — Figma 01/02 · Login Handphone & Tablet
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import Notice from '../../src/components/Notice';
import BaseButton from '../../src/components/BaseButton';
import Input from '../../src/components/Input';
import BrandLogo from '../../src/components/BrandLogo';
import ScreenFrame from '../../src/components/ScreenFrame';
import { ROUTES } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

function cooldownSecondsFromMessage(message) {
  const minutes = /(\d+)\s*menit/i.exec(message || '');
  if (minutes) return Math.max(1, Number(minutes[1])) * 60;
  return 15 * 60;
}

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { login, status, error: restoreError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleLogin = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setFormError('Masukkan email dan password.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await login({ email: normalizedEmail, password });
    } catch (err) {
      if (err?.code === 'RATE_LIMITED') {
        router.push({
          pathname: ROUTES.cooldown,
          params: { seconds: cooldownSecondsFromMessage(err?.message) },
        });
        return;
      }
      setFormError(err?.message || 'Login tidak dapat diproses.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, login, router]);

  const form = (
    <>
      {isTablet && (
        <Text style={styles.tabletEyebrow}>SELAMAT DATANG</Text>
      )}
      <Text style={[styles.title, isTablet && styles.tabletTitle]}>
        {isTablet ? 'Masuk ke Seroo' : 'Masuk ke akun'}
      </Text>
      <Text style={[styles.subtitle, isTablet && styles.tabletSubtitle]}>
        {isTablet
          ? 'Masukkan kredensial akun yang sudah dibuat.'
          : 'Gunakan akun yang diberikan pengelola.'}
      </Text>

      {(formError || restoreError) && (
        <Notice message={formError || restoreError} type="error" />
      )}

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Masukkan email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Masukkan password"
          secureTextEntry
        />
      </View>

      <Pressable onPress={() => router.push(ROUTES.forgotPassword)}>
        <Text style={styles.helpText}>
          {isTablet
            ? 'Lupa password? Minta Owner Pusat melakukan reset.'
            : 'Hubungi Owner Pusat jika perlu reset password.'}
        </Text>
      </Pressable>

      <BaseButton
        label="Masuk"
        onPress={handleLogin}
        loading={submitting}
        fullWidth
        size="lg"
      />

      <View style={[styles.alertBox, isTablet && styles.tabletAlertBox]}>
        <Text style={styles.alertText}>
          {isTablet
            ? 'Pendaftaran mandiri tidak tersedia.'
            : 'Akun dibuat oleh pengelola. Tidak ada pendaftaran mandiri.'}
        </Text>
      </View>

      {status === 'loading' ? (
        <Text style={styles.statusText}>Memulihkan sesi…</Text>
      ) : null}

      <Text style={[styles.footerText, isTablet && styles.tabletFooter]}>
        {isTablet
          ? 'Setelah login, sistem menampilkan outlet sesuai membership pengguna.'
          : 'Akses data mengikuti role dan outlet yang ditugaskan.'}
      </Text>
    </>
  );

  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {isTablet ? (
          <View style={styles.tabletRow}>
            <View style={[styles.sidebar, { width: Math.min(450, width * 0.36) }]}>
              <BrandLogo size={98} />
              <Text style={styles.sidebarEyebrow}>SISTEM OPERASIONAL SEROO</Text>
              <Text style={styles.sidebarHeadline}>
                Bekerja lebih rapi, melayani lebih cepat.
              </Text>
              <Text style={styles.sidebarCopy}>
                Satu aplikasi untuk transaksi, stok, waste, dan laporan outlet.
              </Text>
            </View>

            <ScrollView
              style={styles.tabletScroll}
              contentContainerStyle={styles.tabletContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.tabletCard}>{form}</View>
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.phoneContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BrandLogo size={82} />
            <Text style={styles.phoneCaption}>SISTEM OPERASIONAL SEROO</Text>
            {form}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  phoneContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  phoneCaption: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 11,
    color: colors.light.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tabletRow: { flex: 1, flexDirection: 'row', backgroundColor: colors.light.background },
  sidebar: {
    backgroundColor: colors.light.maroon,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  sidebarEyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.goldLight,
    marginTop: spacing.xl,
  },
  sidebarHeadline: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 34,
    lineHeight: 42,
    color: colors.light.surface,
  },
  sidebarCopy: {
    ...typography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.light.goldLight,
  },
  tabletScroll: { flex: 1 },
  tabletContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  tabletCard: {
    width: '100%',
    maxWidth: 630,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl + 2,
    padding: spacing.xxl + spacing.sm,
    gap: spacing.md,
  },
  tabletEyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.primary,
  },
  title: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 29,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  tabletTitle: { fontSize: 30, textAlign: 'left' },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: 15,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  tabletSubtitle: { fontSize: 14, textAlign: 'left' },
  form: { gap: spacing.md, width: '100%' },
  helpText: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  alertBox: {
    width: '100%',
    minHeight: 56,
    backgroundColor: colors.light.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletAlertBox: { minHeight: 54 },
  alertText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.maroon,
    textAlign: 'center',
  },
  statusText: {
    ...typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  footerText: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tabletFooter: { fontSize: 12, marginTop: 0 },
});
