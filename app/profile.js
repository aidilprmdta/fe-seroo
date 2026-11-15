import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import LogoutButton from "../src/components/LogoutButton";
import Notice from "../src/components/Notice";
import PrimaryButton from "../src/components/PrimaryButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { colors, spacing } from "../src/theme/tokens";

export default function ProfileScreen() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const passwordChangeRequired = user.mustChangePassword;

  async function handleChangePassword() {
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmation) {
      setError("Lengkapi password lama dan password baru.");
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Password baru harus terdiri dari 12–128 karakter.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Password baru harus berbeda dari password lama.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess("Password berhasil diubah. Sesi aktif pada perangkat lain dicabut.");
    } catch (changeError) {
      setError(changeError.message || "Password tidak dapat diubah.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Seroo · Profil</Text>
                <Text style={styles.title}>Profil Pengguna</Text>
                <Text style={styles.subtitle}>
                  {user.name} · {user.email}
                </Text>
              </View>
              {!passwordChangeRequired ? (
                <PrimaryButton
                  label="Kembali"
                  secondary
                  onPress={() => router.back()}
                />
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Keanggotaan</Text>
              {user.memberships.length ? (
                user.memberships.map((membership) => (
                  <Text
                    key={`${membership.outletId}-${membership.role}`}
                    style={styles.membership}
                  >
                    {membership.role} · {membership.outletName}
                  </Text>
                ))
              ) : (
                <Text style={styles.subtitle}>Belum ada outlet yang ditetapkan.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ubah Password</Text>
              {passwordChangeRequired ? (
                <Notice
                  type="error"
                  message="Password sementara wajib diganti sebelum menggunakan fitur aplikasi."
                />
              ) : null}
              {error ? <Notice type="error" message={error} /> : null}
              {success ? <Notice type="info" message={success} /> : null}

              <View style={styles.field}>
                <Text style={styles.label}>Password lama</Text>
                <TextInput
                  accessibilityLabel="Password lama"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  maxLength={1024}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  style={styles.input}
                  textContentType="password"
                  value={currentPassword}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Password baru</Text>
                <TextInput
                  accessibilityLabel="Password baru"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  maxLength={128}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={newPassword}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Konfirmasi password baru</Text>
                <TextInput
                  accessibilityLabel="Konfirmasi password baru"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  maxLength={128}
                  onChangeText={setConfirmation}
                  onSubmitEditing={handleChangePassword}
                  returnKeyType="done"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={confirmation}
                />
              </View>

              <PrimaryButton
                label="Ubah Password"
                loading={submitting}
                disabled={submitting}
                onPress={handleChangePassword}
              />
            </View>

            <LogoutButton />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 260,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "700",
  },
  membership: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
