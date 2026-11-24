// CrewQrisVerifyScreen — Verifikasi pembayaran QRIS (terpisah dari riwayat)
// Figma: 11 · Status verifikasi QRIS · Tablet · Prototype
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function CrewQrisVerifyScreen() {
  const { selection } = useAuth();
  const outletId = selection?.activeOutletId;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
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
      setError(err?.message || 'Daftar pesanan gagal dimuat.');
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
      Alert.alert('Berhasil', 'Pembayaran QRIS telah diverifikasi.');
    } catch (err) {
      setError(err?.message || 'Verifikasi QRIS gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [verifyTarget, outletId, getApi, loadOrders]);

  return (
    <AppShell
      navRole="crew"
      active="qris-verify"
      title="Verifikasi QRIS"
      subtitle="Tandai pembayaran QRIS yang masih menunggu konfirmasi."
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadOrders}
          />
        }
      >
        {error && <Notice message={error} type="error" />}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.text}>Memuat pesanan…</Text>
          </View>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📋</Text>}
            title="Belum ada pesanan"
            subtitle="Pesanan yang menunggu verifikasi akan muncul di sini."
          />
        ) : (
          orders
            .filter((o) => o.paymentStatus === 'PENDING_RECONCILIATION')
            .map((order) => (
              <Card key={order.id} style={styles.orderCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.orderTitle}>Order #{order.orderNumber}</Text>
                    <Text style={styles.orderMeta}>
                      {order.items?.length} item · {order.paymentMethod} · {order.createdAt
                        ? new Date(order.createdAt).toLocaleString('id-ID')
                        : ''}
                    </Text>
                  </View>
                  <Badge label="PENDING" variant="warning" />
                </View>
                <View style={styles.itemList}>
                  {order.items?.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemQty}>x {item.quantity}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={[styles.action, styles.actionPrimary]}
                    onPress={() => handleVerify(order)}
                  >
                    <Text style={styles.actionText}>Verifikasi QRIS</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
        )}

        <ConfirmVerifyDialog
          visible={!!verifyTarget}
          onClose={() => setVerifyTarget(null)}
          order={verifyTarget}
          onConfirm={confirmVerify}
          loading={submitting}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  scrollContent: { paddingBottom: spacing.lg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.light.textSecondary },
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
  itemList: { gap: spacing.xs },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.surface,
  },
  itemName: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    flex: 1,
  },
  itemQty: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    alignItems: 'center',
  },
  actionPrimary: {
    backgroundColor: colors.light.primary,
  },
  actionText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
});

// Dialog verifikasi QRIS (terpisah dari list)
function ConfirmVerifyDialog({ visible, onClose, order, onConfirm, loading }) {
  if (!visible || !order) return null;
  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, styles.modalCardSm]}>
        <Text style={styles.modalTitle}>Verifikasi QRIS</Text>
        <Text style={styles.modalBody}>
          Order #{order.orderNumber}
        </Text>
        <Text style={styles.modalSub}>
          Tandakan pembayaran order ini sebagai lunas? Pembayaran akan masuk ke rekap outlet.
        </Text>
        <View style={styles.modalActions}>
          <BaseButton
            label="Batal"
            onPress={onClose}
            variant="secondary"
            fullWidth
          />
          <BaseButton
            label="Verifikasi"
            onPress={onConfirm}
            loading={loading}
            fullWidth
            variant="primary"
          />
        </View>
      </View>
    </View>
  );
}
