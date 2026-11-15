import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { ROUTES } from "../src/auth/routePolicy";
import Notice from "../src/components/Notice";
import PrimaryButton from "../src/components/PrimaryButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { createExpenseApi } from "../src/expenses/api";
import { canReachInternet } from "../src/pos/cart";
import { colors, spacing } from "../src/theme/tokens";

const AMOUNT_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayLocal() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function snapshotSummary(snapshot) {
  if (!snapshot) return "Data tidak tersedia";
  return [
    snapshot.categoryName ?? "Kategori tidak tersedia",
    `Rp ${snapshot.amount ?? "-"}`,
    snapshot.status === "CANCELLED" ? "Dibatalkan" : "Aktif",
    new Date(snapshot.expenseDate).toLocaleDateString("id-ID"),
  ].join(" · ");
}

function ExpenseField({
  label,
  value,
  onChangeText,
  disabled,
  numeric = false,
  multiline = false,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        keyboardType={numeric ? "decimal-pad" : "default"}
        maxLength={500}
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.multiline]}
        value={value}
      />
    </View>
  );
}

export default function ExpensesScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const canManage = role === "MANAGER";
  const api = useMemo(
    () => createExpenseApi({ request: apiRequest }),
    [apiRequest],
  );
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [fullAudits, setFullAudits] = useState({});
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayLocal);
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const pendingRef = useRef(null);
  const savingRef = useRef(false);
  const wideLayout = width >= 900;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, expenseResult] = await Promise.all([
        api.getCategories(),
        api.getExpenses(outletId),
      ]);
      setCategories(categoryResult.categories);
      setExpenses(expenseResult.expenses);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingExpenseId(null);
    setCategoryId("");
    setAmount("");
    setExpenseDate(todayLocal());
    setDescription("");
    setReason("");
  };

  const executeOperation = async (operation) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!canReachInternet(networkState)) {
        setError("Pengeluaran hanya dapat dikirim saat online.");
        return;
      }

      let result;
      if (operation.type === "CREATE") {
        result = await api.createExpense(outletId, operation.payload);
      } else if (operation.type === "CORRECT") {
        result = await api.correctExpense(
          outletId,
          operation.expenseId,
          operation.payload,
        );
      } else {
        result = await api.cancelExpense(
          outletId,
          operation.expenseId,
          operation.payload,
        );
      }
      pendingRef.current = null;
      setPendingOperation(null);
      setNotice(
        result.replayed
          ? "Perubahan ini sudah tersimpan sebelumnya."
          : operation.type === "CANCEL"
            ? "Pengeluaran dibatalkan dan jejak audit tersimpan."
            : operation.type === "CORRECT"
              ? "Koreksi tersimpan dan jejak audit dibuat."
              : "Pengeluaran tersimpan di server.",
      );
      resetForm();
      await loadData();
    } catch (operationError) {
      if (operationError.status && operationError.status < 500) {
        pendingRef.current = null;
        setPendingOperation(null);
      }
      setError(operationError.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveExpense = () => {
    if (!canManage || savingRef.current || pendingRef.current) return;
    const date = new Date(`${expenseDate}T00:00:00.000Z`);
    if (
      !categoryId ||
      !AMOUNT_PATTERN.test(amount) ||
      Number(amount) <= 0 ||
      !DATE_PATTERN.test(expenseDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== expenseDate
    ) {
      setError("Pilih kategori, nominal positif, dan tanggal yang valid.");
      return;
    }

    const payload = {
      clientTransactionId: Crypto.randomUUID(),
      ...(editingExpenseId ? {} : { categoryId }),
      ...(editingExpenseId
        ? {
            categoryId,
            reason: reason.trim() || undefined,
          }
        : {}),
      amount,
      expenseDate: date.toISOString(),
      description: description.trim() || null,
    };
    const operation = {
      type: editingExpenseId ? "CORRECT" : "CREATE",
      ...(editingExpenseId ? { expenseId: editingExpenseId } : {}),
      payload,
    };
    pendingRef.current = operation;
    setPendingOperation(operation);
    executeOperation(operation);
  };

  const beginEdit = (expense) => {
    if (!canManage || pendingOperation || expense.status !== "ACTIVE") return;
    setEditingExpenseId(expense.id);
    setCategoryId(expense.category.id);
    setAmount(expense.amount);
    setExpenseDate(expense.expenseDate.slice(0, 10));
    setDescription(expense.description ?? "");
    setReason("");
    setError(null);
    setNotice(null);
  };

  const confirmCancellation = (expense) => {
    if (!canManage || pendingRef.current || expense.status !== "ACTIVE") return;
    Alert.alert(
      "Batalkan pengeluaran?",
      "Data tidak dihapus. Status dan snapshot sebelum/sesudah akan disimpan di audit.",
      [
        { text: "Kembali", style: "cancel" },
        {
          text: "Batalkan",
          style: "destructive",
          onPress: () => {
            const operation = {
              type: "CANCEL",
              expenseId: expense.id,
              payload: { clientTransactionId: Crypto.randomUUID() },
            };
            pendingRef.current = operation;
            setPendingOperation(operation);
            executeOperation(operation);
          },
        },
      ],
    );
  };

  const loadFullAudit = async (expenseId) => {
    setError(null);
    try {
      const result = await api.getAudit(outletId, expenseId);
      setFullAudits((current) => ({ ...current, [expenseId]: result.audits }));
    } catch (auditError) {
      setError(auditError.message);
    }
  };

  const outlet = user.memberships.find(
    (membership) => membership.outletId === outletId,
  );
  const formDisabled = saving || pendingOperation !== null;

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Keuangan · {role}</Text>
            <Text style={styles.title}>Pengeluaran</Text>
            <Text style={styles.subtitle}>{outlet?.outletName}</Text>
          </View>
          <View style={styles.headerActions}>
            <PrimaryButton label="Muat ulang" secondary onPress={loadData} />
            <PrimaryButton
              label="Kembali"
              secondary
              onPress={() =>
                router.replace(
                  role === "MANAGER" ? ROUTES.manager : ROUTES.owner,
                )
              }
            />
          </View>
        </View>

        <Notice message={error} type="error" />
        <Notice message={notice} type="success" />
        {pendingOperation ? (
          <View style={styles.pendingBox}>
            <Text style={styles.helper}>
              Hasil perubahan belum diketahui. Retry memakai ID dan payload
              transaksi yang sama; jangan buat ulang operasi ini.
            </Text>
            <PrimaryButton
              label="Coba kirim lagi"
              loading={saving}
              onPress={() => executeOperation(pendingOperation)}
            />
          </View>
        ) : null}

        <View style={[styles.content, wideLayout && styles.wideContent]}>
          {canManage ? (
            <View style={[styles.panel, wideLayout && styles.formPanel]}>
              <Text style={styles.sectionTitle}>
                {editingExpenseId ? "Koreksi pengeluaran" : "Catat pengeluaran"}
              </Text>
              <Text style={styles.helper}>
                Kategori saat ini bersifat sementara dan dapat berubah setelah
                konfirmasi Seroo.
              </Text>
              <View style={styles.field}>
                <Text style={styles.label}>Kategori</Text>
                <View style={styles.categoryList}>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: category.id === categoryId,
                      }}
                      disabled={formDisabled}
                      onPress={() => setCategoryId(category.id)}
                      style={[
                        styles.categoryOption,
                        category.id === categoryId && styles.categorySelected,
                        formDisabled && styles.disabled,
                      ]}
                    >
                      <Text style={styles.categoryName}>{category.name}</Text>
                      {category.status === "PROVISIONAL" ? (
                        <Text style={styles.provisional}>Sementara</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
                {categories.length === 0 && !loading ? (
                  <Text style={styles.helper}>
                    Belum ada kategori pengeluaran dari server.
                  </Text>
                ) : null}
              </View>
              <ExpenseField
                label="Nominal (Rp)"
                value={amount}
                onChangeText={setAmount}
                disabled={formDisabled}
                numeric
              />
              <ExpenseField
                label="Tanggal (YYYY-MM-DD)"
                value={expenseDate}
                onChangeText={setExpenseDate}
                disabled={formDisabled}
              />
              <ExpenseField
                label="Keterangan (opsional)"
                value={description}
                onChangeText={setDescription}
                disabled={formDisabled}
                multiline
              />
              {editingExpenseId ? (
                <ExpenseField
                  label="Alasan koreksi (opsional)"
                  value={reason}
                  onChangeText={setReason}
                  disabled={formDisabled}
                  multiline
                />
              ) : null}
              <View style={styles.formActions}>
                <PrimaryButton
                  label={editingExpenseId ? "Simpan koreksi" : "Simpan"}
                  disabled={formDisabled || categories.length === 0}
                  loading={saving}
                  onPress={saveExpense}
                />
                {editingExpenseId && !pendingOperation ? (
                  <PrimaryButton
                    label="Batal koreksi"
                    secondary
                    onPress={resetForm}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={[styles.panel, wideLayout && styles.listPanel]}>
            <Text style={styles.sectionTitle}>Daftar pengeluaran</Text>
            {loading ? (
              <Text style={styles.helper}>Memuat data pengeluaran…</Text>
            ) : expenses.length === 0 ? (
              <Text style={styles.helper}>
                Belum ada pengeluaran yang tercatat untuk outlet ini.
              </Text>
            ) : (
              expenses.map((expense) => {
                const audits = fullAudits[expense.id] ?? expense.audits;
                return (
                  <View key={expense.id} style={styles.expenseCard}>
                    <View style={styles.expenseHeading}>
                      <Text style={styles.expenseCategory}>
                        {expense.category.name}
                      </Text>
                      <Text
                        style={[
                          styles.status,
                          expense.status === "CANCELLED" && styles.cancelled,
                        ]}
                      >
                        {expense.status === "ACTIVE" ? "Aktif" : "Dibatalkan"}
                      </Text>
                    </View>
                    <Text style={styles.amount}>Rp {expense.amount}</Text>
                    <Text style={styles.expenseMeta}>
                      {new Date(expense.expenseDate).toLocaleDateString("id-ID")}
                      {" · "}Dibuat oleh {expense.createdBy?.name ?? "Manager"}
                    </Text>
                    {expense.description ? (
                      <Text style={styles.description}>{expense.description}</Text>
                    ) : null}
                    {canManage && expense.status === "ACTIVE" ? (
                      <View style={styles.formActions}>
                        <PrimaryButton
                          label="Koreksi"
                          secondary
                          disabled={formDisabled || editingExpenseId !== null}
                          onPress={() => beginEdit(expense)}
                        />
                        <PrimaryButton
                          label="Batalkan"
                          secondary
                          disabled={formDisabled || editingExpenseId !== null}
                          onPress={() => confirmCancellation(expense)}
                        />
                      </View>
                    ) : null}
                    {audits.length > 0 ? (
                      <View style={styles.auditList}>
                        <Text style={styles.auditHeading}>Riwayat audit</Text>
                        {audits.map((audit) => (
                          <View key={audit.id} style={styles.auditEntry}>
                            <Text style={styles.auditAction}>
                              {audit.action === "CORRECTED"
                                ? "Dikoreksi"
                                : "Dibatalkan"}
                              {" · "}
                              {new Date(audit.createdAt).toLocaleString("id-ID")}
                            </Text>
                            <Text style={styles.helper}>
                              Sebelum: {snapshotSummary(audit.before)}
                            </Text>
                            <Text style={styles.helper}>
                              Sesudah: {snapshotSummary(audit.after)}
                            </Text>
                            {audit.reason ? (
                              <Text style={styles.helper}>
                                Alasan: {audit.reason}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {audits.length === 10 ? (
                      <PrimaryButton
                        label="Muat seluruh riwayat audit"
                        secondary
                        onPress={() => loadFullAudit(expense.id)}
                      />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
    fontSize: 16,
    marginTop: spacing.xs,
  },
  content: {
    gap: spacing.md,
  },
  wideContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formPanel: {
    flex: 0.9,
    minWidth: 340,
  },
  listPanel: {
    flex: 1.1,
    minWidth: 380,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  pendingBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.infoSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  multiline: {
    minHeight: 76,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryOption: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: "center",
  },
  categorySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  categoryName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  provisional: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  disabled: {
    opacity: 0.55,
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  expenseCard: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  expenseHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  expenseCategory: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  status: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  cancelled: {
    color: colors.danger,
  },
  amount: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  expenseMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  description: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  auditList: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  auditHeading: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  auditEntry: {
    borderLeftWidth: 2,
    borderColor: colors.primary,
    paddingLeft: spacing.sm,
    gap: 4,
  },
  auditAction: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
});
