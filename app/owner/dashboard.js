// OwnerDashboardScreen — owner mitra dashboard (read-only)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ROUTES } from '../../src/auth/routePolicy';
import { createDashboardApi } from '../../src/api/dashboard';
import { createOutletAccessApi } from '../../src/api/outlets';
import { createApiClient } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useResponsive } from '../../src/theme/responsive';
import Card from '../../src/components/Card';
import ListItem from '../../src/components/ListItem';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
import AccountActions from '../../src/components/AccountActions';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function OwnerDashboardScreen() {
  const r = useResponsive();
  const { user, selection } = useAuth();
  const router = useRouter();
  const outletId = selection.activeOutletId;
  const [data, setData] = useState({
    summary: null,
    sales: null,
    expenses: null,
    stock: null,
    waste: null,
    closingStatus: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const client = createApiClient();
      const dashboardApi = createDashboardApi({ request: client });
      const response = await dashboardApi.getDashboard(outletId);
      setData(response.data || {});
    } catch (err) {
      setError(err?.message || 'Dashboard gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const metricCardStyle = [
    styles.metricCard,
    { flex: 1, minWidth: r.isSmallPhone ? '100%' : r.isPhone ? 140 : 200 },
  ];

  return (
    <AppShell
      navRole="ownerMitra"
      active="ringkasan"
      title="Dashboard Owner Mitra"
      subtitle={`Outlet: ${selection.activeOutletId || ''}`}
      roleLabel="OWNER MITRA"
      outletLabel={selection.activeOutletId || 'Outlet'}
      scopeLabel={selection.activeOutletId || 'Outlet'}
    >
      <View style={styles.container}>
        {error && <Notice message={error} type="error" />}

        {/* Key metrics */}
        <View style={styles.metrics}>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>💵</Text>
              <Text style={styles.metricLabel}>Omzet Kas</Text>
            </View>
            <Text style={styles.metricValue}>
              Rp {formatRupiah(data.summary?.cashSales || 0)}
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📱</Text>
              <Text style={styles.metricLabel}>Omzet QRIS</Text>
            </View>
            <Text style={styles.metricValue}>
              Rp {formatRupiah(data.summary?.qrisSales || 0)}
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📦</Text>
              <Text style={styles.metricLabel}>Stok</Text>
            </View>
            <Text style={styles.metricValue}>
              {data.summary?.stock || 0} item
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📊</Text>
              <Text style={styles.metricLabel}>Pengeluaran</Text>
            </View>
            <Text style={styles.metricValue}>
              Rp {formatRupiah(data.summary?.expenses || 0)}
            </Text>
          </Card>
        </View>

        {/* Outlet summary */}
        <Text style={styles.sectionTitle}>Ringkasan Outlet</Text>
        <Card style={styles.listCard}>
          <ListItem
            title="Omzet Harian"
            subtitle={`Rp ${formatRupiah(data.sales?.daily || 0)}`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.primary }]} />}
          />
          <ListItem
            title="Omzet Bulanan"
            subtitle={`Rp ${formatRupiah(data.sales?.monthly || 0)}`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.info }]} />}
          />
          <ListItem
            title="Pengeluaran"
            subtitle={`Rp ${formatRupiah(data.expenses || 0)}`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.danger }]} />}
          />
          <ListItem
            title="Stok Sisa"
            subtitle={`${data.stock || 0} item aktif`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.success }]} />}
          />
          <ListItem
            title="Status Closing"
            subtitle={data.closingStatus ? 'Selesai' : 'Belum dimulai'}
            leading={<View style={[styles.dot, { backgroundColor: data.closingStatus ? colors.light.success : colors.light.warning }]} />}
          />
        </Card>

        {/* Outlet access */}
        <Text style={styles.sectionTitle}>Kelola Outlet</Text>
        <Card style={styles.listCard}>
          <ListItem
            title="Kelola Anggota Outlet"
            subtitle="Tambah/edit/nonaktifkan staf"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.primary }]} />}
            onPress={() => router.push(ROUTES.outletMembers)}
          />
          <ListItem
            title="Laporan Keuangan"
            subtitle="Ekspor CSV / cetak PDF"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.info }]} />}
            onPress={() => router.push(ROUTES.reports)}
          />
        </Card>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    minWidth: 0,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricIcon: {
    fontSize: 20,
  },
  metricLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  metricValue: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.lg,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  listCard: {
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
});
