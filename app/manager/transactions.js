// ManagerTransactionsScreen — Figma 01 · Riwayat transaksi outlet (HP & Tablet)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { createApiRequestWrapper } from "../../src/api/api";
import { createOrdersApi } from "../../src/api/orders";
import AppShell from "../../src/components/AppShell";
import Badge from "../../src/components/Badge";
import BaseButton from "../../src/components/BaseButton";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";
import Modal from "../../src/components/Modal";
import Notice from "../../src/components/Notice";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const PAGE_SIZE = 100;

const PERIOD_OPTIONS = [
  { value: "SEMUA", label: "Semua" },
  { value: "HARI_INI", label: "Hari ini" },
];
const STATUS_OPTIONS = [
  { value: "SEMUA", label: "Semua" },
  { value: "Selesai", label: "Selesai" },
  { value: "Perlu ditinjau", label: "Perlu ditinjau" },
  { value: "Dibatalkan", label: "Dibatalkan" },
];
const SOURCE_OPTIONS = [
  { value: "SEMUA", label: "Semua" },
  { value: "POS", label: "POS" },
  { value: "ShopeeFood", label: "ShopeeFood" },
];
const STATE_VARIANT = {
  Selesai: "success",
  "Perlu ditinjau": "warning",
  Dibatalkan: "danger",
};

const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function jakartaDateKey(value) {
  return DATE_KEY_FORMAT.format(new Date(value));
}

function formatTime(value) {
  if (!value) return "-";
  return TIME_FORMAT.format(new Date(value));
}

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  return Number(value).toLocaleString("id-ID");
}

function orderSource(order) {
  return order.paymentMethod?.startsWith("SHOPEEFOOD") ? "ShopeeFood" : "POS";
}

function orderState(order) {
  if (order.status === "CANCELLED") return "Dibatalkan";
  if (order.paymentStatus === "PENDING_RECONCILIATION") return "Perlu ditinjau";
  return "Selesai";
}

function FilterChips({ label, options, value, onChange }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipRow}>
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
function TransactionRow({ order, isWide, selected, onPress, onOpenDetail }) {
  const crewName = order.crew?.name || "-";
  const label = `${order.orderNumber || order.id} · ${formatTime(order.createdAt)}`;

  if (!isWide) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowPhone,
          selected && styles.rowSelected,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.rowMeta}>
            {crewName} · {orderSource(order)} · Rp {formatRupiah(order.total)}
          </Text>
        </View>
        <Badge label={orderState(order)} variant={STATE_VARIANT[orderState(order)]} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tr,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.td, styles.colId]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.td, styles.colCrew]} numberOfLines={1}>
        {crewName}
      </Text>
      <Text style={[styles.td, styles.colSource]}>{orderSource(order)}</Text>
      <View style={styles.colStatus}>
        <Badge label={orderState(order)} variant={STATE_VARIANT[orderState(order)]} />
      </View>
      <View style={styles.colDetail}>
        <Pressable accessibilityRole="button" onPress={onOpenDetail} hitSlop={8}>
          <Text style={styles.detailLink}>Lihat detail</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function DetailItem({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailItemLabel}>{label}</Text>
      <Text style={styles.detailItemText} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ManagerTransactionsScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;
  const memberships = user?.memberships ?? [];
  const selectedOutlet = memberships.find(
    (membership) => membership.outletId === outletId,
  );
  const outletLabel = selectedOutlet?.outletName ?? "Outlet";
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [orders, setOrders] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [period, setPeriod] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");
  const [source, setSource] = useState("SEMUA");

  const loadOrders = useCallback(async () => {
    if (!outletId) return;
    setError(null);
    try {
      const api = createOrdersApi({
        request: createApiRequestWrapper(apiRequest),
      });
      const res = await api.listOrders(outletId, {
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setOrders(res?.data?.orders ?? []);
      setHasNextPage(Boolean(res?.data?.pagination?.hasNextPage));
    } catch (err) {
      setError(err?.message || "Riwayat transaksi gagal dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest, outletId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const today = jakartaDateKey(new Date());
  const summary = useMemo(() => {
    let todayCount = 0;
    let pending = 0;
    let cancelled = 0;
    for (const order of orders) {
      if (
        order.status === "COMPLETED" &&
        jakartaDateKey(order.createdAt) === today
      ) {
        todayCount += 1;
      }
      if (orderState(order) === "Perlu ditinjau") pending += 1;
      if (order.status === "CANCELLED") cancelled += 1;
    }
    return { todayCount, pending, cancelled };
  }, [orders, today]);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (period === "HARI_INI" && jakartaDateKey(order.createdAt) !== today) {
        return false;
      }
      if (status !== "SEMUA" && orderState(order) !== status) return false;
      if (source !== "SEMUA" && orderSource(order) !== source) return false;
      return true;
    });
  }, [orders, period, status, source, today]);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const summaryCards = [
    { label: "Transaksi hari ini", value: String(summary.todayCount) },
    { label: "Perlu ditinjau", value: String(summary.pending) },
    { label: "Dibatalkan", value: String(summary.cancelled) },
    {
      label: "Sumber pesanan",
      value:
        SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? "Semua",
    },
  ];

  const renderItem = (order) => (
    <TransactionRow
      key={order.id}
      order={order}
      isWide={isWide}
      selected={order.id === selectedId}
      onPress={() =>
        setSelectedId((current) => (current === order.id ? null : order.id))
      }
      onOpenDetail={() => setDetailOrder(order)}
    />
  );
  return (
    <AppShell
      navRole="manager"
      active="transaksi"
      roleLabel="Manager"
      title="Riwayat transaksi outlet"
      subtitle="Semua transaksi pada outlet yang ditugaskan."
      outletLabel={outletLabel}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadOrders();
          }}
        />
      }
    >
      <View style={styles.summaryGrid}>
        {summaryCards.map((card) => (
          <View key={card.label} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {card.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.filterRow}>
        <FilterChips
          label="Periode"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
        />
        <FilterChips
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <FilterChips
          label="Sumber"
          options={SOURCE_OPTIONS}
          value={source}
          onChange={setSource}
        />
      </View>

      {error ? <Notice message={error} type="error" /> : null}

      <Card style={styles.listCard}>
        <Text style={styles.listTitle}>Daftar transaksi</Text>
        <Text style={styles.listSubtitle}>
          Pilih transaksi untuk melihat detail item dan pembayaran.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.loadingText}>Memuat transaksi…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi"
            subtitle="Transaksi POS dan ShopeeFood pada outlet ini akan muncul di sini."
          />
        ) : (
          <>
            {isWide ? (
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  <Text style={[styles.th, styles.colId]}>ID / Waktu</Text>
                  <Text style={[styles.th, styles.colCrew]}>Crew</Text>
                  <Text style={[styles.th, styles.colSource]}>Sumber</Text>
                  <Text style={[styles.th, styles.colStatus]}>Status</Text>
                  <Text style={[styles.th, styles.colDetail]}>Detail</Text>
                </View>
                {filtered.map(renderItem)}
              </View>
            ) : (
              <View style={styles.phoneList}>{filtered.map(renderItem)}</View>
            )}
            {hasNextPage ? (
              <Text style={styles.limitNote}>
                Menampilkan {PAGE_SIZE} transaksi terbaru. Filter berlaku pada
                transaksi yang termuat.
              </Text>
            ) : null}
          </>
        )}
      </Card>

      <View style={[styles.actionWrap, isWide && styles.actionWrapWide]}>
        <BaseButton
          label="Lihat detail transaksi"
          disabled={!selectedOrder}
          onPress={() => setDetailOrder(selectedOrder)}
          fullWidth={!isWide}
          size="lg"
        />
      </View>
      <Modal
        visible={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        title={
          detailOrder
            ? `Transaksi ${detailOrder.orderNumber || detailOrder.id}`
            : ""
        }
        subtitle={
          detailOrder
            ? `${jakartaDateKey(detailOrder.createdAt)} ${formatTime(detailOrder.createdAt)} WIB`
            : null
        }
      >
        {detailOrder ? (
          <>
            <View style={styles.detailGrid}>
              <DetailItem label="Crew" value={detailOrder.crew?.name || "-"} />
              <DetailItem label="Sumber" value={orderSource(detailOrder)} />
              <DetailItem label="Status" value={orderState(detailOrder)} />
              <DetailItem
                label="Metode"
                value={detailOrder.paymentMethod || "-"}
              />
            </View>

            <Text style={styles.detailSection}>Item</Text>
            {(detailOrder.items ?? []).length === 0 ? (
              <Text style={styles.detailEmpty}>Tidak ada item.</Text>
            ) : (
              detailOrder.items.map((item) => (
                <View key={item.id} style={styles.detailRow}>
                  <Text style={styles.detailItemName} numberOfLines={1}>
                    {item.quantity}x {item.productName}
                    {item.variantName ? ` (${item.variantName})` : ""}
                  </Text>
                  <Text style={styles.detailItemValue}>
                    Rp {formatRupiah(item.subtotal)}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.detailSection}>Pembayaran</Text>
            {(detailOrder.payments ?? []).length === 0 ? (
              <Text style={styles.detailEmpty}>Tidak ada data pembayaran.</Text>
            ) : (
              detailOrder.payments.map((payment) => (
                <View key={payment.id} style={styles.detailRow}>
                  <Text style={styles.detailItemName}>
                    {payment.paymentMethod}
                    {payment.paymentStatus ? ` · ${payment.paymentStatus}` : ""}
                  </Text>
                  <Text style={styles.detailItemValue}>
                    Rp {formatRupiah(payment.amount)}
                  </Text>
                </View>
              ))
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                Rp {formatRupiah(detailOrder.total)}
              </Text>
            </View>
          </>
        ) : null}
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
    backgroundColor: colors.light.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 2,
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
  chipRow: {
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
  table: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  thead: {
    backgroundColor: colors.light.surfaceSecondary,
  },
  th: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  td: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  colId: { flex: 1.6 },
  colCrew: { flex: 1 },
  colSource: { flex: 0.9 },
  colStatus: { flex: 1, paddingRight: spacing.sm },
  colDetail: { width: 84, alignItems: "flex-end" },
  detailLink: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.primary,
  },
  rowSelected: {
    backgroundColor: colors.light.surfaceSecondary,
    borderColor: colors.light.primary,
    borderWidth: 1,
  },
  rowPressed: { opacity: 0.75 },
  rowPhone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surface,
  },
  phoneList: {
    gap: spacing.xs,
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
  limitNote: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
  },
  actionWrap: {
    marginTop: spacing.xs,
  },
  actionWrapWide: {
    alignItems: "flex-end",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  detailItem: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 2,
  },
  detailItemLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: "uppercase",
  },
  detailItemText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  detailSection: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailItemName: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    flex: 1,
  },
  detailItemValue: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  detailEmpty: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  totalValue: {
    ...typography.fontFamily.bold,
    ...typography.weights.bold,
    fontSize: typography.sizes.base,
    color: colors.light.primary,
  },
});






