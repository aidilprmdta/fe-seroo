// CrewTransactionDetailScreen — Detail transaksi & pembayaran (terpisah)
// Figma: 12 · Detail transaksi & pembayaran · Tablet · Prototype
import React, { useState, useCallback, useEffect } from 'react';
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

export default function CrewTransactionDetailScreen({ route }) {
  const { id: orderId } = route.params || {};
  const { selection } = useAuth();
  const outletId = selection?.activeOutletId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(() => {
    const client = createApiClient();
    return createOrdersApi({ request: client });
  }, []);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getApi().getOrder(outletId, orderId);
      setOrder(data?.data?.order || data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Detail pesanan gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, outletId, getApi]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (!orderId) {
    return (
      <AppShell
        navRole="crew"
        active="transaction-detail"
        title="Detail Transaksi"
        subtitle="Pilih pesanan dulu."
        roleLabel="CREW · OUTLET"
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
        contentStyle={styles.container}
      >
        <Notice message="Pilih pesanan dari daftar untuk lihat detail." type="info" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell
        navRole="crew"
        active="transaction-detail"
        title="Detail Transaksi"
        subtitle="Memuat detail…"
        roleLabel="CREW · OUTLET"
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
        contentStyle={styles.container}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.text}>Memuat…</Text>
        </View>
      </AppShell>
    );
  }

  if (error && !order) {
    return (
      <AppShell
        navRole="crew"
        active="transaction-detail"
        title="Detail Transaksi"
        subtitle="Gagal memuat detail."
        roleLabel="CREW · OUTLET"
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
        contentStyle={styles.container}
      >
        <Notice message={error} type="error" />
      </AppShell>
    );
  }

  return (
    <AppShell
      navRole="crew"
      active="transaction-detail"
      title="Detail Transaksi"
      subtitle={order?.orderNumber || 'Order #'}
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      {error && <Notice message={error} type="error" />}

      <Card style={styles.summaryCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Order #</Text>
          <Text style={styles.value}>{order?.orderNumber || '—'}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Tanggal</Text>
          <Text style={styles.value}>
            {order?.createdAt
              ? new Date(order.createdAt).toLocaleString('id-ID')
              : '—'}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Status</Text>
          <Badge label={order?.status || '—'} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Metode Bayar</Text>
          <Text style={styles.value}>{order?.paymentMethod || '—'}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>Rp {formatRupiah(order?.total || 0)}</Text>
        </View>
      </Card>

      {order?.items?.length > 0 && (
        <Card style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Item pesanan</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemMeta}>
                x {item.quantity} · {item.variantName || '—'}
              </Text>
              <Text style={styles.itemPrice}>Rp {formatRupiah(item.unitPrice || 0)}</Text>
            </View>
          ))}
        </Card>
      )}

      {order?.payments?.length > 0 && (
        <Card style={styles.paymentsCard}>
          <Text style={styles.sectionTitle}>Pembayaran</Text>
          {order.payments.map((p, idx) => (
            <View key={idx} style={styles.paymentRow}>
              <Text style={styles.paymentMethod}>{p.paymentMethod}</Text>
              <Text style={styles.paymentAmount}>Rp {formatRupiah(p.amount || 0)}</Text>
              <Badge label={p.paymentStatus || '—'} />
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.actionsCard}>
        <View style={styles.row}>
          <BaseButton
            label="Kembali ke riwayat"
            onPress={() => {}}
            fullWidth
            size="lg"
          />
        </View>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.light.textSecondary },
  summaryCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  value: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  itemsCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  itemMeta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  itemPrice: {
    ...typography.fontFamily.bold,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
  paymentsCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.surface,
  },
  paymentMethod: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
  paymentAmount: {
    ...typography.fontFamily.bold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  actionsCard: {
    gap: spacing.sm,
  },
});
