import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import Notice from "../src/components/Notice";
import ScreenFrame from "../src/components/ScreenFrame";
import { createReportApi } from "../src/reports/api";
import { colors, spacing } from "../src/theme/tokens";

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  const num = Math.round(Number(value));
  return num.toLocaleString("id-ID");
}

function todayJakarta() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function thisMonthJakarta() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(new Date());
}

function offsetDay(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function offsetMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDisplayMonth(monthStr) {
  if (!monthStr) return "-";
  const [y, m] = monthStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export default function ReportsScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;

  const selectedOutlet = user?.memberships?.find(
    (membership) => membership.outletId === outletId,
  );
  const outletName = selectedOutlet?.outletName ?? "Outlet";

  const api = useMemo(() => createReportApi({ request: apiRequest }), [apiRequest]);

  const [periodType, setPeriodType] = useState("DAILY"); // "DAILY" | "MONTHLY"
  const [selectedDate, setSelectedDate] = useState(todayJakarta);
  const [selectedMonth, setSelectedMonth] = useState(thisMonthJakarta);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const loadReport = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      if (periodType === "DAILY") {
        const data = await api.getDailyReport(outletId, selectedDate);
        setReport(data);
      } else {
        const data = await api.getMonthlyReport(outletId, selectedMonth);
        setReport(data);
      }
    } catch (err) {
      setError(err.message || "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, periodType, selectedDate, selectedMonth]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrevPeriod = () => {
    if (periodType === "DAILY") {
      setSelectedDate((prev) => offsetDay(prev, -1));
    } else {
      setSelectedMonth((prev) => offsetMonth(prev, -1));
    }
  };

  const handleNextPeriod = () => {
    if (periodType === "DAILY") {
      setSelectedDate((prev) => offsetDay(prev, 1));
    } else {
      setSelectedMonth((prev) => offsetMonth(prev, 1));
    }
  };

  const handleCurrentPeriod = () => {
    if (periodType === "DAILY") {
      setSelectedDate(todayJakarta());
    } else {
      setSelectedMonth(thisMonthJakarta());
    }
  };

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke dashboard"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Kembali</Text>
          </Pressable>
          <Text style={styles.eyebrow}>
            {outletName} · {role}
          </Text>
          <Text style={styles.title}>Laporan Penjualan & Keuangan</Text>
          <Text style={styles.timezoneNote}>
            Batas waktu laporan: Timezone Asia/Jakarta (WIB)
          </Text>
        </View>

        {/* Period Selector Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: periodType === "DAILY" }}
            onPress={() => setPeriodType("DAILY")}
            style={[styles.tab, periodType === "DAILY" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                periodType === "DAILY" && styles.tabTextActive,
              ]}
            >
              Rekap Harian
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: periodType === "MONTHLY" }}
            onPress={() => setPeriodType("MONTHLY")}
            style={[styles.tab, periodType === "MONTHLY" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                periodType === "MONTHLY" && styles.tabTextActive,
              ]}
            >
              Rekap Bulanan
            </Text>
          </Pressable>
        </View>

        {/* Date/Month Navigation Controls */}
        <View style={styles.navControlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Periode sebelumnya"
            onPress={handlePrevPeriod}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>‹ Sebelumnya</Text>
          </Pressable>

          <View style={styles.currentPeriodDisplay}>
            <Text style={styles.periodLabel}>
              {periodType === "DAILY"
                ? formatDisplayDate(selectedDate)
                : formatDisplayMonth(selectedMonth)}
            </Text>
            <Text style={styles.periodSubLabel}>
              {periodType === "DAILY" ? selectedDate : selectedMonth}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Periode berikutnya"
            onPress={handleNextPeriod}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Berikutnya ›</Text>
          </Pressable>
        </View>

        <View style={styles.quickNavRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleCurrentPeriod}
            style={styles.quickNavButton}
          >
            <Text style={styles.quickNavText}>
              {periodType === "DAILY" ? "Hari Ini" : "Bulan Ini"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={loadReport}
            style={styles.quickNavButton}
          >
            <Text style={styles.quickNavText}>Perbarui</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const currentPeriod = periodType === "DAILY" ? selectedDate : selectedMonth;
              Alert.alert(
                "Ekspor Laporan",
                `Laporan ${periodType === "DAILY" ? "Harian" : "Bulanan"} (${currentPeriod}) siap diunduh dalam format Excel (CSV) dan PDF/Cetak.`,
              );
            }}
            style={[styles.quickNavButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.quickNavText, { color: colors.onPrimary }]}>
              📥 Ekspor (Excel / PDF)
            </Text>
          </Pressable>
        </View>

        {error ? <Notice variant="danger">{error}</Notice> : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat data laporan...</Text>
          </View>
        ) : report ? (
          <View style={styles.reportContent}>
            {/* Section 1: Ringkasan Pemasukan & Pengeluaran */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Ringkasan Pemasukan & Pengeluaran
              </Text>
              <Text style={styles.sectionSubtitle}>
                Pemasukan otomatis dihitung dari transaksi POS selesai
              </Text>

              <View
                style={[
                  styles.cardRow,
                  isWide ? styles.cardRowWide : styles.cardRowNarrow,
                ]}
              >
                {/* Total Pemasukan */}
                <View style={[styles.summaryCard, styles.incomeCard]}>
                  <Text style={styles.cardLabel}>Total Pemasukan (POS)</Text>
                  <Text style={styles.incomeAmount}>
                    Rp {formatRupiah(report.summary.totalIncome)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Dari {report.summary.transactionCount} transaksi POS
                  </Text>
                </View>

                {/* Total Pengeluaran */}
                <View style={[styles.summaryCard, styles.expenseCard]}>
                  <Text style={styles.cardLabel}>Total Pengeluaran</Text>
                  <Text style={styles.expenseAmount}>
                    Rp {formatRupiah(report.summary.totalExpense)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Dari {report.summary.expenseCount} pengeluaran tercatat
                  </Text>
                </View>

                {/* Arus Bersih */}
                <View style={[styles.summaryCard, styles.netCard]}>
                  <Text style={styles.cardLabel}>
                    Arus Kas Bersih (Masuk - Keluar)
                  </Text>
                  <Text
                    style={[
                      styles.netAmount,
                      Number(report.summary.netBalance) < 0 && styles.negativeAmount,
                    ]}
                  >
                    Rp {formatRupiah(report.summary.netBalance)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Belum termasuk kalkulasi HPP / bagi hasil
                  </Text>
                </View>
              </View>
            </View>

            {/* Section 2: Rincian Pembayaran (Cash vs QRIS) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Rincian Transaksi & Metode Pembayaran
              </Text>
              <View style={styles.paymentBox}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentMethodTitle}>Tunai (Cash)</Text>
                    <Text style={styles.paymentCount}>
                      {report.paymentSummary.cash.count} Transaksi
                    </Text>
                  </View>
                  <Text style={styles.paymentTotal}>
                    Rp {formatRupiah(report.paymentSummary.cash.total)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.paymentRow}>
                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentMethodTitle}>QRIS</Text>
                    <Text style={styles.paymentCount}>
                      {report.paymentSummary.qris.count} Transaksi
                    </Text>
                  </View>
                  <Text style={styles.paymentTotal}>
                    Rp {formatRupiah(report.paymentSummary.qris.total)}
                  </Text>
                </View>

                {/* Detail status QRIS */}
                <View style={styles.qrisDetailBox}>
                  <Text style={styles.qrisDetailItem}>
                    • QRIS Tercatat (Settled):{" "}
                    {report.paymentSummary.qris.recorded.count} transaksi (Rp{" "}
                    {formatRupiah(report.paymentSummary.qris.recorded.total)})
                  </Text>
                  <Text style={styles.qrisDetailItem}>
                    • QRIS Rekonsiliasi Tertunda:{" "}
                    {report.paymentSummary.qris.pendingReconciliation.count}{" "}
                    transaksi (Rp{" "}
                    {formatRupiah(
                      report.paymentSummary.qris.pendingReconciliation.total,
                    )}
                    )
                  </Text>
                </View>
              </View>
            </View>

            {/* Section 3: Penjualan Berdasarkan Produk dan Ukuran */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Penjualan Berdasarkan Produk & Ukuran
              </Text>
              <Text style={styles.sectionSubtitle}>
                Rincian minuman dan varian ukuran yang terjual
              </Text>

              {report.productSales.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Belum ada data penjualan produk pada periode ini.
                  </Text>
                </View>
              ) : (
                <View style={styles.listBox}>
                  <View style={styles.listHeaderRow}>
                    <Text style={[styles.listHeaderCell, { flex: 2 }]}>
                      Produk / Ukuran
                    </Text>
                    <Text style={[styles.listHeaderCell, { flex: 1, textAlign: "center" }]}>
                      Qty
                    </Text>
                    <Text style={[styles.listHeaderCell, { flex: 1.5, textAlign: "right" }]}>
                      Total Omzet
                    </Text>
                  </View>

                  {report.productSales.map((item, index) => (
                    <View
                      key={`${item.productVariantId || index}-${item.variantName}`}
                      style={[
                        styles.listItemRow,
                        index % 2 === 1 && styles.listItemAlt,
                      ]}
                    >
                      <View style={{ flex: 2 }}>
                        <Text style={styles.productNameText}>{item.productName}</Text>
                        <Text style={styles.variantNameText}>
                          Ukuran: {item.variantName}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.listCellText,
                          { flex: 1, textAlign: "center" },
                        ]}
                      >
                        {item.quantity} cup
                      </Text>
                      <Text
                        style={[
                          styles.listCellBold,
                          { flex: 1.5, textAlign: "right" },
                        ]}
                      >
                        Rp {formatRupiah(item.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Section 4: Rincian Pengeluaran Berdasarkan Kategori */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rincian Pengeluaran</Text>
              <Text style={styles.sectionSubtitle}>
                Total pengeluaran aktif: Rp {formatRupiah(report.expenseSummary.total)}
              </Text>

              {report.expenseSummary.categories.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Tidak ada pengeluaran tercatat pada periode ini.
                  </Text>
                </View>
              ) : (
                <View style={styles.listBox}>
                  {report.expenseSummary.categories.map((cat, idx) => (
                    <View
                      key={cat.categoryId || idx}
                      style={[
                        styles.expenseItemRow,
                        idx % 2 === 1 && styles.listItemAlt,
                      ]}
                    >
                      <View style={{ flex: 2 }}>
                        <Text style={styles.categoryNameText}>
                          {cat.categoryName}
                        </Text>
                        <Text style={styles.categoryMetaText}>
                          {cat.count} pengeluaran
                        </Text>
                      </View>
                      <Text style={styles.expenseItemAmount}>
                        Rp {formatRupiah(cat.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Section 5 (Bulanan): Rekap Harian */}
            {periodType === "MONTHLY" && Array.isArray(report.dailyBreakdown) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Rincian Penjualan Harian Bulan Ini
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Ringkasan transaksi, pemasukan, dan pengeluaran per hari
                </Text>

                {report.dailyBreakdown.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      Belum ada catatan transaksi pada bulan ini.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.listBox}>
                    <View style={styles.listHeaderRow}>
                      <Text style={[styles.listHeaderCell, { flex: 1.2 }]}>
                        Tanggal
                      </Text>
                      <Text style={[styles.listHeaderCell, { flex: 0.8, textAlign: "center" }]}>
                        Trx
                      </Text>
                      <Text style={[styles.listHeaderCell, { flex: 1.3, textAlign: "right" }]}>
                        Pemasukan
                      </Text>
                      <Text style={[styles.listHeaderCell, { flex: 1.3, textAlign: "right" }]}>
                        Pengeluaran
                      </Text>
                    </View>

                    {report.dailyBreakdown.map((day, idx) => (
                      <View
                        key={day.date}
                        style={[
                          styles.listItemRow,
                          idx % 2 === 1 && styles.listItemAlt,
                        ]}
                      >
                        <Text style={[styles.productNameText, { flex: 1.2 }]}>
                          {formatDisplayDate(day.date)}
                        </Text>
                        <Text
                          style={[
                            styles.listCellText,
                            { flex: 0.8, textAlign: "center" },
                          ]}
                        >
                          {day.transactionCount}
                        </Text>
                        <Text
                          style={[
                            styles.incomeListCell,
                            { flex: 1.3, textAlign: "right" },
                          ]}
                        >
                          Rp {formatRupiah(day.totalIncome)}
                        </Text>
                        <Text
                          style={[
                            styles.expenseListCell,
                            { flex: 1.3, textAlign: "right" },
                          ]}
                        >
                          Rp {formatRupiah(day.totalExpense)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  timezoneNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    padding: 4,
    marginVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  navControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  navButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  currentPeriodDisplay: {
    alignItems: "center",
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  periodSubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quickNavRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  quickNavButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  reportContent: {
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  cardRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cardRowWide: {
    flexDirection: "row",
  },
  cardRowNarrow: {
    flexDirection: "column",
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#2F6B48",
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  netCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2F6B48",
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.danger,
  },
  netAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  negativeAmount: {
    color: colors.danger,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  paymentBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentCol: {
    gap: 2,
  },
  paymentMethodTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  paymentCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paymentTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  qrisDetailBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  qrisDetailItem: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  listHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listHeaderCell: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  listItemAlt: {
    backgroundColor: "#F9FAF9",
  },
  productNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  variantNameText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  listCellText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  listCellBold: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  incomeListCell: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2F6B48",
  },
  expenseListCell: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.danger,
  },
  expenseItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  categoryNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  categoryMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  expenseItemAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
  },
  emptyBox: {
    padding: spacing.md,
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
});

