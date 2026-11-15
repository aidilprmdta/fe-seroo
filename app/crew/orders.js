import { router } from "expo-router";
import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { createPosApi } from "../../src/pos/api";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import { colors, spacing } from "../../src/theme/tokens";

const FILTERS = [
  { label: "Semua", value: null },
  { label: "QRIS Belum Verif.", value: { paymentStatus: "PENDING_RECONCILIATION" } },
  { label: "Lunas", value: { paymentStatus: "LUNAS" } },
  { label: "Dibatalkan", value: { status: "CANCELLED" } },
];

function formatRupiah(value) {
  const num = parseFloat(value ?? "0");
  return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0 });
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(method) {
  if (method === "CASH") return "Tunai";
  if (method === "QRIS") return "QRIS";
  if (method === "SPLIT") return "Campuran";
  return method ?? "-";
}

function statusLabel(status) {
  if (status === "COMPLETED") return "Selesai";
  if (status === "CANCELLED") return "Dibatalkan";
  if (status === "PENDING") return "Menunggu";
  return status ?? "-";
}

function paymentStatusLabel(ps) {
  if (ps === "LUNAS") return "Lunas";
  if (ps === "PENDING_RECONCILIATION") return "QRIS Belum Terverifikasi";
  if (ps === "REFUNDED") return "Dikembalikan";
  if (ps === "UNPAID") return "Belum Bayar";
  return ps ?? "-";
}

function statusColor(status, paymentStatus) {
  if (status === "CANCELLED") return colors.error ?? "#DC2626";
  if (paymentStatus === "PENDING_RECONCILIATION") return "#D97706";
  if (paymentStatus === "LUNAS") return colors.success ?? "#16A34A";
  return colors.textSecondary;
}

export default function CrewOrdersScreen() {
  const { request, selection } = useAuth();
  const outletId = selection?.activeOutletId;

  const api = useMemo(() => createPosApi({ request }), [request]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    hasNextPage: false,
  });

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRecordWaste, setCancelRecordWaste] = useState(true);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Verify QRIS state
  const [verifyingId, setVerifyingId] = useState(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadOrders = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listOrders(outletId, {
        paymentStatus: activeFilter?.paymentStatus,
        status: activeFilter?.status,
        page,
        pageSize: 20,
      });
      if (mounted.current) {
        setOrders(result.orders ?? []);
        setPagination(result.pagination);
      }
    } catch (err) {
      if (mounted.current)
        setError(err?.message ?? "Gagal memuat riwayat transaksi.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [api, outletId, activeFilter, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleVerifyQris = useCallback(
    async (order) => {
      setVerifyingId(order.id);
      setNotice(null);
      try {
        await api.verifyQris(outletId, order.id);
        setNotice("Pembayaran QRIS berhasil diverifikasi.");
        await loadOrders();
      } catch (err) {
        setNotice(err?.message ?? "Gagal memverifikasi QRIS.");
      } finally {
        if (mounted.current) setVerifyingId(null);
      }
    },
    [api, outletId, loadOrders],
  );

  const openCancelModal = useCallback((order) => {
    setCancelTarget(order);
    setCancelReason("");
    setCancelRecordWaste(true);
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelTarget(null);
    setCancelReason("");
  }, []);

  const handleCancelOrder = useCallback(async () => {
    if (!cancelTarget) return;
    if (!cancelReason || cancelReason.trim().length < 5) {
      setNotice("Alasan pembatalan minimal 5 karakter.");
      return;
    }
    setCancelSubmitting(true);
    setNotice(null);
    try {
      await api.cancelOrder(outletId, cancelTarget.id, {
        reason: cancelReason.trim(),
        recordWaste: cancelRecordWaste,
      });
      closeCancelModal();
      setNotice("Pesanan berhasil dibatalkan.");
      await loadOrders();
    } catch (err) {
      setNotice(err?.message ?? "Gagal membatalkan pesanan.");
    } finally {
      if (mounted.current) setCancelSubmitting(false);
    }
  }, [
    api,
    outletId,
    cancelTarget,
    cancelReason,
    cancelRecordWaste,
    closeCancelModal,
    loadOrders,
  ]);

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Kembali</Text>
          </Pressable>
          <Text style={styles.title}>Riwayat Transaksi</Text>
          <PrimaryButton
            label={loading ? "Memuat..." : "Muat Ulang"}
            secondary
            onPress={loadOrders}
          />
        </View>

        <Notice message={notice} type="info" onDismiss={() => setNotice(null)} />
        <Notice message={error} type="error" onDismiss={() => setError(null)} />

        {/* Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.label}
              onPress={() => {
                setActiveFilter(f.value ?? null);
                setPage(1);
              }}
              style={[
                styles.filterChip,
                activeFilter === f.value && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === f.value && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Order List */}
        {loading && orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Memuat transaksi...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada transaksi.</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                verifyingId={verifyingId}
                onVerify={handleVerifyQris}
                onCancel={openCancelModal}
              />
            ))}
          </View>
        )}

        <View style={styles.paginationRow}>
          <Pressable
            style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
            disabled={page <= 1 || loading}
            onPress={() => setPage((current) => Math.max(1, current - 1))}
          >
            <Text style={styles.pageButtonText}>Sebelumnya</Text>
          </Pressable>
          <Text style={styles.pageText}>Halaman {pagination.page}</Text>
          <Pressable
            style={[
              styles.pageButton,
              !pagination.hasNextPage && styles.pageButtonDisabled,
            ]}
            disabled={!pagination.hasNextPage || loading}
            onPress={() => setPage((current) => current + 1)}
          >
            <Text style={styles.pageButtonText}>Berikutnya</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Cancel Modal */}
      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Batalkan Pesanan</Text>
            <Text style={styles.modalOrderNum}>
              {cancelTarget?.orderNumber}
            </Text>
            <Text style={styles.inputLabel}>Alasan pembatalan *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Minimal 5 karakter..."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.wasteToggleRow}>
              <Text style={styles.inputLabel}>Catat sebagai waste?</Text>
              <Switch
                value={cancelRecordWaste}
                onValueChange={setCancelRecordWaste}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={closeCancelModal}
                disabled={cancelSubmitting}
              >
                <Text style={styles.modalBtnSecondaryText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  cancelSubmitting && styles.modalBtnDisabled,
                ]}
                onPress={handleCancelOrder}
                disabled={cancelSubmitting}
              >
                <Text style={styles.modalBtnDangerText}>
                  {cancelSubmitting ? "Memproses..." : "Konfirmasi Batal"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenFrame>
  );
}

function OrderCard({ order, verifyingId, onVerify, onCancel }) {
  const isCancelled = order.status === "CANCELLED";
  const isPendingQris = order.paymentStatus === "PENDING_RECONCILIATION";
  const isVerifying = verifyingId === order.id;

  const itemsSummary =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
          .map((it) => `${it.productName ?? it.variantName ?? "Item"} x${it.quantity}`)
          .join(", ")
      : "—";

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColor(order.status, order.paymentStatus) + "22" },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              { color: statusColor(order.status, order.paymentStatus) },
            ]}
          >
            {isCancelled
              ? "Dibatalkan"
              : paymentStatusLabel(order.paymentStatus)}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          💳 {paymentLabel(order.paymentMethod)}{"  "}·{"  "}
          <Text style={styles.totalText}>{formatRupiah(order.total)}</Text>
        </Text>
        <Text style={styles.metaText}>🕐 {formatDate(order.createdAt)}</Text>
      </View>

      {itemsSummary !== "—" && (
        <Text style={styles.itemsSummary} numberOfLines={2}>
          {itemsSummary}
        </Text>
      )}

      {isCancelled && order.cancellationReason ? (
        <Text style={styles.cancelledNote}>
          Alasan: {order.cancellationReason}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        {isPendingQris && !isCancelled ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnVerify, isVerifying && styles.actionBtnDisabled]}
            onPress={() => onVerify(order)}
            disabled={isVerifying}
          >
            <Text style={styles.actionBtnText}>
              {isVerifying ? "Memverifikasi..." : "✓ Tandai Terverifikasi"}
            </Text>
          </Pressable>
        ) : null}

        {!isCancelled ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnCancel]}
            onPress={() => onCancel(order)}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnCancelText]}>
              Batalkan
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  backBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  filterBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "22",
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pageButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  pageButtonDisabled: {
    opacity: 0.45,
  },
  pageButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  pageText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  orderList: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardCancelled: {
    opacity: 0.75,
    borderStyle: "dashed",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  orderNumber: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardMeta: {
    gap: 2,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  totalText: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  itemsSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: "italic",
  },
  cancelledNote: {
    color: colors.error ?? "#DC2626",
    fontSize: 13,
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnVerify: {
    borderColor: colors.success ?? "#16A34A",
    backgroundColor: (colors.success ?? "#16A34A") + "11",
  },
  actionBtnCancel: {
    borderColor: colors.error ?? "#DC2626",
    backgroundColor: (colors.error ?? "#DC2626") + "11",
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success ?? "#16A34A",
  },
  actionBtnCancelText: {
    color: colors.error ?? "#DC2626",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 480,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  modalOrderNum: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
  },
  wasteToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modalBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtnSecondary: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modalBtnSecondaryText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
  },
  modalBtnDanger: {
    borderColor: colors.error ?? "#DC2626",
    backgroundColor: colors.error ?? "#DC2626",
  },
  modalBtnDangerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
});

