// ReportsScreen — laporan harian/bulanan + ekspor PDF & Excel asli
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../src/auth/AuthContext';
import { createReportsApi } from '../src/api/reports';
import { createApiClient } from '../src/api/api';
import { createReportPdf, createReportXlsx, bytesToBase64 } from '../src/lib/reportFiles';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import { useResponsive } from '../src/theme/responsive';
import Card from '../src/components/Card';
import Input from '../src/components/Input';
import BaseButton from '../src/components/BaseButton';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import AppShell from '../src/components/AppShell';
import StateCard from '../src/components/StateCard';
import Notice from '../src/components/Notice';

function formatRupiah(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('id-ID') : '0';
}

export default function ReportsScreen() {
  const r = useResponsive();
  const { selection, user } = useAuth();
  const activeRole = user?.memberships?.find((m) => m.outletId === selection.activeOutletId)?.role;
  const navRole = activeRole === 'OWNER_MITRA' || activeRole === 'OWNER' ? 'ownerMitra' : 'manager';
  const outletId = selection.activeOutletId;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate] = useState(`${yyyy}-${mm}-${dd}`);
  const [monthKey, setMonthKey] = useState(`${yyyy}-${mm}`);
  const [mode, setMode] = useState('DAILY');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [reportError, setReportError] = useState(null);

  const periodLabel = mode === 'MONTHLY' ? monthKey : date;

  const loadReport = useCallback(async () => {
    try {
      const client = createApiClient();
      const reportsApi = createReportsApi({ request: client });
      const data = mode === 'MONTHLY'
        ? await reportsApi.getMonthlyReport(outletId, monthKey)
        : await reportsApi.getDailyReport(outletId, date);
      setReport(data);
      setReportError(null);
    } catch (err) {
      setReportError(err?.message || 'Laporan gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, date, monthKey, mode]);

  const handleDownload = useCallback(async (kind) => {
    if (!report) return;
    setGenerating(true);
    setError(null);
    try {
      const bytes = kind === 'pdf'
        ? createReportPdf(report, periodLabel)
        : createReportXlsx(report, periodLabel);
      const extension = kind === 'pdf' ? 'pdf' : 'xlsx';

      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error('Direktori cache tidak tersedia.');

      const filename = `laporan-seroo-${periodLabel}.${extension}`;
      const uri = `${directory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert('Berhasil', `${filename} tersimpan di perangkat.`);
      try {
        await Share.share({ title: filename, message: filename, url: uri });
      } catch {
        // Share file tidak didukung di semua platform; file tetap tersimpan.
      }
    } catch (err) {
      setError(err?.message || 'Gagal membuat file laporan.');
    } finally {
      setGenerating(false);
    }
  }, [report, periodLabel]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = report?.summary || {};
  const payment = report?.paymentSummary || {};
  const productSales = Array.isArray(report?.productSales) ? report.productSales : [];
  const expenseCategories = Array.isArray(report?.expenseSummary?.categories)
    ? report.expenseSummary.categories
    : [];
  const summaryCardStyle = [
    styles.summaryCard,
    { flex: 1, minWidth: r.isSmallPhone ? '100%' : r.isPhone ? 140 : 180 },
  ];

  return (
    <AppShell
      navRole={navRole}
      active="laporan"
      title="Laporan outlet"
      subtitle="Rincian produk, ukuran, topping, sumber pesanan, dan metode bayar."
      roleLabel={navRole === 'ownerMitra' ? 'OWNER MITRA' : 'MANAGER'}
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={[styles.container, { padding: r.padding, gap: r.gap }]}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadReport} />}
      >
        {reportError && <Notice message={reportError} type="error" />}
        {error && <Notice message={error} type="error" />}

        <Card style={[styles.filterCard, { flexWrap: 'wrap' }]}>
          <View style={[styles.filterBody, r.isPhone && styles.filterBodyFull]}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.chip, mode === 'DAILY' && styles.chipActive]}
                onPress={() => setMode('DAILY')}
              >
                <Text style={[styles.chipText, mode === 'DAILY' && styles.chipTextActive]}>Harian</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, mode === 'MONTHLY' && styles.chipActive]}
                onPress={() => setMode('MONTHLY')}
              >
                <Text style={[styles.chipText, mode === 'MONTHLY' && styles.chipTextActive]}>Bulanan</Text>
              </TouchableOpacity>
            </View>
            {mode === 'DAILY' ? (
              <Input
                label="Tanggal"
                value={date}
                onChangeText={setDate}
                placeholder="Pilih tanggal (YYYY-MM-DD)"
                keyboardType="numeric"
              />
            ) : (
              <Input
                label="Bulan"
                value={monthKey}
                onChangeText={setMonthKey}
                placeholder="Format YYYY-MM"
              />
            )}
          </View>
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={loadReport}>
            <Text style={styles.buttonText}>Load</Text>
          </TouchableOpacity>
        </Card>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.text}>Memuat laporan…</Text>
          </View>
        ) : report ? (
          <>
            <View style={styles.summary}>
              <Card style={summaryCardStyle}>
                <Text style={styles.summaryLabel}>Total Pendapatan</Text>
                <Text style={styles.summaryValue}>Rp {formatRupiah(summary.totalIncome)}</Text>
              </Card>
              <Card style={summaryCardStyle}>
                <Text style={styles.summaryLabel}>Total Pengeluaran</Text>
                <Text style={styles.summaryValue}>Rp {formatRupiah(summary.totalExpense)}</Text>
              </Card>
              <Card style={summaryCardStyle}>
                <Text style={styles.summaryLabel}>Saldo Bersih</Text>
                <Text style={[styles.summaryValue, styles.valuePositive]}>
                  Rp {formatRupiah(summary.netBalance)}
                </Text>
              </Card>
              <Card style={summaryCardStyle}>
                <Text style={styles.summaryLabel}>Transaksi</Text>
                <Text style={styles.summaryValue}>{summary.transactionCount ?? 0}</Text>
              </Card>
            </View>

            <Text style={styles.sectionTitle}>Rincian Pembayaran</Text>
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderItem}>Metode</Text>
                <Text style={styles.tableHeaderItem}>Jumlah</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableItem}>CASH ({payment.cash?.count ?? 0} trx)</Text>
                <Text style={styles.tableItem}>Rp {formatRupiah(payment.cash?.total)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableItem}>QRIS ({payment.qris?.count ?? 0} trx)</Text>
                <Text style={styles.tableItem}>Rp {formatRupiah(payment.qris?.total)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableItem}>QRIS terverifikasi</Text>
                <Text style={styles.tableItem}>Rp {formatRupiah(payment.qris?.recorded?.total)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableItem}>QRIS menunggu</Text>
                <Text style={styles.tableItem}>Rp {formatRupiah(payment.qris?.pendingReconciliation?.total)}</Text>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Penjualan Produk</Text>
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderItem}>Produk / Varian</Text>
                <Text style={styles.tableHeaderItem}>Qty · Total</Text>
              </View>
              {productSales.length === 0 ? (
                <Text style={styles.emptyRow}>Tidak ada penjualan.</Text>
              ) : (
                productSales.map((item) => (
                  <View key={`${item.productVariantId}-${item.variantName}`} style={styles.tableRow}>
                    <Text style={styles.tableItem}>
                      {item.productName} {item.variantName}
                    </Text>
                    <Text style={styles.tableItem}>
                      {item.quantity} · Rp {formatRupiah(item.total)}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderItem}>Kategori</Text>
                <Text style={styles.tableHeaderItem}>Jumlah</Text>
              </View>
              {expenseCategories.length === 0 ? (
                <Text style={styles.emptyRow}>Tidak ada pengeluaran.</Text>
              ) : (
                expenseCategories.map((item) => (
                  <View key={item.categoryId} style={styles.tableRow}>
                    <Text style={styles.tableItem}>
                      {item.categoryName} ({item.count} trx)
                    </Text>
                    <Text style={styles.tableItem}>Rp {formatRupiah(item.total)}</Text>
                  </View>
                ))
              )}
            </Card>

            <View style={styles.actions}>
              <BaseButton
                label="Unduh PDF"
                onPress={() => handleDownload('pdf')}
                fullWidth
                variant="primary"
                size="lg"
                loading={generating}
                disabled={generating}
              />
              <BaseButton
                label="Unduh Excel"
                onPress={() => handleDownload('xlsx')}
                fullWidth
                variant="secondary"
                size="lg"
                loading={generating}
                disabled={generating}
              />
            </View>
          </>
        ) : (
          <StateCard
            title="Belum ada data"
            tone="empty"
            description="Belum ada transaksi pada rentang tanggal ini."
            detail="Ubah periode laporan atau periksa kembali setelah ada transaksi."
          />
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm },
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
  filterCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filterBody: { flex: 1, gap: spacing.sm },
  filterBodyFull: { flexBasis: '100%' },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chipTextActive: { color: colors.light.onPrimary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryCard: { minWidth: 0 },
  summaryLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  summaryValue: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.lg,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  valuePositive: { color: colors.light.success },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  tableCard: { marginTop: spacing.sm },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  tableHeaderItem: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  tableItem: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  emptyRow: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    padding: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  button: { borderRadius: radii.md, padding: spacing.md },
  buttonPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  buttonText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    color: colors.light.onPrimary,
  },
  icon: { fontSize: 40 },
});
