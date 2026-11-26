// OwnerDashboardScreen — owner mitra dashboard (read-only)
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ROUTES } from '../../src/auth/routePolicy';
import { createDashboardApi } from '../../src/dashboard/api';
import { createReportApi } from '../../src/reports/api';
import { buildMonthlyComparison, jakartaMonthKey, monthLabel, shiftMonth } from '../../src/dashboard/chartData';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useResponsive } from '../../src/theme/responsive';
import Card from '../../src/components/Card';
import ListItem from '../../src/components/ListItem';
import AppShell from '../../src/components/AppShell';
import BarChart from '../../src/components/BarChart';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function OwnerDashboardScreen() {
  const r = useResponsive();
  const { user, selection, apiRequest } = useAuth();
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
  const [monthKey, setMonthKey] = useState(jakartaMonthKey());
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    try {
      const dashboardApi = createDashboardApi({ request: apiRequest });
      const response = await dashboardApi.getDashboard(outletId);
      setData(response || {});
    } catch (err) {
      setError(err?.message || 'Dashboard gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest, outletId]);

  const loadMonthlyReport = useCallback(async () => {
    if (!outletId) {
      setChartLoading(false);
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setChartLoading(true);
    setChartError(null);
    try {
      const reportsApi = createReportApi({ request: apiRequest });
      const report = await reportsApi.getMonthlyReport(outletId, monthKey);
      if (requestId !== requestIdRef.current) return;
      setMonthlyReport(report);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setChartError(err?.message || 'Grafik bulanan gagal dimuat.');
    } finally {
      if (requestId === requestIdRef.current) setChartLoading(false);
    }
  }, [apiRequest, outletId, monthKey]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadMonthlyReport();
  }, [loadMonthlyReport]);

  const comparison = buildMonthlyComparison(monthlyReport).map((item, index) => ({
    ...item,
    color: index === 0 ? colors.light.primary : colors.light.primaryLight,
  }));

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
              Rp {formatRupiah(data.sales?.cash?.total ?? data.summary?.cashSales ?? 0)}
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📱</Text>
              <Text style={styles.metricLabel}>Omzet QRIS</Text>
            </View>
            <Text style={styles.metricValue}>
              Rp {formatRupiah(data.sales?.qris?.total ?? data.summary?.qrisSales ?? 0)}
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📦</Text>
              <Text style={styles.metricLabel}>Stok</Text>
            </View>
            <Text style={styles.metricValue}>
              {data.stock?.totalItems ?? data.summary?.stock ?? 0} item
            </Text>
          </Card>
          <Card style={metricCardStyle}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>📊</Text>
              <Text style={styles.metricLabel}>Pengeluaran</Text>
            </View>
            <Text style={styles.metricValue}>
              Rp {formatRupiah(data.expenses?.totalExpense ?? data.summary?.expenses ?? 0)}
            </Text>
          </Card>
        </View>

        {/* Monthly revenue vs expenses */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Pendapatan vs Pengeluaran</Text>
            <View style={styles.monthStepper}>
              <TouchableOpacity
                accessibilityLabel="Bulan sebelumnya"
                onPress={() => setMonthKey(shiftMonth(monthKey, -1))}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthText}>{monthLabel(monthKey)}</Text>
              <TouchableOpacity
                accessibilityLabel="Bulan berikutnya"
                onPress={() => setMonthKey(shiftMonth(monthKey, 1))}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.chartSubtitle}>Ringkasan bulanan outlet ini</Text>
          {chartLoading ? (
            <View style={styles.chartState}>
              <ActivityIndicator size="small" color={colors.light.primary} />
              <Text style={styles.chartStateText}>Memuat grafik bulanan...</Text>
            </View>
          ) : chartError ? (
            <Notice message={chartError} type="error" />
          ) : (
            <>
              <BarChart data={comparison} height={170} />
              <Text style={styles.chartFootnote}>
                Pendapatan Rp {formatRupiah(monthlyReport?.summary?.totalIncome)} · Pengeluaran Rp{' '}
                {formatRupiah(monthlyReport?.summary?.totalExpense)}
              </Text>
            </>
          )}
        </Card>

        {/* Outlet summary */}
        <Text style={styles.sectionTitle}>Ringkasan Outlet</Text>
        <Card style={styles.listCard}>
          <ListItem
            title="Omzet Harian"
            subtitle={`Rp ${formatRupiah(data.sales?.totalIncome ?? data.sales?.daily ?? 0)}`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.primary }]} />}
            onPress={() => router.push(ROUTES.reports)}
          />
          <ListItem
            title="Pengeluaran Hari Ini"
            subtitle={`Rp ${formatRupiah(data.expenses?.totalExpense ?? (typeof data.expenses === 'number' ? data.expenses : 0))}`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.danger }]} />}
            onPress={() => router.push(ROUTES.expenses)}
          />
          <ListItem
            title="Stok Bahan Aktif"
            subtitle={`${data.stock?.totalItems ?? (typeof data.stock === 'number' ? data.stock : 0)} item (${data.stock?.lowStockCount || 0} menipis)`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.success }]} />}
            onPress={() => router.push(ROUTES.inventory)}
          />
          <ListItem
            title="Catatan Waste Hari Ini"
            subtitle={`${data.waste?.todayCount ?? 0} pencatatan (${data.waste?.todayQuantity ?? 0} total qty)`}
            leading={<View style={[styles.dot, { backgroundColor: colors.light.warning }]} />}
            onPress={() => router.push(ROUTES.waste)}
          />
          <ListItem
            title="Status Closing Harian"
            subtitle={data.closingStatus?.daily?.status === 'CLOSED' || data.closingStatus === 'CLOSED' ? 'Selesai' : 'Belum selesai'}
            leading={<View style={[styles.dot, { backgroundColor: data.closingStatus?.daily?.status === 'CLOSED' || data.closingStatus === 'CLOSED' ? colors.light.success : colors.light.warning }]} />}
            onPress={() => router.push(ROUTES.closings)}
          />
        </Card>

        {/* Outlet access */}
        <Text style={styles.sectionTitle}>Kelola Outlet</Text>
        <Card style={styles.listCard}>
          <ListItem
            title="Kelola Anggota Outlet"
            subtitle="Tambah/edit/cabut akses staf"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.primary }]} />}
            onPress={() => router.push(ROUTES.outletMembers)}
          />
          <ListItem
            title="Laporan Keuangan"
            subtitle="Ekspor CSV / cetak PDF"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.info }]} />}
            onPress={() => router.push(ROUTES.reports)}
          />
          <ListItem
            title="Riwayat Pengeluaran"
            subtitle="Tinjau biaya operasional dan audit"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.danger }]} />}
            onPress={() => router.push(ROUTES.expenses)}
          />
          <ListItem
            title="Persediaan & Mutasi Stok"
            subtitle="Pantau stok dan pergerakan barang"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.success }]} />}
            onPress={() => router.push(ROUTES.inventory)}
          />
          <ListItem
            title="Catatan Limbah / Waste"
            subtitle="Pantau catatan bahan terbuang"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.warning }]} />}
            onPress={() => router.push(ROUTES.waste)}
          />
          <ListItem
            title="Closing & Rekonsiliasi Kas"
            subtitle="Pantau closing dan selisih kas fisik"
            leading={<View style={[styles.dot, { backgroundColor: colors.light.secondary }]} />}
            onPress={() => router.push(ROUTES.closings)}
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
    fontFamily: typography.fontFamily.regular,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
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
    fontFamily: typography.fontFamily.regular,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  metricValue: {
    fontFamily: typography.fontFamily.regular,
    ...typography.weights.semibold,
    fontSize: typography.sizes.lg,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.regular,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  listCard: {
    marginTop: spacing.sm,
  },
  chartCard: {
    marginTop: spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chartTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  chartSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  monthStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  monthButton: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    fontSize: 18,
    color: colors.light.primary,
    lineHeight: 20,
  },
  monthText: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    minWidth: 96,
    textAlign: 'center',
  },
  chartState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartStateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chartFootnote: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
});
