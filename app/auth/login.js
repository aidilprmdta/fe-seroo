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
import { useAuth } from "../../src/auth/AuthContext";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import { colors, spacing } from "../../src/theme/tokens";

export default function LoginScreen() {
  const {
    login,
    retryRestore,
    status,
    error: restoreError,
    notice,
    dismissNotice,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setFormError("Masukkan email dan password.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    dismissNotice();
    try {
      await login({ email: normalizedEmail, password });
      setPassword("");
    } catch (error) {
      setFormError(error.message || "Login tidak dapat diproses.");
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
          <View style={styles.form}>
            <Text style={styles.eyebrow}>Seroo · Operasional Outlet</Text>
            <Text style={styles.title}>Masuk</Text>
            <Text style={styles.subtitle}>
              Gunakan akun yang diberikan oleh administrator.
            </Text>

            <Notice message={notice} type="info" />
            <Notice message={restoreError} />
            <Notice message={formError} />

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={handleLogin}
                placeholder="nama@contoh.com"
                returnKeyType="next"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                placeholder="Password"
                returnKeyType="done"
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
            </View>

            <PrimaryButton
              label="Masuk"
              loading={submitting}
              disabled={status === "loading"}
              onPress={handleLogin}
            />

            {status === "error" ? (
              <PrimaryButton
                label="Coba pulihkan sesi"
                secondary
                loading={submitting}
                onPress={retryRestore}
              />
            ) : null}
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
    justifyContent: "center",
    padding: spacing.lg,
  },
  form: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
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
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
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
