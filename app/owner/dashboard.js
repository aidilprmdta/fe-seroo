import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Modal,
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
import { createDashboardApi } from "../../src/dashboard/api";
import { createOutletAccessApi } from "../../src/outlets/api";
import { colors, spacing } from "../../src/theme/tokens";

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  const num = Math.round(Number(value));
  return num.toLocaleString("id-ID");
}

function formatTime(isoString) {
  if (!isoString) return "-";
  const dt = new Date(isoString);
  return dt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OwnerDashboardScreen() {
  const { user, selection, apiRequest, notice: authNotice } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const outletId = selection.activeOutletId;
  const memberships = user?.memberships ?? [];

  const selectedOutlet = memberships.find(
    (membership) => membership.outletId === outletId,
  );
  const outletLabel = selectedOutlet?.outletName ?? "Outlet";

  const api = useMemo(
    () => createDashboardApi({ request: apiRequest }),
    [apiRequest],
  );

  const accessApi = useMemo(
    () => createOutletAccessApi({ request: apiRequest }),
    [apiRequest],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Staff members state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState(null);
  const [memberSuccess, setMemberSuccess] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("CREW");
  const [savingMember, setSavingMember] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard(outletId);
      setData(res);
    } catch (err) {
      setError(err.message || "Gagal memuat ringkasan outlet.");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  const loadMembers = useCallback(async () => {
    if (!outletId) return;
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const res = await accessApi.getMembers(outletId);
      setMembers(res.members || []);
    } catch (err) {
      setMemberError(err.message || "Gagal memuat daftar staf outlet.");
    } finally {
      setLoadingMembers(false);
    }
  }, [accessApi, outletId]);

  useEffect(() => {
    loadDashboard();
    loadMembers();
  }, [loadDashboard, loadMembers]);

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      setMemberError("Email staf wajib diisi.");
      return;
    }
    setSavingMember(true);
    setMemberError(null);
    try {
      await accessApi.assignMember(outletId, {
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });
      setShowAddMemberModal(false);
      setNewMemberEmail("");
      setMemberSuccess(`Berhasil menugaskan staf sebagai ${newMemberRole}.`);
      await loadMembers();
    } catch (err) {
      setMemberError(err.message || "Gagal menugaskan staf.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleRevokeMember = async (targetUserId, targetName) => {
    setMemberError(null);
    try {
      await accessApi.revokeMember(outletId, targetUserId);
      setMemberSuccess(`Akses staf ${targetName} berhasil dicabut.`);
      await loadMembers();
    } catch (err) {
      setMemberError(err.message || "Gagal mencabut akses staf.");
    }
  };

  const dailyStatus = data?.closingStatus?.daily?.status || "OPEN";
  const monthlyStatus = data?.closingStatus?.monthly?.status || "OPEN";

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>Seroo · Owner Mitra (Franchise Partner)</Text>
            <Text style={styles.title}>Dashboard Owner Mitra</Text>
            <Text style={styles.subtitle}>
              {user?.name} · {outletLabel} ({selectedOutlet?.outletCode})
            </Text>
          </View>
          <View style={styles.headerBtnCol}>
            {memberships.length > 1 ? (
              <PrimaryButton
                label="Pilih Outlet"
                secondary
                onPress={() => router.push(ROUTES.selectOutlet)}
              />
            ) : null}
            <ProfileButton />
            <LogoutButton />
          </View>
        </View>

        {/* Read-Only Restriction Badge & Brand Clarification */}
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyIcon}>ℹ️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.readOnlyTitle}>Wewenang Owner Mitra</Text>
            <Text style={styles.readOnlySubtitle}>
              Katalog menu dan harga jual dikelola secara sentral oleh Brand Owner / Admin Pusat. Owner Mitra memiliki wewenang penuh memantau laporan keuangan serta mengelola penugasan staf (Crew dan Manager) di {outletLabel}.
            </Text>
          </View>
        </View>

        {authNotice ? <Notice variant="info">{authNotice}</Notice> : null}
        {error ? <Notice variant="danger">{error}</Notice> : null}

        {/* Navigation to Read-Only Detail Screens */}
        <View style={styles.quickNavBox}>
          <Text style={styles.sectionHeading}>Laporan & Riwayat Outlet</Text>
          <View style={styles.actionGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.reports)}
              style={[styles.actionBtn, styles.actionBtnHighlight]}
            >
              <Text style={styles.actionBtnTextHighlight}>
                📊 Buka Laporan Lengkap
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.expenses)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>💸 Riwayat Pengeluaran</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.closings)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>🔒 Riwayat Closing & Audit</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat ringkasan outlet...</Text>
          </View>
        ) : data ? (
          <View style={styles.dashboardContent}>
            {/* Status Closing Resmi Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Status Closing Resmi</Text>
                <Pressable
                  onPress={() => router.push(ROUTES.closings)}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>Detail Closing ›</Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                Status penguncian buku laporan harian dan bulanan
              </Text>

              <View style={styles.closingStatusRow}>
                <View style={styles.closingStatusCol}>
                  <Text style={styles.closingLabel}>Closing Harian ({data.today})</Text>
                  <View
                    style={[
                      styles.badge,
                      dailyStatus === "CLOSED" && styles.badgeClosed,
                      dailyStatus === "REOPENED" && styles.badgeReopened,
                      dailyStatus === "OPEN" && styles.badgeOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        dailyStatus === "CLOSED" && styles.badgeTextClosed,
                        dailyStatus === "REOPENED" && styles.badgeTextReopened,
                        dailyStatus === "OPEN" && styles.badgeTextOpen,
                      ]}
                    >
                      {dailyStatus === "CLOSED"
                        ? `TUTUP (v${data.closingStatus.daily.version})`
                        : dailyStatus === "REOPENED"
                          ? "SEDANG DIREOPEN"
                          : "BELUM FINAL"}
                    </Text>
                  </View>
                </View>

                <View style={styles.vDivider} />

                <View style={styles.closingStatusCol}>
                  <Text style={styles.closingLabel}>
                    Closing Bulanan ({data.currentMonth})
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      monthlyStatus === "CLOSED" && styles.badgeClosed,
                      monthlyStatus === "REOPENED" && styles.badgeReopened,
                      monthlyStatus === "OPEN" && styles.badgeOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        monthlyStatus === "CLOSED" && styles.badgeTextClosed,
                        monthlyStatus === "REOPENED" && styles.badgeTextReopened,
                        monthlyStatus === "OPEN" && styles.badgeTextOpen,
                      ]}
                    >
                      {monthlyStatus === "CLOSED"
                        ? `TUTUP (v${data.closingStatus.monthly.version})`
                        : monthlyStatus === "REOPENED"
                          ? "SEDANG DIREOPEN"
                          : "BELUM FINAL"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Ringkasan Penjualan & Keuangan Hari Ini */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Ringkasan Keuangan Hari Ini
                </Text>
                <Pressable onPress={loadDashboard} style={styles.refreshBtn}>
                  <Text style={styles.refreshBtnText}>Perbarui</Text>
                </Pressable>
              </View>
              <Text style={styles.cardSubtitle}>
                Sumber: Transaksi POS selesai & pengeluaran diverifikasi
              </Text>

              <View
                style={[
                  styles.metricRow,
                  isWide ? styles.metricRowWide : styles.metricRowNarrow,
                ]}
              >
                <View style={[styles.metricCard, styles.incomeCard]}>
                  <Text style={styles.metricLabel}>Pemasukan POS Hari Ini</Text>
                  <Text style={styles.incomeVal}>
                    Rp {formatRupiah(data.sales.totalIncome)}
                  </Text>
                  <Text style={styles.metricMeta}>
                    {data.sales.transactionCount} transaksi selesai
                  </Text>
                </View>

                <View style={[styles.metricCard, styles.expenseCard]}>
                  <Text style={styles.metricLabel}>Pengeluaran Hari Ini</Text>
                  <Text style={styles.expenseVal}>
                    Rp {formatRupiah(data.expenses.totalExpense)}
                  </Text>
                  <Text style={styles.metricMeta}>
                    {data.expenses.expenseCount} pengeluaran tercatat
                  </Text>
                </View>

                <View style={[styles.metricCard, styles.netCard]}>
                  <Text style={styles.metricLabel}>Arus Kas Bersih</Text>
                  <Text style={styles.netVal}>
                    Rp {formatRupiah(data.netBalance)}
                  </Text>
                  <Text style={styles.metricMeta}>Pemasukan - Pengeluaran</Text>
                </View>
              </View>

              {/* Rincian Kas vs QRIS */}
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
                      ⚠️ {data.sales.qris.pendingReconciliationCount} tertunda rekonsiliasi
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Pemantauan Persediaan & Stok */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Pemantauan Persediaan</Text>
                <Text style={styles.readOnlyTag}>Read-Only</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Status ketersediaan {data.stock.totalItems} jenis bahan di outlet
              </Text>

              {data.stock.lowStockCount > 0 ? (
                <View style={styles.lowStockBox}>
                  <Text style={styles.lowStockHeading}>
                    ⚠️ Perhatian: {data.stock.lowStockCount} bahan berada di batas
                    kritis:
                  </Text>
                  {data.stock.lowStockItems.map((item) => (
                    <View key={item.id} style={styles.stockRow}>
                      <Text style={styles.stockItemName}>{item.name}</Text>
                      <Text style={styles.stockItemQty}>
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.safeStockBox}>
                  <Text style={styles.safeStockText}>
                    ✓ Semua stok persediaan dalam kondisi aman.
                  </Text>
                </View>
              )}
            </View>

            {/* Pemantauan Aktivitas Terkini */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Jejak Aktivitas Operasional</Text>
              <Text style={styles.cardSubtitle}>
                Log transaksi dan operasional terkini di outlet
              </Text>

              {data.activities.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada aktivitas.</Text>
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

            {/* Kelola Akses Staf Outlet (Crew & Manager) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Kelola Akses Staf Outlet</Text>
                  <Text style={styles.cardSubtitle}>
                    Owner Mitra berwenang mengatur penugasan Crew dan Manager di {outletLabel}.
                  </Text>
                </View>
                <Pressable
                  style={styles.addStaffBtn}
                  onPress={() => {
                    setMemberError(null);
                    setMemberSuccess(null);
                    setShowAddMemberModal(true);
                  }}
                >
                  <Text style={styles.addStaffBtnText}>+ Tambah Staf</Text>
                </Pressable>
              </View>

              {memberError ? <Notice variant="danger">{memberError}</Notice> : null}
              {memberSuccess ? <Notice variant="success">{memberSuccess}</Notice> : null}

              {loadingMembers ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.staffList}>
                  {members.map((m) => (
                    <View key={m.userId} style={styles.staffRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffName}>{m.name}</Text>
                        <Text style={styles.staffEmail}>{m.email}</Text>
                      </View>
                      <View style={styles.staffRoleCol}>
                        <Text
                          style={[
                            styles.roleBadge,
                            m.role === "MANAGER"
                              ? styles.roleBadgeManager
                              : styles.roleBadgeCrew,
                          ]}
                        >
                          {m.role}
                        </Text>
                        {m.role === "CREW" || m.role === "MANAGER" ? (
                          <Pressable
                            style={styles.revokeBtn}
                            onPress={() => handleRevokeMember(m.userId, m.name)}
                          >
                            <Text style={styles.revokeBtnText}>Cabut</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Modal Tambah Staf Outlet */}
        <Modal
          visible={showAddMemberModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddMemberModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Tambah Staf Outlet</Text>
              <Text style={styles.modalSubtitle}>
                Tugaskan Crew atau Manager untuk operasional di {outletLabel}.
              </Text>

              <Text style={styles.fieldLabel}>Email Akun Staf *</Text>
              <TextInput
                style={styles.input}
                placeholder="nama@seroo.id"
                autoCapitalize="none"
                keyboardType="email-address"
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
              />

              <Text style={styles.fieldLabel}>Pilih Peran (Role) *</Text>
              <View style={styles.roleSelectorRow}>
                <Pressable
                  style={[
                    styles.roleChoiceBtn,
                    newMemberRole === "CREW" && styles.roleChoiceActive,
                  ]}
                  onPress={() => setNewMemberRole("CREW")}
                >
                  <Text
                    style={[
                      styles.roleChoiceText,
                      newMemberRole === "CREW" && styles.roleChoiceTextActive,
                    ]}
                  >
                    CREW (Kasir)
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.roleChoiceBtn,
                    newMemberRole === "MANAGER" && styles.roleChoiceActive,
                  ]}
                  onPress={() => setNewMemberRole("MANAGER")}
                >
                  <Text
                    style={[
                      styles.roleChoiceText,
                      newMemberRole === "MANAGER" && styles.roleChoiceTextActive,
                    ]}
                  >
                    MANAGER (Operasional)
                  </Text>
                </Pressable>
              </View>

              <View style={styles.modalActionRow}>
                <PrimaryButton
                  label="Batal"
                  secondary
                  onPress={() => setShowAddMemberModal(false)}
                />
                <PrimaryButton
                  label={savingMember ? "Menyimpan..." : "Tugaskan Staf"}
                  disabled={savingMember}
                  onPress={handleAddMember}
                />
              </View>
            </View>
          </View>
        </Modal>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F4F8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2E0EB",
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  readOnlyIcon: {
    fontSize: 20,
  },
  readOnlyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2C4C64",
  },
  readOnlySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickNavBox: {
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
  dashboardContent: {
    gap: spacing.md,
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
  readOnlyTag: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
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
  closingStatusRow: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  closingStatusCol: {
    flex: 1,
    alignItems: "center",
  },
  closingLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeOpen: {
    backgroundColor: "#FDF5E8",
  },
  badgeClosed: {
    backgroundColor: "#EBF5EE",
  },
  badgeReopened: {
    backgroundColor: "#FFF9EB",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextOpen: {
    color: "#895900",
  },
  badgeTextClosed: {
    color: "#24603B",
  },
  badgeTextReopened: {
    color: "#9A6300",
  },
  vDivider: {
    width: 1,
    backgroundColor: colors.border,
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
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  incomeVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2F6B48",
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
    color: "#A24800",
    fontWeight: "600",
    marginTop: 2,
  },
  lowStockBox: {
    backgroundColor: "#FDF5E8",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#F4D9A8",
    padding: spacing.sm,
  },
  lowStockHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#895900",
    marginBottom: 6,
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  stockItemName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  stockItemQty: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  safeStockBox: {
    backgroundColor: "#EBF5EE",
    borderRadius: 6,
    padding: spacing.sm,
  },
  safeStockText: {
    fontSize: 12,
    color: "#24603B",
    fontWeight: "500",
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
  emptyText: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  addStaffBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addStaffBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  staffList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  staffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  staffName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  staffEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  staffRoleCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeManager: {
    backgroundColor: "#EFF6FF",
    color: "#1E40AF",
  },
  roleBadgeCrew: {
    backgroundColor: "#F3F4F6",
    color: "#374151",
  },
  revokeBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  revokeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalBox: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  roleSelectorRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roleChoiceBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  roleChoiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft || "#EFF6FF",
  },
  roleChoiceText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  roleChoiceTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
