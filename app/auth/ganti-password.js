// GantiPasswordScreen — Figma 05/06 · Wajib ganti password (HP & Tablet)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import Notice from '../../src/components/Notice';
import BaseButton from '../../src/components/BaseButton';
import Input from '../../src/components/Input';
import ScreenFrame from '../../src/components/ScreenFrame';
import { ROUTES, resolveLandingRoute } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

export default function GantiPasswordScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { status, user, selection, changePassword } = useAuth();
  const forced = user?.mustChangePassword === true;
  const isPreview = status !== 'authenticated';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleSave = useCallback(async () => {
    if (isPreview) return;
    setFormError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('Lengkapi semua kolom password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Konfirmasi password baru tidak sama.');
      return;
    }
    if (newPassword.length < 12) {
      setFormError('Password baru minimal 12 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      router.replace(
        user?.memberships
          ? resolveLandingRoute(user.memberships, selection)
          : ROUTES.profile,
      );
    } catch (err) {
      setFormError(err?.message || 'Password baru gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  }, [
    isPreview,
    currentPassword,
    newPassword,
    confirmPassword,
    changePassword,
    router,
    user,
    selection,
  ]);

  const form = (
    <>
      {isTablet ? (
        <>
          <Text style={styles.tabletEyebrow}>
            {forced ? 'PEMULIHAN AKUN' : 'UBAH PASSWORD'}
          </Text>
          <Text style={styles.tabletTitle}>Buat password baru</Text>
          <Text style={styles.tabletSubtitle}>
            Password sementara berhasil diverifikasi. Tetapkan password baru untuk melanjutkan.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.wordmark}>Seroo.</Text>
          <Text style={styles.eyebrow}>
            {forced ? 'PEMULIHAN AKUN' : 'UBAH PASSWORD'}
          </Text>
          <Text style={styles.title}>Buat password baru</Text>
          <Text style={styles.subtitle}>
            Password sementara berhasil diverifikasi. Buat password baru untuk melanjutkan.
          </Text>
        </>
      )}

      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>
          {forced ? 'Perubahan wajib' : 'Perubahan akun'}
        </Text>
        <Text style={styles.alertText}>
          {forced
            ? 'Langkah ini tidak dapat dilewati.'
            : 'Password baru akan langsung aktif setelah disimpan.'}
        </Text>
      </View>

      {isPreview && (
        <Notice
          message="Ini contoh tampilan. Silakan login untuk mengganti password."
          type="info"
        />
      )}
      {formError && <Notice message={formError} type="error" />}

      <View style={styles.form}>
        <Input
          label="Password sementara"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Masukkan password sementara"
          secureTextEntry
          disabled={isPreview || submitting}
        />
        <Input
          label="Password baru"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Buat password baru"
          secureTextEntry
          disabled={isPreview || submitting}
        />
        <Input
          label="Konfirmasi password baru"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password baru"
          secureTextEntry
          disabled={isPreview || submitting}
        />
      </View>

      <Text style={styles.helper}>
        Password baru harus sesuai kebijakan keamanan Seroo. Konfirmasi harus sama
        dengan password baru.
      </Text>

      <BaseButton
        label="Simpan password baru"
        onPress={handleSave}
        loading={submitting}
        disabled={isPreview}
        fullWidth
        size="lg"
      />

      <Text style={styles.footer}>
        {isTablet
          ? 'Setelah berhasil, sistem mengarahkan pengguna ke dashboard sesuai role dan outlet membership.'
          : 'Dashboard dibuka sesuai role dan outlet yang terdaftar.'}
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
            <View style={[styles.sidebar, { width: Math.min(360, width * 0.3) }]}>
              <Text style={styles.sidebarWordmark}>Seroo.</Text>
              <Text style={styles.sidebarEyebrow}>SISTEM OPERASIONAL SEROO</Text>
              <Text style={styles.sidebarHeadline}>
                Satu langkah keamanan sebelum masuk.
              </Text>
              <Text style={styles.sidebarCopy}>
                Password sementara harus diganti oleh pemilik akun. Langkah ini melindungi akses setelah proses reset.
              </Text>
              <Text style={styles.sidebarFootnote}>Tidak dapat dilewati.</Text>
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
    fontSize: 11,
    color: colors.light.textSecondary,
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
  tabletEyebrow: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  tabletTitle: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 28,
    color: colors.light.textPrimary,
  },
  tabletSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  alertBox: {
    minHeight: 60,
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  alertTitle: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 11,
    color: colors.light.maroon,
  },
  alertText: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textPrimary,
  },
  form: { gap: spacing.md },
  helper: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  footer: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
