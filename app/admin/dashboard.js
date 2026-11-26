// AdminDashboardScreen — Figma 01 · Owner Pusat Ringkasan (HP & Tablet)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ROUTES } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import AppShell from '../../src/components/AppShell';
import BarChart from '../../src/components/BarChart';
import Notice from '../../src/components/Notice';
import {
  buildOutletSalesSeries,
  getAdminOutlets,
  jakartaMonthKey,
  monthLabel,
  shiftMonth,
} from '../../src/dashboard/chartData';
import { createReportApi } from '../../src/reports/api';

const TASKS = [
  { icon: '▦', title: 'Master menu', desc: 'Produk dan ukuran', route: ROUTES.adminCatalog },
  { icon: 'Rp', title: 'Harga menu', desc: 'Berlaku dari pusat', route: ROUTES.adminCatalog },
  { icon: '♙', title: 'Manajemen akun', desc: 'Role dan membership', route: ROUTES.adminAccounts },
  { icon: '⌖', title: 'Penugasan outlet', desc: 'Owner Mitra, Manager, Crew', route: ROUTES.adminOutlets },
];

function formatRupiah(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('id-ID') : '0';
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, apiRequest } = useAuth();
  const adminOutlets = useMemo(() => getAdminOutlets(user?.memberships), [user]);
  const [monthKey, setMonthKey] = useState(jakartaMonthKey());
  const [series, setSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
  const [failedCount, setFailedCount] = useState(0);
  const requestIdRef = useRef(0);

  const loadChart = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!adminOutlets.length) {
      setSeries([]);
      setChartError(null);
      setFailedCount(0);
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    setChartError(null);
    setFailedCount(0);
    try {
      const reportsApi = createReportApi({ request: apiRequest });
      const results = await Promise.allSettled(
        adminOutlets.map(async (outlet) => ({
          id: outlet.id,
          report: await reportsApi.getMonthlyReport(outlet.id, monthKey),
        })),
      );
      if (requestId !== requestIdRef.current) return;
      const reportsById = new Map();
      let failed = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          reportsById.set(result.value.id, result.value.report);
        } else {
          failed += 1;
        }
      }
      setSeries(buildOutletSalesSeries({ outlets: adminOutlets, reportsById }));
      setFailedCount(failed);
      if (failed === adminOutlets.length) {
        setChartError('Grafik penjualan per outlet gagal dimuat.');
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setChartError(err?.message || 'Grafik penjualan per outlet gagal dimuat.');
    } finally {
      if (requestId === requestIdRef.current) setChartLoading(false);
    }
  }, [adminOutlets, apiRequest, monthKey]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const chartTotal = series.reduce((sum, item) => sum + item.value, 0);

  return (
    <AppShell
      navRole="ownerPusat"
      active="ringkasan"
      title="Pengelolaan pusat"
      subtitle="Kelola master produk, harga, akun, dan penugasan outlet."
      roleLabel="OWNER PUSAT"
      outletLabel="AKSES GLOBAL"
      scopeLabel="AKSES GLOBAL"
    >
      <View style={styles.taskCard}>
        <Text style={styles.taskCardTitle}>Tugas pengelolaan</Text>
        {TASKS.map((task, index) => (
          <React.Fragment key={task.title}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <TouchableOpacity style={styles.taskRow} onPress={() => router.push(task.route)}>
              <View style={styles.taskIcon}>
                <Text style={styles.taskIconText}>{task.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDesc}>{task.desc}</Text>
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.boundaryCard}>
        <Text style={styles.boundaryTitle}>Batas akses data keuangan</Text>
        <Text style={styles.boundaryText}>
          Halaman ini untuk administrasi brand. Laporan keuangan outlet tetap mengikuti hak
          akses Owner Mitra terhadap outlet miliknya, bukan agregat seluruh jaringan.
        </Text>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Penjualan per outlet</Text>
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
        <Text style={styles.chartSubtitle}>
          {monthLabel(monthKey)} · outlet dengan akses langsung Admin Pusat
        </Text>
        {chartLoading ? (
          <View style={styles.chartState}>
            <ActivityIndicator size="small" color={colors.light.primary} />
            <Text style={styles.chartFootnote}>Memuat penjualan per outlet...</Text>
          </View>
        ) : chartError ? (
          <Notice message={chartError} type="error" />
        ) : (
          <>
            <BarChart
              data={series.map((item, index) => ({
                ...item,
                color: index === 0 ? colors.light.primary : colors.light.primaryLight,
              }))}
              height={170}
            />
            {series.length > 0 ? (
              <Text style={styles.chartFootnote}>
                Total Rp {formatRupiah(chartTotal)} dari {series.length} outlet
                {failedCount > 0 ? ` · ${failedCount} outlet gagal dimuat` : ''}
              </Text>
            ) : null}
            <Text style={styles.chartCaption}>
              Hanya transaksi POS selesai dari outlet dengan membership ADMIN_PUSAT. Outlet mitra tidak diikutkan.
            </Text>
          </>
        )}
      </View>

      <View style={styles.privilegeBadge}>
        <Text style={styles.privilegeText}>MASTER & AKUN</Text>
      </View>

      <TouchableOpacity onPress={() => router.push(ROUTES.adminAudit)}>
        <Text style={styles.auditLink}>Riwayat aktivitas →</Text>
      </TouchableOpacity>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  taskCardTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.semibold,
    fontSize: 17,
    color: colors.light.textPrimary,
    marginBottom: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIconText: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.bold,
    fontSize: 14,
    color: colors.light.primary,
  },
  taskTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.semibold,
    fontSize: 15,
    color: colors.light.textPrimary,
  },
  taskDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.textSecondary,
  },
  divider: { height: 1, backgroundColor: colors.light.border },
  boundaryCard: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  boundaryTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.semibold,
    fontSize: 16,
    color: colors.light.maroon,
  },
  boundaryText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.light.textPrimary,
  },
  chartCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.xs,
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
    fontSize: 16,
    color: colors.light.textPrimary,
  },
  chartSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
  },
  monthStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  monthButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    fontSize: 18,
    lineHeight: 20,
    color: colors.light.primary,
  },
  monthText: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
    color: colors.light.textPrimary,
    minWidth: 92,
    textAlign: 'center',
  },
  chartState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartFootnote: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: spacing.xs,
  },
  chartCaption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.light.textSecondary,
    marginTop: spacing.xs,
  },
  privilegeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  privilegeText: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
    color: colors.light.surface,
  },
  auditLink: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.primary,
    marginTop: spacing.xl,
  },
});
