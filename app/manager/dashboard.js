import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { ROUTES } from "../../src/auth/routePolicy";
import LogoutButton from "../../src/components/LogoutButton";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ProfileButton from "../../src/components/ProfileButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import FadeIn from "../../src/components/FadeIn";
import Badge from "../../src/components/Badge";
import BarChart from "../../src/components/BarChart";
import { createDashboardApi } from "../../src/dashboard/api";
import { createCatalogApi } from "../../src/api/catalog";
import { createReportApi } from "../../src/reports/api";
import { getSevenDaySales } from "../../src/dashboard/chartData";
import { colors, spacing } from "../../src/theme/tokens";

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  const num = Math.round(Number(value));
  return num.toLocaleString("id-ID");
}

const TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(isoString) {
  if (!isoString) return "-";
  return TIME_FORMAT.format(new Date(isoString));
}

export default function ManagerDashboardScreen() {
  const { user, selection, apiRequest, notice: authNotice } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const outletId = selection?.activeOutletId;
  const memberships = user?.memberships ?? [];

  const selectedOutlet = memberships.find(
    (membership) => membership.outletId === outletId,
  );
  const outletLabel = selectedOutlet?.outletName ?? "Outlet";

  const api = useMemo(
    () => createDashboardApi({ request: apiRequest }),
    [apiRequest],
  );

  const catalogApi = useMemo(
    () => createCatalogApi({ request: apiRequest }),
    [apiRequest],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [chartSeries, setChartSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  // State ketersediaan menu per outlet
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState(null);
  const [productSuccess, setProductSuccess] = useState(null);
  const [updatingProductIds, setUpdatingProductIds] = useState({});
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("SEMUA");

  const loadDashboard = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard(outletId);
      setData(res);
    } catch (err) {
      setError(err.message || "Gagal memuat data dashboard.");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  const loadChart = useCallback(async () => {
    if (!outletId) {
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    setChartError(null);
    try {
      const reportsApi = createReportApi({ request: apiRequest });
      const series = await getSevenDaySales({ reportsApi, outletId });
      setChartSeries(series);
    } catch (err) {
      setChartError(err.message || "Gagal memuat tren penjualan.");
    } finally {
      setChartLoading(false);
    }
  }, [apiRequest, outletId]);

  const refreshAll = useCallback(() => {
    loadDashboard();
    loadChart();
  }, [loadDashboard, loadChart]);

  const loadProductAvailability = useCallback(async () => {
    if (!outletId) return;
    setLoadingProducts(true);
    setProductError(null);
    try {
      const res = await catalogApi.getProductAvailability(outletId);
      const list = res?.data?.products || res?.products || [];
      setProducts(list);
    } catch (err) {
      setProductError(err.message || "Gagal memuat ketersediaan menu.");
    } finally {
      setLoadingProducts(false);
    }
  }, [catalogApi, outletId]);

  useEffect(() => {
    loadDashboard();
    loadChart();
    loadProductAvailability();
  }, [loadDashboard, loadChart, loadProductAvailability]);

  const handleToggleAvailability = useCallback(
    async (productId, currentStatus) => {
      if (updatingProductIds[productId]) return;
      const targetStatus = !currentStatus;
      setUpdatingProductIds((prev) => ({ ...prev, [productId]: true }));
      setProductError(null);
      setProductSuccess(null);
      try {
        await catalogApi.setProductAvailability(outletId, productId, targetStatus);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, isAvailable: targetStatus } : p,
          ),
        );
        setProductSuccess(
          `Status produk berhasil diubah menjadi ${targetStatus ? "Tersedia" : "Tidak Tersedia"}.`,
        );
      } catch (err) {
        setProductError(
          err.message || "Gagal mengubah status ketersediaan produk.",
        );
      } finally {
        setUpdatingProductIds((prev) => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      }
    },
    [catalogApi, outletId, updatingProductIds],
  );

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ["SEMUA", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory =
        selectedCategory === "SEMUA" || p.category === selectedCategory;
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.trim().toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, productSearch]);

  const dailyStatus = data?.closingStatus?.daily?.status || "OPEN";
  const chartRangeLabel = chartSeries.length
    ? `${chartSeries[0].label} – ${chartSeries[chartSeries.length - 1].label}`
    : "";
  const chartTotal = chartSeries.reduce((sum, item) => sum + item.value, 0);

  return (
    <ScreenFrame>
      <FadeIn style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>Seroo · Manager Operasional</Text>
            <Text style={styles.title}>Dashboard Manager</Text>
            <Text style={styles.subtitle}>
              {user?.name} · {outletLabel} ({selectedOutlet?.outletCode})
            </Text>
          </View>
          <View style={styles.headerBtnCol}>
            {memberships.length > 1 ? (
              <PrimaryButton
                label="Ganti Outlet"
                secondary
                onPress={() => router.push(ROUTES.selectOutlet)}
              />
            ) : null}
            <ProfileButton />
            <LogoutButton />
          </View>
        </View>

        {authNotice ? <Notice variant="info">{authNotice}</Notice> : null}
        {error ? <Notice variant="danger">{error}</Notice> : null}

        {/* Quick Action Navigation Grid */}
        <View style={styles.quickActionBox}>
          <Text style={styles.sectionHeading}>Menu Operasional</Text>
          <View style={styles.actionGrid}>
            {[
              { label: "Closing & Reopen", route: ROUTES.closings, highlight: true },
              { label: "Laporan Keuangan", route: ROUTES.reports },
              { label: "Kelola Stok", route: ROUTES.inventory },
              { label: "Permintaan Stok", route: ROUTES.stockRequests },
              { label: "Pengeluaran", route: ROUTES.expenses },
              { label: "Catatan Waste", route: ROUTES.waste },
              { label: "Laporan Kehilangan", route: ROUTES.lossReports },
              { label: "Ketersediaan Menu", onPress: loadProductAvailability },
            ].map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={
                  action.route ? () => router.push(action.route) : action.onPress
                }
                style={({ pressed }) => [
                  styles.actionBtn,
                  action.highlight && styles.actionBtnHighlight,
                  pressed && styles.actionPressed,
                ]}
              >
                <Text
                  style={
                    action.highlight
                      ? styles.actionBtnTextHighlight
                      : styles.actionBtnText
                  }
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat ringkasan dashboard...</Text>
          </View>
        ) : data ? (
          <View style={styles.dashboardContent}>
            {/* Status Closing Banner */}
            <View
              style={[
                styles.closingBanner,
                dailyStatus === "CLOSED" && styles.bannerClosed,
                dailyStatus === "REOPENED" && styles.bannerReopened,
                dailyStatus === "OPEN" && styles.bannerOpen,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.closingBannerTitle}>
                  Status Closing Hari Ini ({data.today}):
                </Text>
                <Text style={styles.closingBannerStatus}>
                  {dailyStatus === "CLOSED"
                    ? `TELAH DITUTUP (Versi ${data.closingStatus.daily.version})`
                    : dailyStatus === "REOPENED"
                      ? "SEDANG DIREOPEN (KOREKSI AKTIF)"
                      : "BELUM CLOSING (BUKAN LAPORAN FINAL)"}
                </Text>
                {data.closingStatus.daily.closedBy ? (
                  <Text style={styles.closingBannerMeta}>
                    Oleh: {data.closingStatus.daily.closedBy}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(ROUTES.closings)}
                style={styles.bannerActionBtn}
              >
                <Text style={styles.bannerActionText}>Kelola Closing ›</Text>
              </Pressable>
            </View>

            {/* Tren penjualan 7 hari */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Tren Penjualan 7 Hari Terakhir</Text>
                <Pressable onPress={loadChart} style={styles.refreshBtn} disabled={chartLoading}>
                  <Text style={styles.refreshBtnText}>
                    {chartLoading ? "Memuat..." : "Perbarui"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                {chartRangeLabel ? `${chartRangeLabel} · ` : ""}Transaksi POS selesai, dihitung per hari
              </Text>
              {chartLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Memuat tren penjualan...</Text>
                </View>
              ) : chartError ? (
                <Notice variant="danger">{chartError}</Notice>
              ) : (
                <>
                  <BarChart data={chartSeries} height={isWide ? 180 : 140} />
                  <Text style={styles.chartTotal}>
                    Total 7 hari: Rp {formatRupiah(chartTotal)}
                  </Text>
                </>
              )}
            </View>

            {/* Pengaturan Ketersediaan Menu Outlet */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Ketersediaan Menu Outlet</Text>
                  <Text style={styles.cardSubtitle}>
                    Atur produk yang tersedia untuk dijual dan dipesan di outlet ini
                  </Text>
                </View>
                <Pressable
                  onPress={loadProductAvailability}
                  style={styles.refreshBtn}
                  disabled={loadingProducts}
                >
                  <Text style={styles.refreshBtnText}>
                    {loadingProducts ? "Memuat..." : "Perbarui"}
                  </Text>
                </Pressable>
              </View>

              {productError ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <Notice variant="danger">{productError}</Notice>
                </View>
              ) : null}
              {productSuccess ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <Notice variant="success">{productSuccess}</Notice>
                </View>
              ) : null}

              {/* Filter Kategori & Pencarian */}
              <View style={styles.filterRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama produk..."
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholderTextColor={colors.textSecondary}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Daftar Produk */}
              {loadingProducts && products.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Memuat ketersediaan menu...</Text>
                </View>
              ) : filteredProducts.length === 0 ? (
                <Text style={styles.emptyActivityText}>
                  {products.length === 0
                    ? "Belum ada produk aktif di katalog."
                    : "Tidak ada produk yang cocok dengan pencarian."}
                </Text>
              ) : (
                <View style={styles.productList}>
                  {filteredProducts.map((prod) => {
                    const isBusy = Boolean(updatingProductIds[prod.id]);
                    return (
                      <View key={prod.id} style={styles.productRow}>
                        <View style={{ flex: 1, paddingRight: spacing.sm }}>
                          <View style={styles.productTitleRow}>
                            <Text style={styles.productName}>{prod.name}</Text>
                            <Badge
                              label={prod.isAvailable ? "Tersedia" : "Tidak Tersedia"}
                              variant={prod.isAvailable ? "success" : "default"}
                              size="sm"
                            />
                          </View>
                          <Text style={styles.productMeta}>
                            {prod.category} · {prod.variants?.length ?? 0} varian
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            handleToggleAvailability(prod.id, prod.isAvailable)
                          }
                          disabled={isBusy}
                          style={[
                            styles.toggleBtn,
                            prod.isAvailable
                              ? styles.toggleBtnDisable
                              : styles.toggleBtnEnable,
                            isBusy && styles.toggleBtnDisabled,
                          ]}
                        >
                          {isBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={prod.isAvailable ? colors.danger : colors.primary}
                            />
                          ) : (
                            <Text
                              style={
                                prod.isAvailable
                                  ? styles.toggleTextDisable
                                  : styles.toggleTextEnable
                              }
                            >
                              {prod.isAvailable ? "Nonaktifkan" : "Aktifkan"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Ringkasan Penjualan & Keuangan Hari Ini */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Penjualan & Pengeluaran Hari Ini
                </Text>
                <Pressable onPress={refreshAll} style={styles.refreshBtn}>
                  <Text style={styles.refreshBtnText}>Perbarui</Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                Pemasukan otomatis dihitung dari order POS selesai
              </Text>

              <View
                style={[
                  styles.metricRow,
                  isWide ? styles.metricRowWide : styles.metricRowNarrow,
                ]}
              >
                {/* Total Sales */}
                <View style={[styles.metricCard, styles.incomeCard]}>
                  <Text style={styles.metricLabel}>Total Pemasukan (POS)</Text>
                  <Text style={styles.incomeVal}>
                    Rp {formatRupiah(data.sales.totalIncome)}
                  </Text>
                  <Text style={styles.metricMeta}>
                    {data.sales.transactionCount} transaksi selesai
                  </Text>
                </View>

                {/* Total Expenses */}
                <View style={[styles.metricCard, styles.expenseCard]}>
                  <Text style={styles.metricLabel}>Total Pengeluaran</Text>
                  <Text style={styles.expenseVal}>
                    Rp {formatRupiah(data.expenses.totalExpense)}
                  </Text>
                  <Text style={styles.metricMeta}>
                    {data.expenses.expenseCount} pengeluaran aktif
                  </Text>
                </View>

                {/* Net Balance */}
                <View style={[styles.metricCard, styles.netCard]}>
                  <Text style={styles.metricLabel}>Arus Kas Bersih</Text>
                  <Text style={styles.netVal}>
                    Rp {formatRupiah(data.netBalance)}
                  </Text>
                  <Text style={styles.metricMeta}>Pemasukan - Pengeluaran</Text>
                </View>
              </View>

              {/* Cash vs QRIS detail */}
              <View style={styles.paymentBox}>
                <View style={styles.paymentCol}>
                  <Text style={styles.paymentTitle}>Tunai (Cash)</Text>
                  <Text style={styles.paymentVal}>
                    Rp {formatRupiah(data.sales.cash.total)} ({data.sales.cash.count} trx)
                  </Text>
                </View>
                <View style={styles.vDivider} />
                <View style={styles.paymentCol}>
                  <Text style={styles.paymentTitle}>QRIS</Text>
                  <Text style={styles.paymentVal}>
                    Rp {formatRupiah(data.sales.qris.total)} ({data.sales.qris.count} trx)
                  </Text>
                  {data.sales.qris.pendingReconciliationCount > 0 ? (
                    <Text style={styles.pendingQRISAlert}>
                      {data.sales.qris.pendingReconciliationCount} transaksi tertunda
                      rekonsiliasi
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Ringkasan Stok & Peringatan Stok Menipis */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Persediaan & Stok Bahan</Text>
                <Pressable
                  onPress={() => router.push(ROUTES.inventory)}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>Buka Inventaris ›</Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                Total {data.stock.totalItems} jenis bahan aktif di outlet ini
              </Text>

              {data.stock.lowStockCount > 0 ? (
                <View style={styles.lowStockWarningBox}>
                  <Text style={styles.lowStockTitle}>
                    Peringatan: {data.stock.lowStockCount} bahan perlu pengisian
                    ulang!
                  </Text>
                  <View style={styles.lowStockList}>
                    {data.stock.lowStockItems.map((item) => (
                      <View key={item.id} style={styles.lowStockRow}>
                        <Text style={styles.lowStockItemName}>{item.name}</Text>
                        <Text style={styles.lowStockItemQty}>
                          Sisa: {item.quantity} {item.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.safeStockBox}>
                  <Text style={styles.safeStockText}>
                    Seluruh stok bahan dalam batas aman.
                  </Text>
                </View>
              )}
            </View>

            {/* Ringkasan Waste Hari Ini */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Catatan Waste Hari Ini</Text>
                <Pressable
                  onPress={() => router.push(ROUTES.waste)}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>Buka Waste ›</Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                Pencatatan bahan terbuang/basi hari ini
              </Text>

              <View style={styles.wasteSummaryRow}>
                <Text style={styles.wasteCountText}>
                  {data.waste.todayCount} Pencatatan Waste
                </Text>
                <Text style={styles.wasteQtyText}>
                  Total kuantitas: {data.waste.todayQuantity}
                </Text>
              </View>
            </View>

            {/* Ringkasan Aktivitas Terkini (Stream Aktivitas) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aktivitas Operasional Terkini</Text>
              <Text style={styles.cardSubtitle}>
                Log pesanan POS, pengeluaran, pergerakan stok, dan closing
              </Text>

              {data.activities.length === 0 ? (
                <Text style={styles.emptyActivityText}>
                  Belum ada aktivitas operasional tercatat.
                </Text>
              ) : (
                <View style={styles.activityList}>
                  {data.activities.map((act) => (
                    <View key={act.id} style={styles.activityRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle}>{act.title}</Text>
                        <Text style={styles.activitySubtitle}>
                          {act.subtitle} · {act.actor}
                        </Text>
                      </View>
                      <Text style={styles.activityTime}>
                        {formatTime(act.timestamp)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
      </FadeIn>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 220,
  },
  headerBtnCol: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickActionBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
  },
  actionBtnHighlight: {
    backgroundColor: colors.primary,
  },
  actionPressed: {
    opacity: 0.72,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  actionBtnTextHighlight: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chartTotal: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "right",
  },
  dashboardContent: {
    gap: spacing.md,
  },
  closingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerOpen: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
  },
  bannerClosed: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  bannerReopened: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.info,
  },
  closingBannerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  closingBannerStatus: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 2,
  },
  closingBannerMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bannerActionBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  refreshBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
  },
  linkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  metricRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metricRowWide: {
    flexDirection: "row",
  },
  metricRowNarrow: {
    flexDirection: "column",
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  netCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  incomeVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.success,
  },
  expenseVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.danger,
  },
  netVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  metricMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  paymentBox: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  paymentCol: {
    flex: 1,
    alignItems: "center",
  },
  vDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  paymentVal: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  pendingQRISAlert: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: "600",
    marginTop: 2,
  },
  lowStockWarningBox: {
    backgroundColor: colors.warningSurface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.sm,
  },
  lowStockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  lowStockList: {
    gap: 4,
  },
  lowStockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  lowStockItemName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  lowStockItemQty: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  safeStockBox: {
    backgroundColor: colors.successSurface,
    borderRadius: 6,
    padding: spacing.sm,
  },
  safeStockText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: "500",
  },
  wasteSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.sm,
  },
  wasteCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  wasteQtyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activityList: {
    gap: 6,
    marginTop: spacing.xs,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  activityTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  activitySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textDisabled,
  },
  emptyActivityText: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  filterRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.onPrimary,
  },
  productList: {
    gap: spacing.xs,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  productMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnEnable: {
    backgroundColor: colors.primary,
  },
  toggleBtnDisable: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  toggleBtnDisabled: {
    opacity: 0.6,
  },
  toggleTextEnable: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  toggleTextDisable: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "700",
  },
});
