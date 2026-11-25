// CrewScreen — Figma 01 · Crew Beranda (HP & Tablet)
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { ROUTES } from '../src/auth/routePolicy';
import { createOrdersApi } from '../src/api/orders';
import { createApiRequestWrapper } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import AppShell from '../src/components/AppShell';

const QUICK = [
  { title: 'Buat pesanan', desc: 'Mulai POS', icon: '＋', route: ROUTES.crewPos },
  { title: 'Catat waste', desc: 'Barang terbuang', icon: '↗', route: ROUTES.waste },
  { title: 'Laporkan kehilangan', desc: 'Periksa Manager', icon: '!', route: ROUTES.lossReports },
  { title: 'Status stok', desc: 'Tanpa jumlah rinci', icon: '○', route: ROUTES.inventory },
];

export default function CrewScreen() {
  const { user, selection, apiRequest } = useAuth();
  const router = useRouter();
  const outlet = user?.memberships?.find((m) => m.outletId === selection.activeOutletId);
  const outletName = outlet?.outletName || 'Outlet';

  const ordersApi = useCallback(() => createOrdersApi({ request: createApiRequestWrapper(apiRequest) }), [apiRequest]);

  const [stats, setStats] = useState({ transactionCount: 0, totalSales: '0' });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        const data = await ordersApi().listOrders(outlet?.outletId || selection.activeOutletId, {
          crewId: user?.id,
          startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
          endDate: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
        });
        if (cancelled) return;
        const orders = data?.data?.orders || [];
        setStats({
          transactionCount: orders.length,
          totalSales: orders.reduce((sum, o) => sum + Number(o.total || 0), 0).toLocaleString('id-ID'),
        });
      } catch {
        // statistik opsional
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, [ordersApi, outlet?.outletId, user?.id, selection.activeOutletId]);

  return (
    <AppShell
      navRole="crew"
      active="beranda"
      title="Selamat bekerja"
      subtitle={outletName}
      roleLabel="CREW · OUTLET"
      outletLabel={outletName}
      scopeLabel={outletName}
    >
      <View style={styles.shiftCard}>
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftBadgeText}>SHIFT BERJALAN</Text>
        </View>
        <Text style={styles.shiftTitle}>Shift Pagi / Sore · sesuai penugasan</Text>
        <Text style={styles.shiftHint}>Jam mengikuti jadwal outlet/mitra</Text>
        <TouchableOpacity onPress={() => router.push(ROUTES.helpFaq)}>
          <Text style={styles.shiftLink}>Serah terima →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Transaksi saya</Text>
          <Text style={styles.metricValue}>{loadingStats ? '—' : stats.transactionCount}</Text>
          <Text style={styles.metricHint}>Hari ini</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Penjualan saya</Text>
          <Text style={styles.metricValue}>{loadingStats ? 'Rp —' : `Rp ${stats.totalSales}`}</Text>
          <Text style={styles.metricHint}>Transaksi akun ini</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Akses cepat</Text>
      <View style={styles.quickGrid}>
        {QUICK.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.quickCard}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTitle}>{item.title}</Text>
              <Text style={styles.quickDesc}>{item.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footerNote}>
        Crew tidak melihat laporan Cash Flow atau omzet outlet.
      </Text>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  shiftCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  shiftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.maroon,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  shiftBadgeText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.surface,
  },
  shiftTitle: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  shiftHint: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  shiftLink: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.primary,
    alignSelf: 'flex-end',
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metricLabel: {
    ...typography.fontFamily.medium,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  metricValue: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 22,
    color: colors.light.textPrimary,
  },
  metricHint: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  sectionTitle: {
    ...typography.fontFamily.display,
    fontSize: 17,
    color: colors.light.textPrimary,
    marginBottom: spacing.sm,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickCard: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 84,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  quickIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 14,
    color: colors.light.primary,
  },
  quickTitle: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
    color: colors.light.textPrimary,
  },
  quickDesc: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  footerNote: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
