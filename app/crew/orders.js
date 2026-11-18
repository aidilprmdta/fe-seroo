// CrewOrdersScreen — riwayat order + verifikasi QRIS + pembatalan
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createOrdersApi } from '../../src/api/orders';
import { createApiClient } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
import Notice from '../../src/components/Notice';
import Modal from '../../src/components/Modal';
import ConfirmDialog from '../../src/components/ConfirmDialog';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

function statusLabel(order) {
  if (order.status === 'CANCELLED') return '↩ Dibatalkan';
  if (order.paymentStatus === 'LUNAS') return '✓ Lunas';
  if (order.paymentStatus === 'PENDING_RECONCILIATION') return '⏳ Perlu verifikasi';
  if (order.paymentStatus === 'REFUNDED') return '↩ Refund';
  return order.paymentStatus || '-';
}

function statusVariant(order) {
  if (order.status === 'CANCELLED' || order.paymentStatus === 'REFUNDED') return 'danger';
  if (order.paymentStatus === 'LUNAS') return 'success';
  return 'warning';
}

export default function CrewOrdersScreen() {
  const { selection } = useAuth();
  const outletId = selection.activeOutletId;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [recordWaste, setRecordWaste] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getApi = useCallback(() => {
    const client = createApiClient();
    return createOrdersApi({ request: client });
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await getApi().listOrders(outletId, { page: 1, pageSize: 20 });
      setOrders(data?.data?.orders || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Riwayat pesanan gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, getApi]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleVerify = useCallback((order) => {
    setVerifyTarget(order);
    setError(null);
  }, []);

  const confirmVerify = useCallback(async () => {
    if (!verifyTarget) return;
    setSubmitting(true);
    try {
      await getApi().verifyQris(outletId, verifyTarget.id);
      setVerifyTarget(null);
      loadOrders();
    } catch (err) {
      setError(err?.message || 'Verifikasi QRIS gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [verifyTarget, getApi, outletId, loadOrders]);

  const openCancel = useCallback((order) => {
    setCancelTarget(order);
    setCancelReason('');
    setRecordWaste(true);
    setError(null);
  }, []);

  const handleCancel = useCallback(async () => {
    setError(null);
    if (cancelReason.trim().length < 5) {
      setError('Alasan pembatalan minimal 5 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().cancelOrder(outletId, cancelTarget.id, {
        reason: cancelReason.trim(),
        recordWaste,
      });
      Alert.alert('Berhasil', 'Pesanan dibatalkan.');
      setCancelTarget(null);
      loadOrders();
    } catch (err) {
      setError(err?.message || 'Pembatalan gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [cancelReason, recordWaste, cancelTarget, getApi, outletId, loadOrders]);

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrders} />}
      >
        {error && !cancelTarget && <Notice message={error} type="error" />}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.text}>Memuat pesanan…</Text>
          </View>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📋</Text>}
            title="Belum ada pesanan"
            subtitle="Pesanan kamu akan muncul di sini."
          />
        ) : (
          orders.map((order) => (
            <Card key={order.id} style={styles.orderCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.orderTitle}>Order #{order.orderNumber || order.id}</Text>
                <Badge label={statusLabel(order)} variant={statusVariant(order)} />
              </View>
              <Text style={styles.orderMeta}>
                {order.items?.length || 0} item · Rp {formatRupiah(order.total || 0)} · {order.paymentMethod}
              </Text>

              {order.status !== 'CANCELLED' && (
                <View style={styles.rowActions}>
                  {order.paymentStatus === 'PENDING_RECONCILIATION' && (
                    <TouchableOpacity style={styles.action} onPress={() => handleVerify(order)}>
                      <Text style={styles.actionText}>Verifikasi QRIS</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.action, styles.actionDanger]} onPress={() => openCancel(order)}>
                    <Text style={[styles.actionText, styles.actionDangerText]}>Batalkan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Batalkan Pesanan"
        subtitle={`Order #${cancelTarget?.orderNumber || cancelTarget?.id || ''}`}
        footer={
          <BaseButton
            label="Batalkan Pesanan"
            onPress={handleCancel}
            loading={submitting}
            fullWidth
            size="lg"
            variant="danger"
          />
        }
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Input
            label="Alasan pembatalan"
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Minimal 5 karakter"
          />
          <TouchableOpacity
            style={[styles.checkRow, recordWaste && styles.checkRowActive]}
            onPress={() => setRecordWaste(!recordWaste)}
          >
            <Text style={[styles.checkText, recordWaste && styles.checkTextActive]}>
              {recordWaste ? '✓' : '○'} Catat sebagai waste
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ConfirmDialog
        visible={Boolean(verifyTarget)}
        onClose={() => setVerifyTarget(null)}
        onConfirm={confirmVerify}
        badge="VERIFIKASI QRIS"
        title="Verifikasi QRIS"
        body={`Tandakan pembayaran order #${verifyTarget?.orderNumber || verifyTarget?.id || ''} sebagai lunas? Pembayaran akan masuk ke rekap outlet.`}
        cancelLabel="Batal"
        confirmLabel="Verifikasi"
        confirmVariant="primary"
        loading={submitting}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  icon: { fontSize: 40 },
  orderCard: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  orderMeta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    alignItems: 'center',
  },
  actionDanger: { backgroundColor: colors.light.dangerSurface },
  actionText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
  actionDangerText: { color: colors.light.danger },
  modalContent: { padding: spacing.md, gap: spacing.md },
  checkRow: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  checkRowActive: { borderColor: colors.light.primary, backgroundColor: colors.light.surfaceSecondary },
  checkText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  checkTextActive: { color: colors.light.primary },
});
