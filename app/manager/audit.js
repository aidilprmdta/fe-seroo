// ManagerAuditScreen — Figma Audit · Manager (HP & Tablet)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { createApiRequestWrapper } from "../../src/api/api";
import { createAuditApi } from "../../src/api/audit";
import {
  AUDIT_MODULES,
  AUDIT_OUTCOMES,
  AUDIT_PERIODS,
  buildAuditQuery,
  describeAction,
  formatAuditDay,
  formatAuditTime,
  formatManagerMetadata,
  metadataSummary,
  moduleLabel,
} from "../../src/audit/query";
import AppShell from "../../src/components/AppShell";
import Badge from "../../src/components/Badge";
import BaseButton from "../../src/components/BaseButton";
import EmptyState from "../../src/components/EmptyState";
import Modal from "../../src/components/Modal";
import Notice from "../../src/components/Notice";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const PAGE_SIZE = 20;

function FilterChips({ label, options, value, onChange, hint }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={`${label}-${option.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {hint ? <Text style={styles.filterHint}>{hint}</Text> : null}
    </View>
  );
}

function activityTag(log) {
  const day = formatAuditDay(log.createdAt);
  const module = moduleLabel(log.resourceType).toUpperCase();
  if (day === "HARI INI") return `${formatAuditTime(log.createdAt)} · ${module}`;
  return `${day} · ${module}`;
}

export default function ManagerAuditScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;
  const outletLabel =
    (user?.memberships ?? []).find(
      (membership) => membership.outletId === outletId,
    )?.outletName ?? "Outlet";

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("TODAY");
  const [module, setModule] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const api = createAuditApi({
        request: createApiRequestWrapper(apiRequest),
      });
      const params = buildAuditQuery({
        period,
        module,
        actorUserId,
        outcome,
        page,
        pageSize: PAGE_SIZE,
      });
      const response = await api.listOutletAuditLogs(outletId, params);
      setLogs(response?.data?.auditLogs ?? []);
      setPagination(
        response?.data?.pagination ?? {
          page,
          pageSize: PAGE_SIZE,
          hasNextPage: false,
        },
      );
    } catch (err) {
      setLogs([]);
      setError(err?.message || "Riwayat aktivitas gagal dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest, outletId, period, module, actorUserId, outcome, page]);

  useEffect(() => {
    load();
  }, [load]);

  const actorOptions = useMemo(() => {
    const actors = new Map();
    for (const log of logs) {
      if (log.actor?.id && !actors.has(log.actor.id)) {
        actors.set(log.actor.id, log.actor.name || "Pengguna");
      }
    }
    return [
      { value: "", label: "Semua pengguna" },
      ...[...actors.entries()].map(([id, name]) => ({
        value: id,
        label: name,
      })),
      ...(actorUserId && !actors.has(actorUserId)
        ? [{ value: actorUserId, label: "Pengguna terpilih" }]
        : []),
    ];
  }, [logs, actorUserId]);

  const detailMetadata = useMemo(
    () => (detail ? formatManagerMetadata(detail.metadata) : []),
    [detail],
  );

  const applyFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
    setLoading(true);
  };
  return (
    <AppShell
      navRole="manager"
      active="aktivitas"
      roleLabel="Manager"
      title="Riwayat Aktivitas Outlet"
      subtitle={outletLabel}
      outletLabel={outletLabel}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      {error ? <Notice message={error} type="error" /> : null}

      <View style={styles.filters}>
        <FilterChips
          label="Periode"
          options={AUDIT_PERIODS}
          value={period}
          onChange={applyFilter(setPeriod)}
        />
        <FilterChips
          label="Modul"
          options={AUDIT_MODULES}
          value={module}
          onChange={applyFilter(setModule)}
        />
        <FilterChips
          label="Pengguna"
          options={actorOptions}
          value={actorUserId}
          onChange={applyFilter(setActorUserId)}
          hint="Opsi berasal dari aktivitas yang sedang termuat, bukan seluruh pengguna outlet."
        />
        <FilterChips
          label="Status"
          options={AUDIT_OUTCOMES}
          value={outcome}
          onChange={applyFilter(setOutcome)}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoKicker}>RIWAYAT PERUBAHAN</Text>
        <Text style={styles.infoText}>
          Aktivitas operasional outlet tercatat di satu tempat.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.loadingText}>Memuat riwayat aktivitas…</Text>
        </View>
      ) : error ? null : logs.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas"
          subtitle="Aktivitas outlet akan muncul setelah ada transaksi atau perubahan data."
        />
      ) : (
        <View style={styles.list}>
          {logs.map((log) => {
            const summary = metadataSummary(log.metadata);
            return (
              <Pressable
                key={log.id}
                accessibilityRole="button"
                accessibilityLabel={`Buka detail aktivitas ${describeAction(log.action)}`}
                onPress={() => setDetail(log)}
                style={({ pressed }) => [
                  styles.logCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.logHeader}>
                  <Text style={styles.logTag}>{activityTag(log)}</Text>
                  {log.outcome === "FAILURE" ? (
                    <Badge label="Gagal" variant="danger" size="sm" />
                  ) : null}
                </View>
                <Text style={styles.logTitle}>{describeAction(log.action)}</Text>
                <Text style={styles.logActor}>
                  {log.actor?.name || "Sistem"} · {moduleLabel(log.resourceType)}
                </Text>
                {summary ? <Text style={styles.logBody}>{summary}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {!loading && logs.length > 0 ? (
        <View style={styles.pager}>
          <View style={styles.pagerButton}>
            <BaseButton
              label="Sebelumnya"
              variant="secondary"
              fullWidth
              disabled={page <= 1}
              onPress={() => {
                setPage((current) => Math.max(1, current - 1));
                setLoading(true);
              }}
            />
          </View>
          <Text style={styles.pagerText}>
            Halaman {pagination.page ?? page}
          </Text>
          <View style={styles.pagerButton}>
            <BaseButton
              label="Berikutnya"
              variant="secondary"
              fullWidth
              disabled={!pagination.hasNextPage}
              onPress={() => {
                setPage((current) => current + 1);
                setLoading(true);
              }}
            />
          </View>
        </View>
      ) : null}

      <Text style={styles.footer}>
        Hanya aktivitas outlet yang ditugaskan.
      </Text>
      <Modal
        visible={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? describeAction(detail.action) : "Detail aktivitas"}
        subtitle={
          detail
            ? `${moduleLabel(detail.resourceType)} · ${formatAuditDay(
                detail.createdAt,
              )} ${formatAuditTime(detail.createdAt)}`
            : null
        }
        footer={
          <BaseButton
            label="Tutup"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => setDetail(null)}
          />
        }
      >
        {detail ? (
          <View style={styles.detailContent}>
            <DetailRow label="Aktor" value={detail.actor?.name || "Sistem"} />
            <DetailRow
              label="Status"
              value={detail.outcome === "FAILURE" ? "Gagal" : "Berhasil"}
            />
            <DetailRow
              label="Modul"
              value={moduleLabel(detail.resourceType)}
            />
            <DetailRow
              label="ID entitas"
              value={detail.resourceId || "-"}
            />
            <DetailRow
              label="Waktu"
              value={new Date(detail.createdAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}
            />
            <Text style={styles.detailSection}>Detail tambahan</Text>
            {detailMetadata.length === 0 ? (
              <Text style={styles.metadataEmpty}>
                Tidak ada detail tambahan
              </Text>
            ) : (
              detailMetadata.map((row) => (
                <DetailRow key={row.key} label={row.label} value={row.value} />
              ))
            )}
          </View>
        ) : null}
      </Modal>
    </AppShell>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm },
  filterGroup: { gap: spacing.xs },
  filterLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: "uppercase",
  },
  filterHint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
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
  chipTextActive: { color: colors.light.onPrimary },
  infoCard: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  infoKicker: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: "uppercase",
  },
  infoText: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  list: { gap: spacing.sm },
  logCard: {
    padding: spacing.md,
    gap: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  pressed: { opacity: 0.75 },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  logTag: {
    ...typography.fontFamily.bold,
    ...typography.weights.bold,
    fontSize: typography.sizes.xs,
    color: colors.light.maroon,
  },
  logTitle: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  logActor: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.maroon,
  },
  logBody: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
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
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pagerButton: { flex: 1 },
  pagerText: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textAlign: "center",
  },
  footer: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  detailContent: { padding: spacing.md, gap: spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.divider,
  },
  detailLabel: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  detailValue: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  detailSection: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  metadataEmpty: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
});



