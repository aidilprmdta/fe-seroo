import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { ROUTES } from "../../src/auth/routePolicy";
import LogoutButton from "../../src/components/LogoutButton";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ProfileButton from "../../src/components/ProfileButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import { createAdminAccountApi } from "../../src/accounts/api";
import { colors, spacing } from "../../src/theme/tokens";

const PAGE_SIZE = 50;
const ACCOUNT_ROLES = [
  { value: "OWNER_MITRA", label: "Owner Mitra" },
  { value: "MANAGER", label: "Manager" },
  { value: "CREW", label: "Crew" },
];

const ROLE_LABELS = {
  ADMIN_PUSAT: "Admin Pusat",
  OWNER_MITRA: "Owner Mitra",
  OWNER: "Owner",
  MANAGER: "Manager",
  CREW: "Crew",
};

function getAccountAccessLabel(account) {
  if (account.memberships.some((membership) => membership.role === "ADMIN_PUSAT")) {
    return "Admin Pusat · Semua outlet";
  }
  if (!account.memberships.length) {
    return "Belum memiliki outlet";
  }
  return account.memberships
    .map(
      (membership) =>
        `${ROLE_LABELS[membership.role] ?? membership.role} · ${membership.outlet.name}`,
    )
    .join("\n");
}

export default function AdminAccountsScreen() {
  const { user, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const api = useMemo(
    () => createAdminAccountApi({ request: apiRequest }),
    [apiRequest],
  );

  const [accounts, setAccounts] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingAccountId, setUpdatingAccountId] = useState(null);
  const [resettingAccountId, setResettingAccountId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const [resetAccountName, setResetAccountName] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("CREW");
  const [outletId, setOutletId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountData, outletData] = await Promise.all([
        api.getAccounts(1, PAGE_SIZE),
        api.getOutlets(),
      ]);
      setAccounts(accountData.accounts);
      setHasNextPage(accountData.hasNextPage);
      setPage(1);
      setOutlets(outletData.outlets);
      setOutletId((current) =>
        outletData.outlets.some((outlet) => outlet.id === current)
          ? current
          : outletData.outlets[0]?.id ?? "",
      );
    } catch (loadError) {
      setError(loadError.message || "Gagal memuat data akun.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = async () => {
    if (!hasNextPage || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await api.getAccounts(nextPage, PAGE_SIZE);
      setAccounts((current) => [...current, ...result.accounts]);
      setPage(nextPage);
      setHasNextPage(result.hasNextPage);
    } catch (loadError) {
      setError(loadError.message || "Gagal memuat halaman akun berikutnya.");
    } finally {
      setLoadingMore(false);
    }
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setPassword("");
    setShowPassword(false);
  };

  const handleCreateAccount = async () => {
    setError(null);
    setSuccess(null);
    if (!name.trim() || !email.trim() || !outletId) {
      setError("Nama, email, dan outlet wajib diisi.");
      return;
    }
    if (password.length < 12) {
      setError("Password awal harus terdiri dari minimal 12 karakter.");
      return;
    }

    setSaving(true);
    try {
      await api.createAccount({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        outletId,
      });
      closeCreateForm();
      setName("");
      setEmail("");
      setSuccess("Akun berhasil dibuat dan ditetapkan ke outlet.");
      await loadInitial();
    } catch (createError) {
      setError(createError.message || "Gagal membuat akun.");
    } finally {
      setSaving(false);
    }
  };

  const updateAccountStatus = async (account, isActive) => {
    setUpdatingAccountId(account.id);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.setAccountActive(account.id, isActive);
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? result.account : item,
        ),
      );
      setSuccess(
        `Akun ${account.name} berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
      );
    } catch (updateError) {
      setError(updateError.message || "Gagal mengubah status akun.");
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const confirmStatusChange = (account) => {
    const nextStatus = !account.isActive;
    Alert.alert(
      nextStatus ? "Aktifkan akun?" : "Nonaktifkan akun?",
      nextStatus
        ? `Akun ${account.name} dapat login kembali.`
        : `Akun ${account.name} akan kehilangan akses dan seluruh session aktifnya dicabut.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: nextStatus ? "Aktifkan" : "Nonaktifkan",
          style: nextStatus ? "default" : "destructive",
          onPress: () => updateAccountStatus(account, nextStatus),
        },
      ],
    );
  };

  const handleResetPassword = async (account) => {
    setResettingAccountId(account.id);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.resetPassword(account.id);
      setResetAccountName(account.name);
      setTemporaryPassword(result.temporaryPassword);
      setSuccess(`Password ${account.name} berhasil direset.`);
    } catch (resetError) {
      setError(resetError.message || "Gagal mereset password.");
    } finally {
      setResettingAccountId(null);
    }
  };

  const confirmPasswordReset = (account) => {
    Alert.alert(
      "Reset password akun?",
      `Password sementara untuk ${account.name} akan dibuat. Semua sesi aktif akun ini akan dicabut.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset Password",
          style: "destructive",
          onPress: () => handleResetPassword(account),
        },
      ],
    );
  };

  const dismissTemporaryPassword = () => {
    setTemporaryPassword(null);
    setResetAccountName("");
  };

  const beginCreate = () => {
    setError(null);
    setSuccess(null);
    setShowCreateForm(true);
  };

  const canCreate = outlets.length > 0;

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Seroo Pusat · Admin Pusat</Text>
            <Text style={styles.title}>Manajemen Akun</Text>
            <Text style={styles.subtitle}>
              {user?.name} · Buat dan kelola akses akun untuk outlet.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <PrimaryButton
              label="Kembali ke katalog"
              secondary
              onPress={() => router.replace(ROUTES.adminCatalog)}
            />
            <ProfileButton />
            <LogoutButton />
          </View>
        </View>

        <View style={styles.toolbar}>
          <Text style={styles.sectionTitle}>Daftar Akun</Text>
          <PrimaryButton
            label="+ Tambah Akun"
            disabled={!canCreate}
            onPress={beginCreate}
          />
        </View>

        {!canCreate && !loading ? (
          <Notice
            type="error"
            message="Belum ada outlet aktif. Aktifkan outlet sebelum membuat akun."
          />
        ) : null}
        {error ? <Notice type="error" message={error} /> : null}
        {success ? <Notice type="info" message={success} /> : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.helper}>Memuat data akun...</Text>
          </View>
        ) : accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Belum ada akun</Text>
            <Text style={styles.helper}>
              Tambahkan Owner Mitra, Manager, atau Crew untuk outlet aktif.
            </Text>
          </View>
        ) : (
          <View style={isWide ? styles.accountGrid : styles.accountColumn}>
            {accounts.map((account) => {
              const isAdmin = account.memberships.some(
                (membership) => membership.role === "ADMIN_PUSAT",
              );
              const canResetPassword =
                !isAdmin &&
                account.memberships.length > 0 &&
                account.memberships.every((membership) =>
                  ACCOUNT_ROLES.some((option) => option.value === membership.role),
                );
              const isSelf = account.id === user?.id;
              const statusDisabled =
                updatingAccountId === account.id ||
                (account.isActive && (isAdmin || isSelf));

              return (
                <View key={account.id} style={styles.accountCard}>
                  <View style={styles.accountHeading}>
                    <View style={styles.accountDetails}>
                      <Text style={styles.cardTitle}>{account.name}</Text>
                      <Text style={styles.email}>{account.email}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        account.isActive
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {account.isActive ? "Aktif" : "Nonaktif"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.accessLabel}>Role · Outlet</Text>
                  <Text style={styles.accessValue}>
                    {getAccountAccessLabel(account)}
                  </Text>
                  {isSelf ? (
                    <Text style={styles.helper}>Akun yang sedang digunakan</Text>
                  ) : null}
                  {isAdmin && account.isActive ? (
                    <Text style={styles.helper}>
                      Akun Admin Pusat tidak dapat dinonaktifkan dari halaman ini.
                    </Text>
                  ) : null}
                  <PrimaryButton
                    label={account.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
                    secondary={account.isActive}
                    disabled={statusDisabled}
                    loading={updatingAccountId === account.id}
                    onPress={() => confirmStatusChange(account)}
                  />
                  {canResetPassword && !isSelf ? (
                    <PrimaryButton
                      label="Reset Password"
                      secondary
                      disabled={resettingAccountId !== null}
                      loading={resettingAccountId === account.id}
                      onPress={() => confirmPasswordReset(account)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {hasNextPage ? (
          <View style={styles.loadMore}>
            <PrimaryButton
              label="Muat akun berikutnya"
              secondary
              loading={loadingMore}
              disabled={loadingMore}
              onPress={loadMore}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showCreateForm}
        transparent
        animationType="slide"
        onRequestClose={closeCreateForm}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isWide && styles.modalCardWide]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.form}
            >
              <Text style={styles.title}>Tambah Akun</Text>
              <Text style={styles.helper}>
                Akun dibuat untuk satu outlet. Password tidak dikirim otomatis;
                sampaikan secara terpisah melalui kanal yang aman.
              </Text>

              <View style={isWide ? styles.formRow : styles.formColumn}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nama</Text>
                  <TextInput
                    accessibilityLabel="Nama akun"
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    maxLength={120}
                    placeholder="Nama lengkap"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    accessibilityLabel="Email akun"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    maxLength={254}
                    placeholder="nama@contoh.com"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password awal</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    accessibilityLabel="Password awal akun"
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    maxLength={128}
                    placeholder="Minimal 12 karakter"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Sembunyikan password" : "Tampilkan password"
                    }
                    onPress={() => setShowPassword((current) => !current)}
                    style={styles.passwordToggle}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? "Sembunyikan" : "Tampilkan"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.optionList}>
                  {ACCOUNT_ROLES.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: role === option.value }}
                      onPress={() => setRole(option.value)}
                      style={[
                        styles.optionButton,
                        role === option.value && styles.optionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          role === option.value && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Outlet</Text>
                <View style={styles.optionList}>
                  {outlets.map((outlet) => (
                    <Pressable
                      key={outlet.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: outletId === outlet.id }}
                      onPress={() => setOutletId(outlet.id)}
                      style={[
                        styles.optionButton,
                        outletId === outlet.id && styles.optionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          outletId === outlet.id && styles.optionTextSelected,
                        ]}
                      >
                        {outlet.name} · {outlet.code}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error ? <Notice type="error" message={error} /> : null}
              <View style={styles.formActions}>
                <PrimaryButton
                  label="Batal"
                  secondary
                  disabled={saving}
                  onPress={closeCreateForm}
                />
                <PrimaryButton
                  label="Buat Akun"
                  loading={saving}
                  disabled={saving || !canCreate}
                  onPress={handleCreateAccount}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={temporaryPassword !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissTemporaryPassword}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.temporaryPasswordCard]}>
            <Text style={styles.title}>Password sementara</Text>
            <Text style={styles.helper}>
              Password untuk {resetAccountName} hanya ditampilkan kali ini.
              Sampaikan secara langsung melalui kanal yang aman.
            </Text>
            <Text selectable style={styles.temporaryPassword}>
              {temporaryPassword}
            </Text>
            <PrimaryButton
              label="Selesai"
              onPress={dismissTemporaryPassword}
            />
          </View>
        </View>
      </Modal>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 260,
    gap: spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  accountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  accountColumn: {
    flexDirection: "column",
    gap: spacing.md,
  },
  accountCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  accountDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  email: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  statusBadge: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: colors.infoSurface,
  },
  statusInactive: {
    backgroundColor: colors.dangerSurface,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  accessLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  accessValue: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  loadMore: {
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
  },
  modalCardWide: {
    maxWidth: 720,
  },
  temporaryPasswordCard: {
    maxWidth: 600,
    gap: spacing.md,
  },
  temporaryPassword: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formColumn: {
    gap: spacing.md,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggle: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  passwordToggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  optionList: {
    gap: spacing.xs,
  },
  optionButton: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  optionTextSelected: {
    fontWeight: "700",
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
