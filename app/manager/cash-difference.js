// ManagerCashDifferenceScreen — Figma 04 · Pemeriksaan selisih kas (HP & Tablet)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { createApiRequestWrapper } from "../../src/api/api";
import { createClosingsApi } from "../../src/api/closings";
import AppShell from "../../src/components/AppShell";
import Badge from "../../src/components/Badge";
import BaseButton from "../../src/components/BaseButton";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";
import Input from "../../src/components/Input";
import Modal from "../../src/components/Modal";
import Notice from "../../src/components/Notice";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const STATUS_OPTIONS = [
  { value: "BELUM_DIPERIKSA", label: "Belum diperiksa", variant: "warning" },
  { value: "SEDANG_DIPERIKSA", label: "Sedang diperiksa", variant: "info" },
  { value: "SUDAH_DIKETAHUI", label: "Sudah diketahui", variant: "success" },
  { value: "BELUM_TERSELESAIKAN", label: "Belum terselesaikan", variant: "danger" },
];

const STATUS_LABEL = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
);
const STATUS_VARIANT = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.variant]),
);

const PERIOD_OPTIONS = [
  { value: "SEMUA", label: "Semua" },
  { value: "BULAN_INI", label: "Bulan ini" },
];

const MONTH_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Jakarta",
});

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  return Number(value).toLocaleString("id-ID");
}

function FilterChips({ label, options, value, onChange }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export default function ManagerCashDifferenceScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;
  const outletLabel =
    (user?.memberships ?? []).find((membership) => membership.outletId === outletId)
      ?.outletName ?? "Outlet";
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [periodFilter, setPeriodFilter] = useState("SEMUA");
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [selectedId, setSelectedId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("BELUM_DIPERIKSA");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const getApi = useCallback(
    () => createClosingsApi({ request: createApiRequestWrapper(apiRequest) }),
    [apiRequest],
  );

  const loadClosings = useCallback(async () => {
    if (!outletId) return;
    setError(null);
    setSuccess(null);
    try {
      const data = await getApi().listClosings(outletId, { type: "DAILY" });
      setClosings(data?.data?.closings ?? []);
    } catch (err) {
      setError(err?.message || "Daftar selisih kas gagal dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getApi, outletId]);

  useEffect(() => {
    loadClosings();
  }, [loadClosings]);

  const currentMonth = MONTH_KEY_FORMAT.format(new Date());

  const rows = useMemo(
    () =>
      closings.filter(
        (closing) =>
          closing.cashDifference !== null && closing.cashDifference !== undefined,
      ),
    [closings],
  );

  const periodScoped = useMemo(
    () =>
      rows.filter(
        (closing) =>
          periodFilter !== "BULAN_INI" ||
          String(closing.periodKey || "").slice(0, 7) === currentMonth,
      ),
    [rows, periodFilter, currentMonth],
  );

  const counts = useMemo(() => {
    const result = {
      BELUM_DIPERIKSA: 0,
      SEDANG_DIPERIKSA: 0,
      SUDAH_DIKETAHUI: 0,
      BELUM_TERSELESAIKAN: 0,
    };
    for (const closing of periodScoped) {
      const status = closing.cashDifferenceStatus || "BELUM_DIPERIKSA";
      if (result[status] !== undefined) result[status] += 1;
    }
    return result;
  }, [periodScoped]);

  const filteredRows = useMemo(
    () =>
      periodScoped.filter(
        (closing) =>
          statusFilter === "SEMUA" ||
          (closing.cashDifferenceStatus || "BELUM_DIPERIKSA") === statusFilter,
      ),
    [periodScoped, statusFilter],
  );

  const selectedClosing =
    rows.find((closing) => closing.id === selectedId) ?? null;

  const openReview = (closing) => {
    setReviewTarget(closing);
    setReviewStatus(closing.cashDifferenceStatus || "BELUM_DIPERIKSA");
    setReviewNote(closing.cashDifferenceReviewNote || "");
    setError(null);
  };

  const handleSaveReview = useCallback(async () => {
    if (!reviewTarget) return;
    setSaving(true);
    setError(null);
    try {
      await getApi().updateCashDifference(outletId, reviewTarget.id, {
        status: reviewStatus,
        note: reviewNote.trim() || undefined,
      });
      setReviewTarget(null);
      setSuccess("Status investigasi selisih kas diperbarui.");
      await loadClosings();
    } catch (err) {
      setError(err?.message || "Status selisih kas gagal diperbarui.");
    } finally {
      setSaving(false);
    }
  }, [reviewTarget, reviewStatus, reviewNote, getApi, outletId, loadClosings]);
  return (
    <AppShell
      navRole="manager"
      active="selisih"
      roleLabel="Manager"
      title="Pemeriksaan selisih kas"
      subtitle="Tinjau hasil closing dan dokumentasikan tindak lanjut."
      outletLabel={outletLabel}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadClosings();
          }}
        />
      }
    >
      {success && !reviewTarget ? (
        <Notice message={success} type="success" />
      ) : null}
      {error && !reviewTarget ? <Notice message={error} type="error" /> : null}

      <View style={styles.summaryGrid}>
        {STATUS_OPTIONS.map((option) => (
          <View key={option.value} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{option.label}</Text>
            <Text style={styles.summaryValue}>
              {counts[option.value] ?? 0}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.filterRow}>
        <FilterChips
          label="Periode"
          options={PERIOD_OPTIONS}
          value={periodFilter}
          onChange={setPeriodFilter}
        />
        <FilterChips
          label="Status pemeriksaan"
          options={[
            { value: "SEMUA", label: "Semua" },
            ...STATUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </View>

      <Card style={styles.listCard}>
        <Text style={styles.listTitle}>Daftar selisih kas</Text>
        <Text style={styles.listSubtitle}>
          Status pemeriksaan mengikuti hasil investigasi Manager.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.loadingText}>Memuat closing…</Text>
          </View>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="Tidak ada selisih kas"
            subtitle="Belum ada closing dengan selisih pada filter ini."
          />
        ) : (
          <View style={styles.list}>
            {filteredRows.map((closing) => {
              const status = closing.cashDifferenceStatus || "BELUM_DIPERIKSA";
              const active = closing.id === selectedId;
              return (
                <Pressable
                  key={closing.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedId(active ? null : closing.id)}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      Closing · {closing.periodKey}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Selisih Rp {formatRupiah(closing.cashDifference)}
                      {closing.differenceReason
                        ? ` · ${closing.differenceReason}`
                        : ""}
                    </Text>
                    {closing.cashDifferenceReviewNote ? (
                      <Text style={styles.rowMeta}>
                        {closing.cashDifferenceReviewNote}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={STATUS_LABEL[status] || status}
                    variant={STATUS_VARIANT[status] || "default"}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <View style={[styles.actionWrap, isWide && styles.actionWrapWide]}>
        <BaseButton
          label="Buka pemeriksaan"
          size="lg"
          fullWidth={!isWide}
          disabled={!selectedClosing}
          onPress={() => selectedClosing && openReview(selectedClosing)}
        />
      </View>
      <Modal
        visible={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title="Investigasi selisih kas"
        subtitle={
          reviewTarget
            ? `Periode ${reviewTarget.periodKey} · Selisih Rp ${formatRupiah(reviewTarget.cashDifference)}`
            : null
        }
        footer={
          <BaseButton
            label="Simpan status"
            onPress={handleSaveReview}
            loading={saving}
            disabled={saving}
            fullWidth
            size="lg"
          />
        }
      >
        <View style={styles.modalContent}>
          {error ? <Notice message={error} type="error" /> : null}
          <Text style={styles.modalLabel}>Status pemeriksaan</Text>
          <View style={styles.chipWrap}>
            {STATUS_OPTIONS.map((option) => {
              const active = reviewStatus === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setReviewStatus(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            label="Catatan tindak lanjut (opsional)"
            value={reviewNote}
            onChangeText={setReviewNote}
            placeholder="Contoh: selisih karena uang kembalian"
            maxLength={500}
          />
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: "47%",
    padding: spacing.md,
    gap: 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  summaryLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  summaryValue: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  filterGroup: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 180,
    gap: spacing.xs,
  },
  filterLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: "uppercase",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  chipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  chipText: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  chipTextActive: {
    color: colors.light.onPrimary,
  },
  listCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  listTitle: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  listSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  rowMeta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  rowSelected: {
    backgroundColor: colors.light.surfaceSecondary,
    borderColor: colors.light.primary,
  },
  rowPressed: {
    opacity: 0.75,
  },
  actionWrap: {
    marginTop: spacing.xs,
  },
  actionWrapWide: {
    alignItems: "flex-end",
  },
  modalContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  modalLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: "uppercase",
  },
});





