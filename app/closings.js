import { useCallback, useEffect, useMemo, useState } from "react";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import Notice from "../src/components/Notice";
import ScreenFrame from "../src/components/ScreenFrame";
import { createClosingApi } from "../src/closings/api";
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

function formatDateTime(isoString) {
  if (!isoString) return "-";
  const dt = new Date(isoString);
  return dt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ClosingsScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const isManager = role === "MANAGER";

  const selectedOutlet = user?.memberships?.find(
    (membership) => membership.outletId === outletId,
  );
  const outletName = selectedOutlet?.outletName ?? "Outlet";

  const api = useMemo(() => createClosingApi({ request: apiRequest }), [apiRequest]);

  const [closingType, setClosingType] = useState("DAILY"); // "DAILY" | "MONTHLY"
  const [selectedDate, setSelectedDate] = useState(todayJakarta);
  const [selectedMonth, setSelectedMonth] = useState(thisMonthJakarta);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);

  // Form inputs
  const [notes, setNotes] = useState("");
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Cash Opening & Reconciliation inputs
  const [showOpeningForm, setShowOpeningForm] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [openingCashNotes, setOpeningCashNotes] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [actualCashInput, setActualCashInput] = useState("");
  const [differenceReason, setDifferenceReason] = useState("");

  const periodKey = closingType === "DAILY" ? selectedDate : selectedMonth;

  const loadPreview = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.getPreview(outletId, {
        type: closingType,
        periodKey,
      });
      setPreview(data);
      setShowReopenForm(false);
      setReopenReason("");
      setNotes("");
    } catch (err) {
      setError(err.message || "Gagal memuat pratinjau closing.");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, closingType, periodKey]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handlePrev = () => {
    if (closingType === "DAILY") {
      setSelectedDate((prev) => offsetDay(prev, -1));
    } else {
      setSelectedMonth((prev) => offsetMonth(prev, -1));
    }
  };

  const handleNext = () => {
    if (closingType === "DAILY") {
      setSelectedDate((prev) => offsetDay(prev, 1));
    } else {
      setSelectedMonth((prev) => offsetMonth(prev, 1));
    }
  };

  const handleTodayOrMonth = () => {
    if (closingType === "DAILY") {
      setSelectedDate(todayJakarta());
    } else {
      setSelectedMonth(thisMonthJakarta());
    }
  };

  const handleSaveCashOpening = async () => {
    if (!isManager) {
      Alert.alert("Akses Dibatasi", "Hanya Manager yang dapat mencatat kas awal.");
      return;
    }
    const num = Number(openingCashInput);
    if (openingCashInput === "" || isNaN(num) || num < 0) {
      Alert.alert("Input Tidak Valid", "Masukkan nominal kas awal yang valid (tidak boleh negatif).");
      return;
    }

    setSavingOpening(true);
    setError(null);
    try {
      await api.recordCashOpening(outletId, {
        periodKey,
        openingCash: num,
        notes: openingCashNotes.trim() || undefined,
      });
      setNotice("Saldo kas awal berhasil disimpan!");
      setShowOpeningForm(false);
      setOpeningCashInput("");
      setOpeningCashNotes("");
      await loadPreview();
    } catch (err) {
      setError(err.message || "Gagal menyimpan saldo kas awal.");
    } finally {
      setSavingOpening(false);
    }
  };

  const handleClosingSubmit = async () => {
    if (!isManager) {
      Alert.alert("Akses Dibatasi", "Hanya Manager yang dapat melakukan closing.");
      return;
    }

    if (preview?.unfinishedCount > 0 && !notes.trim()) {
      Alert.alert(
        "Keterangan Diperlukan",
        "Terdapat transaksi tertunda/belum selesai. Mohon masukkan catatan tindak lanjut sebelum closing.",
      );
      return;
    }

    let payload = {
      closingType,
      periodKey,
      notes: notes.trim() || undefined,
    };

    if (closingType === "DAILY" && actualCashInput.trim() !== "") {
      const numActual = Number(actualCashInput.trim());
      if (isNaN(numActual) || numActual < 0) {
        Alert.alert("Input Kas Fisik Tidak Valid", "Kas fisik tidak boleh bernilai negatif.");
        return;
      }
      const expected = Number(preview?.cashReconciliationPreview?.expectedCash || "0");
      const diff = numActual - expected;
      if (diff !== 0 && (!differenceReason || differenceReason.trim().length < 5)) {
        Alert.alert(
          "Alasan Selisih Kas Diperlukan",
          "Terdapat selisih kas fisik. Mohon masukkan alasan selisih kas (minimal 5 karakter).",
        );
        return;
      }
      payload.actualCash = numActual;
      if (diff !== 0) {
        payload.differenceReason = differenceReason.trim();
      }
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const clientTransactionId = Crypto.randomUUID();
      const res = await api.performClosing(outletId, {
        clientTransactionId,
        ...payload,
      });

      const isReclose = res?.data?.record?.version > 1;
      setNotice(
        isReclose
          ? `Closing ulang (Versi ${res?.data?.record?.version}) berhasil dicatat!`
          : `Closing ${closingType === "DAILY" ? "harian" : "bulanan"} berhasil disimpan!`,
      );
      setActualCashInput("");
      setDifferenceReason("");
      await loadPreview();
    } catch (err) {
      setError(err.message || "Gagal melakukan closing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenSubmit = async () => {
    if (!isManager) {
      Alert.alert("Akses Dibatasi", "Hanya Manager yang dapat melakukan Reopen.");
      return;
    }

    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      Alert.alert(
        "Alasan Wajib",
        "Mohon masukkan alasan Reopen secara lengkap (minimal 5 karakter).",
      );
      return;
    }

    const closingId = preview?.currentClosing?.id;
    if (!closingId) {
      Alert.alert("Error", "ID closing tidak ditemukan.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const clientTransactionId = Crypto.randomUUID();
      await api.reopenClosing(outletId, {
        clientTransactionId,
        closingId,
        reason: reopenReason.trim(),
      });

      setNotice(
        "Periode berhasil di-Reopen. Silakan lakukan pemeriksaan atau penyesuaian yang diperlukan, lalu lakukan closing ulang.",
      );
      setShowReopenForm(false);
      setReopenReason("");
      await loadPreview();
    } catch (err) {
      setError(err.message || "Gagal melakukan Reopen.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = preview?.currentClosing?.status || "OPEN";
  const currentVersion = preview?.currentClosing?.version || 1;

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
          <Text style={styles.title}>Closing & Reopen</Text>
          <Text style={styles.subtitle}>
            Pemeriksaan sebelum closing, penutupan periode, dan riwayat audit
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: closingType === "DAILY" }}
            onPress={() => setClosingType("DAILY")}
            style={[styles.tab, closingType === "DAILY" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                closingType === "DAILY" && styles.tabTextActive,
              ]}
            >
              Closing Harian
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: closingType === "MONTHLY" }}
            onPress={() => setClosingType("MONTHLY")}
            style={[styles.tab, closingType === "MONTHLY" && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                closingType === "MONTHLY" && styles.tabTextActive,
              ]}
            >
              Closing Bulanan
            </Text>
          </Pressable>
        </View>

        {/* Nav Controls */}
        <View style={styles.navRow}>
          <Pressable onPress={handlePrev} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹ Sebelumnya</Text>
          </Pressable>
          <View style={styles.periodCenter}>
            <Text style={styles.periodTitle}>
              {closingType === "DAILY"
                ? formatDisplayDate(selectedDate)
                : formatDisplayMonth(selectedMonth)}
            </Text>
            <Text style={styles.periodCode}>{periodKey} (WIB)</Text>
          </View>
          <Pressable onPress={handleNext} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Berikutnya ›</Text>
          </Pressable>
        </View>

        <View style={styles.quickNavRow}>
          <Pressable onPress={handleTodayOrMonth} style={styles.quickNavBtn}>
            <Text style={styles.quickNavBtnText}>
              {closingType === "DAILY" ? "Hari Ini" : "Bulan Ini"}
            </Text>
          </Pressable>
          <Pressable onPress={loadPreview} style={styles.quickNavBtn}>
            <Text style={styles.quickNavBtnText}>Segarkan</Text>
          </Pressable>
        </View>

        {error ? <Notice variant="danger">{error}</Notice> : null}
        {notice ? <Notice variant="info">{notice}</Notice> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat data pratinjau closing...</Text>
          </View>
        ) : preview ? (
          <View style={styles.content}>
            {/* Status Closing Saat Ini */}
            <View style={styles.card}>
              <View style={styles.statusHeader}>
                <Text style={styles.sectionTitle}>Status Closing Periode</Text>
                <View
                  style={[
                    styles.statusBadge,
                    currentStatus === "CLOSED" && styles.badgeClosed,
                    currentStatus === "REOPENED" && styles.badgeReopened,
                    currentStatus === "OPEN" && styles.badgeOpen,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      currentStatus === "CLOSED" && styles.badgeTextClosed,
                      currentStatus === "REOPENED" && styles.badgeTextReopened,
                      currentStatus === "OPEN" && styles.badgeTextOpen,
                    ]}
                  >
                    {currentStatus === "CLOSED"
                      ? `TELAH DITUTUP (VERSI ${currentVersion})`
                      : currentStatus === "REOPENED"
                        ? "STATUS: REOPENED (DIBUKA KEMBALI)"
                        : "BELUM CLOSING (BUKAN LAPORAN FINAL)"}
                  </Text>
                </View>
              </View>

              {preview.currentClosing ? (
                <View style={styles.currentClosingInfo}>
                  <Text style={styles.infoRowText}>
                    • Ditutup oleh:{" "}
                    <Text style={styles.boldText}>
                      {preview.currentClosing.closedBy?.name}
                    </Text>{" "}
                    pada {formatDateTime(preview.currentClosing.closedAt)}
                  </Text>
                  {preview.currentClosing.notes ? (
                    <Text style={styles.infoRowText}>
                      • Catatan closing: {preview.currentClosing.notes}
                    </Text>
                  ) : null}

                  {currentStatus === "REOPENED" ? (
                    <View style={styles.reopenCallout}>
                      <Text style={styles.reopenCalloutTitle}>
                        Informasi Reopen Aktif
                      </Text>
                      <Text style={styles.reopenCalloutText}>
                        Direopen oleh: {preview.currentClosing.reopenedBy?.name}{" "}
                        ({formatDateTime(preview.currentClosing.reopenedAt)})
                      </Text>
                      <Text style={styles.reopenCalloutReason}>
                        Alasan: "{preview.currentClosing.reopenReason}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.notClosedNotice}>
                  Periode ini belum pernah di-closing. Laporan belum berstatus final.
                </Text>
              )}
            </View>

            {/* Section Kas Awal (DAILY only) */}
            {closingType === "DAILY" ? (
              <View style={styles.card}>
                <View style={styles.statusHeader}>
                  <Text style={styles.sectionTitle}>Modal Kas Awal (Cash Opening)</Text>
                  {preview.cashReconciliationPreview?.cashOpeningRecorded ? (
                    <View style={[styles.statusBadge, styles.badgeClosed]}>
                      <Text style={[styles.statusBadgeText, styles.badgeTextClosed]}>
                        SUDAH DICATAT
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, styles.badgeOpen]}>
                      <Text style={[styles.statusBadgeText, styles.badgeTextOpen]}>
                        BELUM DICATAT
                      </Text>
                    </View>
                  )}
                </View>

                {preview.cashReconciliationPreview?.cashOpeningRecorded ? (
                  <View style={styles.openingRecordedBox}>
                    <Text style={styles.openingAmountText}>
                      Rp {formatRupiah(preview.cashReconciliationPreview.openingCash)}
                    </Text>
                    <Text style={styles.openingMetaText}>
                      Dicatat oleh: {preview.cashReconciliationPreview.openedBy?.name || "Manager"}
                      {preview.cashReconciliationPreview.openedAt
                        ? ` · ${formatDateTime(preview.cashReconciliationPreview.openedAt)}`
                        : ""}
                    </Text>
                    {isManager && currentStatus !== "CLOSED" && !showOpeningForm ? (
                      <Pressable
                        onPress={() => {
                          setOpeningCashInput(
                            String(Math.round(Number(preview.cashReconciliationPreview.openingCash))),
                          );
                          setShowOpeningForm(true);
                        }}
                        style={styles.editOpeningBtn}
                      >
                        <Text style={styles.editOpeningBtnText}>Ubah Saldo Kas Awal</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.openingEmptyBox}>
                    <Text style={styles.openingEmptyText}>
                      Modal kas awal belum dicatat untuk tanggal ini. Kasir/Manager disarankan menginput saldo awal sebelum shift berjalan.
                    </Text>
                    {isManager && currentStatus !== "CLOSED" && !showOpeningForm ? (
                      <Pressable
                        onPress={() => {
                          setOpeningCashInput("");
                          setShowOpeningForm(true);
                        }}
                        style={styles.addOpeningBtn}
                      >
                        <Text style={styles.addOpeningBtnText}>+ Input Kas Awal Sekarang</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}

                {showOpeningForm && isManager ? (
                  <View style={styles.openingFormCard}>
                    <Text style={styles.formLabel}>Nominal Kas Awal (Rp):</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={openingCashInput}
                      onChangeText={setOpeningCashInput}
                      placeholder="Contoh: 150000"
                      style={styles.input}
                      editable={!savingOpening}
                    />
                    <Text style={styles.formLabel}>Catatan (Opsional):</Text>
                    <TextInput
                      value={openingCashNotes}
                      onChangeText={setOpeningCashNotes}
                      placeholder="Contoh: Modal kembalian pecahan kecil"
                      style={styles.input}
                      editable={!savingOpening}
                    />
                    <View style={styles.formBtnRow}>
                      <Pressable
                        onPress={() => setShowOpeningForm(false)}
                        style={styles.cancelBtn}
                        disabled={savingOpening}
                      >
                        <Text style={styles.cancelBtnText}>Batal</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSaveCashOpening}
                        style={[styles.confirmReopenBtn, savingOpening && styles.btnDisabled]}
                        disabled={savingOpening}
                      >
                        <Text style={styles.confirmReopenBtnText}>
                          {savingOpening ? "Menyimpan..." : "Simpan Kas Awal"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Section 1: Ringkasan Sebelum Closing */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ringkasan Sebelum Closing</Text>
              <Text style={styles.sectionSubtitle}>
                Data otomatis dari transaksi POS selesai dan pengeluaran tercatat
              </Text>

              <View
                style={[
                  styles.metricRow,
                  isWide ? styles.metricRowWide : styles.metricRowNarrow,
                ]}
              >
                <View style={[styles.metricCard, styles.incomeCard]}>
                  <Text style={styles.metricLabel}>Pemasukan POS</Text>
                  <Text style={styles.incomeVal}>
                    Rp {formatRupiah(preview.reportSummary?.summary?.totalIncome)}
                  </Text>
                  <Text style={styles.metricSub}>
                    {preview.reportSummary?.summary?.transactionCount} transaksi
                  </Text>
                </View>

                <View style={[styles.metricCard, styles.expenseCard]}>
                  <Text style={styles.metricLabel}>Pengeluaran</Text>
                  <Text style={styles.expenseVal}>
                    Rp {formatRupiah(preview.reportSummary?.summary?.totalExpense)}
                  </Text>
                  <Text style={styles.metricSub}>
                    {preview.reportSummary?.summary?.expenseCount} catatan
                  </Text>
                </View>

                <View style={[styles.metricCard, styles.netCard]}>
                  <Text style={styles.metricLabel}>Arus Bersih</Text>
                  <Text style={styles.netVal}>
                    Rp {formatRupiah(preview.reportSummary?.summary?.netBalance)}
                  </Text>
                  <Text style={styles.metricSub}>Pemasukan - Pengeluaran</Text>
                </View>
              </View>

              {/* Rincian Metode Pembayaran */}
              <View style={styles.paymentBox}>
                <Text style={styles.paymentBoxTitle}>
                  Rincian Penerimaan Kas & QRIS
                </Text>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentRowLabel}>
                    Tunai (Cash): {preview.reportSummary?.paymentSummary?.cash?.count}{" "}
                    transaksi
                  </Text>
                  <Text style={styles.paymentRowVal}>
                    Rp{" "}
                    {formatRupiah(
                      preview.reportSummary?.paymentSummary?.cash?.total,
                    )}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentRowLabel}>
                    QRIS: {preview.reportSummary?.paymentSummary?.qris?.count}{" "}
                    transaksi
                  </Text>
                  <Text style={styles.paymentRowVal}>
                    Rp{" "}
                    {formatRupiah(
                      preview.reportSummary?.paymentSummary?.qris?.total,
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* Section 2: Pemeriksaan Transaksi Belum Selesai */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Pemeriksaan Transaksi Belum Selesai
              </Text>
              <Text style={styles.sectionSubtitle}>
                Daftar transaksi yang masih tertunda atau menunggu rekonsiliasi
              </Text>

              {preview.unfinishedCount === 0 ? (
                <View style={styles.cleanBox}>
                  <Text style={styles.cleanBoxText}>
                    ✓ Tidak ada transaksi tertunda. Semua pesanan selesai dan
                    terekonsiliasi.
                  </Text>
                </View>
              ) : (
                <View style={styles.warnBox}>
                  <Text style={styles.warnBoxTitle}>
                    Perhatian: Terdapat {preview.unfinishedCount} transaksi belum
                    selesai
                  </Text>
                  <Text style={styles.warnBoxSub}>
                    Sistem mendeteksi transaksi yang masih berstatus rekonsiliasi
                    tertunda (misal offline QRIS). Manager wajib menyertakan catatan
                    tindak lanjut bila closing diselesaikan sekarang.
                  </Text>

                  <View style={styles.unfinishedList}>
                    {preview.unfinishedTransactions.map((trx) => (
                      <View key={trx.id} style={styles.unfinishedItem}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.unfinishedOrder}>
                            {trx.orderNumber} ({trx.paymentMethod})
                          </Text>
                          <Text style={styles.unfinishedMeta}>
                            Crew: {trx.crewName} · {formatDateTime(trx.createdAt)}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", flex: 1.2 }}>
                          <Text style={styles.unfinishedAmount}>
                            Rp {formatRupiah(trx.total)}
                          </Text>
                          <Text style={styles.unreconciledBadge}>
                            Belum Rekonsiliasi
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Section 3: Aksi Closing & Reopen */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tindakan Closing & Reopen</Text>

              {currentStatus === "CLOSED" ? (
                <View style={styles.actionContainer}>
                  <Text style={styles.actionPrompt}>
                    Periode ini telah berstatus Closing. Untuk melakukan koreksi
                    atau perubahan transaksi, Anda wajib melakukan Reopen terlebih
                    dahulu dengan menyertakan alasan.
                  </Text>

                  {isManager ? (
                    !showReopenForm ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowReopenForm(true)}
                        style={styles.reopenButton}
                      >
                        <Text style={styles.reopenButtonText}>
                          Ajukan Reopen Periode Ini
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.reopenFormBox}>
                        <Text style={styles.formLabel}>
                          Alasan Wajib Reopen (minimal 5 karakter):
                        </Text>
                        <TextInput
                          accessibilityLabel="Alasan Reopen"
                          multiline
                          numberOfLines={3}
                          value={reopenReason}
                          onChangeText={setReopenReason}
                          placeholder="Contoh: Koreksi nota pengeluaran es batu dan verifikasi QRIS tertunda..."
                          style={styles.textArea}
                          editable={!submitting}
                        />

                        <View style={styles.formBtnRow}>
                          <Pressable
                            onPress={() => setShowReopenForm(false)}
                            style={styles.cancelBtn}
                          >
                            <Text style={styles.cancelBtnText}>Batal</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleReopenSubmit}
                            disabled={submitting}
                            style={[
                              styles.confirmReopenBtn,
                              submitting && styles.btnDisabled,
                            ]}
                          >
                            <Text style={styles.confirmReopenBtnText}>
                              {submitting ? "Memproses..." : "Konfirmasi Reopen"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )
                  ) : (
                    <Text style={styles.roleNotice}>
                      Hanya Manager yang dapat melakukan Reopen. Owner memiliki akses
                      baca riwayat.
                    </Text>
                  )}
                </View>
              ) : (
                /* OPEN or REOPENED */
                <View style={styles.actionContainer}>
                  {currentStatus === "REOPENED" ? (
                    <Text style={styles.actionPrompt}>
                      Periode ini sedang berstatus Reopen. Setelah koreksi data
                      selesai, lakukan Closing Ulang untuk membekukan hasil akhir
                      versi baru.
                    </Text>
                  ) : (
                    <Text style={styles.actionPrompt}>
                      Pastikan transaksi kas dan fisik telah sesuai. Closing akan
                      menyimpan snapshot laporan resmi untuk tanggal/bulan ini.
                    </Text>
                  )}

                  {isManager ? (
                    <View style={styles.formBox}>
                      {closingType === "DAILY" ? (
                        <View style={styles.reconciliationBox}>
                          <Text style={styles.reconciliationTitle}>
                            Rekonsiliasi Kas Fisik (Laci Kasir)
                          </Text>

                          <View style={styles.cashCalculationRow}>
                            <Text style={styles.cashCalcLabel}>Modal Kas Awal (+):</Text>
                            <Text style={styles.cashCalcVal}>
                              Rp {formatRupiah(preview.cashReconciliationPreview?.openingCash || 0)}
                            </Text>
                          </View>
                          <View style={styles.cashCalculationRow}>
                            <Text style={styles.cashCalcLabel}>Pemasukan Kas POS (+):</Text>
                            <Text style={styles.cashCalcVal}>
                              Rp {formatRupiah(preview.cashReconciliationPreview?.cashSales || 0)}
                            </Text>
                          </View>
                          <View style={styles.cashCalculationRow}>
                            <Text style={styles.cashCalcLabel}>Pengeluaran Kas (-):</Text>
                            <Text style={styles.cashCalcVal}>
                              Rp {formatRupiah(preview.cashReconciliationPreview?.cashExpenses || 0)}
                            </Text>
                          </View>
                          <View style={[styles.cashCalculationRow, styles.cashCalcTotalRow]}>
                            <Text style={styles.cashCalcTotalLabel}>Kas Diharapkan (Expected):</Text>
                            <Text style={styles.cashCalcTotalVal}>
                              Rp {formatRupiah(preview.cashReconciliationPreview?.expectedCash || 0)}
                            </Text>
                          </View>

                          <Text style={[styles.formLabel, { marginTop: 12 }]}>
                            Jumlah Uang Tunai Fisik di Laci (Rp):
                          </Text>
                          <TextInput
                            keyboardType="numeric"
                            accessibilityLabel="Kas Fisik Aktual"
                            value={actualCashInput}
                            onChangeText={setActualCashInput}
                            placeholder="Contoh: 185000"
                            style={styles.input}
                            editable={!submitting}
                          />

                          {actualCashInput.trim() !== "" ? (() => {
                            const expected = Number(preview.cashReconciliationPreview?.expectedCash || 0);
                            const actual = Number(actualCashInput.trim());
                            const diff = actual - expected;
                            return (
                              <View style={styles.diffContainer}>
                                {diff === 0 ? (
                                  <View style={[styles.diffBadge, styles.diffBadgeMatch]}>
                                    <Text style={styles.diffBadgeMatchText}>✓ Kas Fisik Sesuai (Selisih: Rp 0)</Text>
                                  </View>
                                ) : diff > 0 ? (
                                  <View style={[styles.diffBadge, styles.diffBadgeSurplus]}>
                                    <Text style={styles.diffBadgeSurplusText}>
                                      Kelebihan Kas: +Rp {formatRupiah(diff)}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={[styles.diffBadge, styles.diffBadgeShortage]}>
                                    <Text style={styles.diffBadgeShortageText}>
                                      ⚠️ Kekurangan Kas: -Rp {formatRupiah(Math.abs(diff))}
                                    </Text>
                                  </View>
                                )}

                                {diff !== 0 ? (
                                  <View style={{ marginTop: 8 }}>
                                    <Text style={[styles.formLabel, { color: colors.danger ?? "#b91c1c" }]}>
                                      Alasan Selisih Kas (Wajib diisi, min. 5 karakter):
                                    </Text>
                                    <TextInput
                                      accessibilityLabel="Alasan Selisih Kas"
                                      value={differenceReason}
                                      onChangeText={setDifferenceReason}
                                      placeholder="Jelaskan penyebab selisih kas fisik..."
                                      style={[styles.input, { borderColor: colors.danger ?? "#b91c1c" }]}
                                      editable={!submitting}
                                    />
                                  </View>
                                ) : null}
                              </View>
                            );
                          })() : null}
                        </View>
                      ) : null}

                      <Text style={styles.formLabel}>
                        Catatan Closing{" "}
                        {preview.unfinishedCount > 0
                          ? "(Wajib: Jelaskan Transaksi Tertunda)"
                          : "(Opsional)"}
                        :
                      </Text>
                      <TextInput
                        accessibilityLabel="Catatan Closing"
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={
                          preview.unfinishedCount > 0
                            ? "Tindak lanjut transaksi tertunda..."
                            : "Catatan operasional atau pemeriksaan fisik..."
                        }
                        style={styles.input}
                        editable={!submitting}
                      />

                      <Pressable
                        accessibilityRole="button"
                        onPress={handleClosingSubmit}
                        disabled={submitting}
                        style={[
                          styles.closeSubmitBtn,
                          submitting && styles.btnDisabled,
                        ]}
                      >
                        <Text style={styles.closeSubmitBtnText}>
                          {submitting
                            ? "Menyimpan Closing..."
                            : currentStatus === "REOPENED"
                              ? `Lakukan Closing Ulang (Versi ${currentVersion + 1})`
                              : `Lakukan Closing ${closingType === "DAILY" ? "Harian" : "Bulanan"}`}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.roleNotice}>
                      Hanya Manager yang dapat melakukan closing periode.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Section 4: Riwayat Closing & Audit Log */}
            {preview.currentClosing ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Riwayat Closing Sebelumnya & Audit Log
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Sistem menyimpan riwayat closing lama dan hasil closing ulang
                  tanpa menghapus data historis
                </Text>

                {/* History Versions */}
                <Text style={styles.subHeading}>Versi Closing Tercatat:</Text>
                {preview.currentClosing.history?.map((h) => (
                  <View key={h.id || h.version} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyVersion}>Versi {h.version}</Text>
                      <Text style={styles.historyDate}>
                        Ditutup: {formatDateTime(h.closedAt)}
                      </Text>
                    </View>
                    <Text style={styles.historySnapText}>
                      Omzet: Rp{" "}
                      {formatRupiah(h.summarySnapshot?.summary?.totalIncome)} ·
                      Pengeluaran: Rp{" "}
                      {formatRupiah(h.summarySnapshot?.summary?.totalExpense)} · Arus
                      Bersih: Rp{" "}
                      {formatRupiah(h.summarySnapshot?.summary?.netBalance)}
                    </Text>
                    {h.notes ? (
                      <Text style={styles.historyNotes}>Catatan: {h.notes}</Text>
                    ) : null}
                    {h.reopenReason ? (
                      <View style={styles.historyReopenBlock}>
                        <Text style={styles.historyReopenLabel}>
                          Direopen pada {formatDateTime(h.reopenedAt)}:
                        </Text>
                        <Text style={styles.historyReopenReason}>
                          "{h.reopenReason}"
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}

                {/* Audit Trail */}
                <Text style={[styles.subHeading, { marginTop: spacing.md }]}>
                  Jejak Audit Aktivitas (Audit Log):
                </Text>
                {preview.currentClosing.audits?.map((audit) => (
                  <View key={audit.id} style={styles.auditRow}>
                    <View style={styles.auditHeader}>
                      <Text style={styles.auditActionBadge}>
                        {audit.action} (v{audit.version})
                      </Text>
                      <Text style={styles.auditTime}>
                        {formatDateTime(audit.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.auditActor}>
                      Aktor: {audit.actor?.name || "Manager"}
                    </Text>
                    {audit.reason ? (
                      <Text style={styles.auditReason}>
                        Alasan/Ket: {audit.reason}
                      </Text>
                    ) : null}
                  </View>
                ))}
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
  subtitle: {
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
  navRow: {
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
  navBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  periodCenter: {
    alignItems: "center",
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  periodCode: {
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
  quickNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  quickNavBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
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
  content: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
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
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeOpen: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeClosed: {
    backgroundColor: "#E2F0E7",
  },
  badgeReopened: {
    backgroundColor: "#FDF0D5",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextOpen: {
    color: colors.textSecondary,
  },
  badgeTextClosed: {
    color: "#2F6B48",
  },
  badgeTextReopened: {
    color: "#9A6300",
  },
  currentClosingInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  infoRowText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  boldText: {
    fontWeight: "700",
  },
  reopenCallout: {
    backgroundColor: "#FFF9EB",
    borderWidth: 1,
    borderColor: "#F3DCAB",
    borderRadius: 6,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  reopenCalloutTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#845300",
  },
  reopenCalloutText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  reopenCalloutReason: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textPrimary,
    marginTop: 2,
  },
  notClosedNotice: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.xs,
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
  metricSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  paymentBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 4,
  },
  paymentBoxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentRowLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paymentRowVal: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  cleanBox: {
    backgroundColor: "#EBF5EE",
    borderRadius: 6,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  cleanBoxText: {
    fontSize: 13,
    color: "#24603B",
    fontWeight: "500",
  },
  warnBox: {
    backgroundColor: "#FDF5E8",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#F4D9A8",
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  warnBoxTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#895900",
  },
  warnBoxSub: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 4,
  },
  unfinishedList: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#EBD1A0",
    paddingTop: spacing.xs,
    gap: 6,
  },
  unfinishedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: spacing.xs,
    borderRadius: 4,
  },
  unfinishedOrder: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  unfinishedMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  unfinishedAmount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  unreconciledBadge: {
    fontSize: 10,
    color: "#A24800",
    fontWeight: "600",
  },
  actionContainer: {
    marginTop: spacing.xs,
  },
  actionPrompt: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  formBox: {
    gap: spacing.xs,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: "top",
  },
  closeSubmitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  closeSubmitBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  reopenButton: {
    backgroundColor: "#9A6300",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  reopenButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  reopenFormBox: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  formBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  cancelBtnText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  confirmReopenBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: "#9A6300",
  },
  confirmReopenBtnText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  roleNotice: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyVersion: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  historyDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  historySnapText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  historyReopenBlock: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyReopenLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9A6300",
  },
  historyReopenReason: {
    fontSize: 11,
    fontStyle: "italic",
    color: colors.textPrimary,
  },
  auditRow: {
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: 4,
    marginBottom: 4,
  },
  auditHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditActionBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  auditTime: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  auditActor: {
    fontSize: 11,
    color: colors.textPrimary,
  },
  auditReason: {
    fontSize: 11,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  openingRecordedBox: {
    padding: spacing.md,
    backgroundColor: "#f4f9f6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c2e0d1",
    gap: 4,
    marginTop: spacing.sm,
  },
  openingAmountText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
  },
  openingMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editOpeningBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  editOpeningBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  openingEmptyBox: {
    padding: spacing.md,
    backgroundColor: "#fffdf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f5e6b3",
    gap: 6,
    marginTop: spacing.sm,
  },
  openingEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addOpeningBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  addOpeningBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
  openingFormCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    gap: spacing.xs,
  },
  reconciliationBox: {
    padding: spacing.md,
    backgroundColor: "#fafafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: 6,
  },
  reconciliationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cashCalculationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cashCalcLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cashCalcVal: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  cashCalcTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginTop: 4,
  },
  cashCalcTotalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cashCalcTotalVal: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  diffContainer: {
    marginTop: 8,
  },
  diffBadge: {
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  diffBadgeMatch: {
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  diffBadgeMatchText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2e7d32",
  },
  diffBadgeSurplus: {
    backgroundColor: "#e3f2fd",
    borderWidth: 1,
    borderColor: "#90caf9",
  },
  diffBadgeSurplusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1565c0",
  },
  diffBadgeShortage: {
    backgroundColor: "#ffebee",
    borderWidth: 1,
    borderColor: "#ef9a9a",
  },
  diffBadgeShortageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c62828",
  },
});

