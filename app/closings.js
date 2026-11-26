// ClosingsScreen — closing & cash reconciliation
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/auth/AuthContext';
import { createClosingsApi } from '../src/api/closings';
import { createApiRequestWrapper } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import ListItem from '../src/components/ListItem';
import Input from '../src/components/Input';
import BaseButton from '../src/components/BaseButton';
import Badge from '../src/components/Badge';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import AppShell from '../src/components/AppShell';
import Notice from '../src/components/Notice';
import Modal from '../src/components/Modal';
import { posOutbox } from '../src/pos/nativeOutbox';

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Native date formatting (no external deps)
function formatDate(isoString, formatStr = 'yyyy-MM-dd HH:mm') {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (formatStr.includes('yyyy')) formatStr = formatStr.replace('yyyy', year);
  if (formatStr.includes('MM')) formatStr = formatStr.replace('MM', month);
  if (formatStr.includes('dd')) formatStr = formatStr.replace('dd', day);
  if (formatStr.includes('HH')) formatStr = formatStr.replace('HH', hours);
  if (formatStr.includes('mm')) formatStr = formatStr.replace('mm', minutes);
  return formatStr;
}

function formatDisplayDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}


function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function ClosingsScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection.activeOutletId;
  const activeRole = user?.memberships?.find((m) => m.outletId === outletId)?.role || selection.activeRole;
  const isOwner = activeRole === 'OWNER_MITRA' || activeRole === 'OWNER';
  const canPerformClosing = activeRole === 'MANAGER';
  const navRole = isOwner ? 'ownerMitra' : 'manager';
  const roleLabel = activeRole || 'MANAGER';

  const [closings, setClosings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState('cash'); // cash | actual
  const [periodKey, setPeriodKey] = useState('');
  const [openData, setOpenData] = useState({ openingCash: '' });
  const [actualCash, setActualCash] = useState('');
  const [differenceReason, setDifferenceReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [outboxSummary, setOutboxSummary] = useState({
    waitingSyncCount: 0,
    needsReviewCount: 0,
    totalUnresolved: 0,
  });

  const checkPendingOutbox = useCallback(async () => {
    if (!outletId) return;
    try {
      const records = await posOutbox.listRecent({ ownerUserId: user?.id, outletId });
      const waitingSync = records.filter((r) =>
        ['queued', 'syncing', 'retryable_failure'].includes(r.status),
      );
      const needsReview = records.filter((r) => r.status === 'needs_review');
      setOutboxSummary({
        waitingSyncCount: waitingSync.length,
        needsReviewCount: needsReview.length,
        totalUnresolved: waitingSync.length + needsReview.length,
      });
    } catch {
      // Abaikan jika database outbox belum siap
    }
  }, [outletId, user?.id]);

  const loadClosings = useCallback(async () => {
    try {
      const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await closingsApi.listClosings(outletId);
      setClosings(data.data?.closings || []);
      await checkPendingOutbox();
    } catch (err) {
      setError(err?.message || 'Daftar closing gagal dimuat.');
    } finally {
      setRefreshing(false);
    }
  }, [outletId, checkPendingOutbox]);

  useEffect(() => {
    loadClosings();
  }, [loadClosings]);

  const handleOpenCash = useCallback(async () => {
    try {
      const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
      await closingsApi.createCashOpening(outletId, {
        periodKey,
        openingCash: Number(openData.openingCash),
      });
      setPeriodKey('');
      setOpenData({ openingCash: '' });
      loadClosings();
    } catch (err) {
      setError(err?.message || 'Kas awal gagal disimpan.');
    }
  }, [outletId, periodKey, openData.openingCash, loadClosings]);

  const handleReconcile = useCallback(async () => {
    try {
      const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
      await closingsApi.createClosing(outletId, {
        closingType: 'DAILY',
        periodKey,
        actualCash: Number(actualCash),
        differenceReason,
      });
      setActualCash('');
      setDifferenceReason('');
      loadClosings();
    } catch (err) {
      setError(err?.message || 'Closing gagal disimpan.');
    }
  }, [outletId, periodKey, actualCash, differenceReason, loadClosings]);

  const openReopen = useCallback((closing) => {
    setReopenTarget(closing);
    setReopenReason('');
    setError(null);
  }, []);

  const [cashReviewTarget, setCashReviewTarget] = useState(null);
  const [cashReviewNote, setCashReviewNote] = useState('');
  const [savingCashReview, setSavingCashReview] = useState(false);

  const handleCashReview = useCallback(
    async (status) => {
      if (!cashReviewTarget) return;
      setError(null);
      setSavingCashReview(true);
      try {
        const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
        await closingsApi.updateCashDifference(outletId, cashReviewTarget.id, {
          status,
          note: cashReviewNote.trim() || undefined,
        });
        Alert.alert('Berhasil', 'Status investigasi selisih kas diperbarui.');
        setCashReviewTarget(null);
        setCashReviewNote('');
        loadClosings();
      } catch (err) {
        setError(err?.message || 'Status selisih kas gagal diperbarui.');
      } finally {
        setSavingCashReview(false);
      }
    },
    [cashReviewTarget, cashReviewNote, outletId, loadClosings],
  );

  const CASH_STATUS_LABEL = {
    BELUM_DIPERIKSA: 'Belum diperiksa',
    SEDANG_DIPERIKSA: 'Sedang diperiksa',
    SUDAH_DIKETAHUI: 'Sudah diketahui',
    BELUM_TERSELESAIKAN: 'Belum terselesaikan',
  };

  const handleReopen = useCallback(async () => {
    setError(null);
    if (reopenReason.trim().length < 5) {
      setError('Alasan reopen minimal 5 karakter.');
      return;
    }
    setReopening(true);
    try {
      const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
      await closingsApi.reopenClosing(outletId, reopenTarget.id, {
        clientTransactionId: uuidv4(),
        closingId: reopenTarget.id,
        reason: reopenReason.trim(),
      });
      Alert.alert('Berhasil', 'Closing berhasil dibuka kembali.');
      setReopenTarget(null);
      loadClosings();
    } catch (err) {
      setError(err?.message || 'Reopen closing gagal.');
    } finally {
      setReopening(false);
    }
  }, [reopenReason, reopenTarget, outletId, loadClosings]);

  const loadPreview = useCallback(async () => {
    setError(null);
    if (!periodKey.trim()) {
      setError('Isi periode (YYYY-MM-DD) terlebih dahulu.');
      return;
    }
    setPreviewLoading(true);
    try {
      const closingsApi = createClosingsApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await closingsApi.getClosingPreview(outletId, {
        type: 'DAILY',
        periodKey: periodKey.trim(),
      });
      setPreview(data?.data || null);
    } catch (err) {
      setError(err?.message || 'Preview closing gagal dimuat.');
    } finally {
      setPreviewLoading(false);
    }
  }, [periodKey, outletId]);

  return (
    <AppShell
      navRole={navRole}
      active="closing"
      title="Closing harian dan bulanan"
      subtitle={isOwner ? "Memantau riwayat closing dan rekap selisih kas outlet." : "Periksa selisih kas sebelum periode ditutup."}
      roleLabel={roleLabel}
      outletLabel={selection.activeOutletId || 'Outlet'}
      scopeLabel={selection.activeOutletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadClosings} />}
      >
        {error && <Notice message={error} type="error" />}

        {outboxSummary.totalUnresolved > 0 && (
          <Notice
            type="warning"
            message={
              outboxSummary.waitingSyncCount > 0 && outboxSummary.needsReviewCount > 0
                ? `Perhatian: Terdapat ${outboxSummary.waitingSyncCount} pesanan menunggu sinkronisasi dan ${outboxSummary.needsReviewCount} pesanan memerlukan peninjauan di antrean lokal. Rekap kas server belum mencakup transaksi tersebut. Pastikan kasir menyinkronkan atau meninjau transaksi sebelum closing.`
                : outboxSummary.waitingSyncCount > 0
                  ? `Perhatian: Terdapat ${outboxSummary.waitingSyncCount} pesanan di antrean lokal yang belum disinkronkan ke server. Rekap kas server belum mencakup transaksi ini.`
                  : `Perhatian: Terdapat ${outboxSummary.needsReviewCount} pesanan di antrean lokal berstatus perlu peninjauan (needs_review). Transaksi belum tercatat di server namun uang fisik kasir mungkin sudah diterima.`
            }
          />
        )}

        {/* Mode selector */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'cash' && styles.modeBtnActive]}
            onPress={() => setMode('cash')}
          >
            <Text style={[styles.modeText, mode === 'cash' && styles.modeTextActive]}>
              🎯 Pembukaan Kas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'actual' && styles.modeBtnActive]}
            onPress={() => setMode('actual')}
          >
            <Text style={[styles.modeText, mode === 'actual' && styles.modeTextActive]}>
              💰 Rekonsiliasi Kas
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Preview Closing</Text>
          <BaseButton
            label="Muat Preview"
            onPress={loadPreview}
            loading={previewLoading}
            fullWidth
            size="md"
            variant="secondary"
          />
          {preview && (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>
                Periode: {preview.periodKey} ({preview.closingType})
              </Text>
              <Text style={styles.previewText}>
                Total pendapatan: Rp {formatRupiah(preview.reportSummary?.summary?.totalIncome)}
              </Text>
              <Text style={styles.previewText}>
                Total pengeluaran: Rp {formatRupiah(preview.reportSummary?.summary?.totalExpense)}
              </Text>
              <Text style={styles.previewText}>
                Saldo bersih: Rp {formatRupiah(preview.reportSummary?.summary?.netBalance)}
              </Text>
              <Text style={styles.previewText}>
                Transaksi selesai: {preview.reportSummary?.summary?.transactionCount ?? 0}
              </Text>
              <Text style={styles.previewText}>
                Transaksi belum selesai: {preview.unfinishedCount ?? 0}
              </Text>
              {preview.cashReconciliationPreview && (
                <Text style={styles.previewText}>
                  Kas diharapkan: Rp {formatRupiah(preview.cashReconciliationPreview.expectedCash)}
                </Text>
              )}
            </View>
          )}
        </Card>

        {mode === 'cash' ? (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Modal Awal (Cash Opening)</Text>
            <Input
              label="Periode (YYYY-MM-DD)"
              value={periodKey}
              onChangeText={setPeriodKey}
              placeholder="2026-11-17"
            />
            <Input
              label="Uang Muka (Rp)"
              value={openData.openingCash}
              onChangeText={(v) => setOpenData({ ...openData, openingCash: v })}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <BaseButton
              label="Simpan Modal Awal"
              onPress={handleOpenCash}
              fullWidth
              size="lg"
              variant="primary"
            />
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Rekonsiliasi Kas Harian</Text>
            <Input
              label="Periode (YYYY-MM-DD)"
              value={periodKey}
              onChangeText={setPeriodKey}
              placeholder="2026-11-17"
            />
            <Input
              label="Kas Fisik (Rp)"
              value={actualCash}
              onChangeText={setActualCash}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <Input
              label="Alasan Selisih"
              value={differenceReason}
              onChangeText={setDifferenceReason}
              placeholder="Alasan jika ada selisih"
            />
            <BaseButton
              label="Simpan Rekonsiliasi"
              onPress={handleReconcile}
              fullWidth
              size="lg"
              variant="primary"
            />
          </Card>
        )}

        <Text style={styles.sectionTitle}>Riwayat Closing</Text>
        {closings.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📊</Text>}
            title="Belum ada closing"
            subtitle="Closing akan muncul di sini setelah diselesaikan."
          />
        ) : (
          closings.map(c => (
            <ListItem
              key={c.id}
              title={`Closing ${c.closingType || c.type || ''} ${c.periodKey}`}
              subtitle={`Status: ${c.status} · ${formatDisplayDate(c.closedAt || c.createdAt)}${
                c.cashDifference ? ` · Selisih kas: Rp ${formatRupiah(c.cashDifference)} (${CASH_STATUS_LABEL[c.cashDifferenceStatus] || c.cashDifferenceStatus})` : ''
              }`}
              right={
                <View style={styles.closingRight}>
                  <Badge
                    label={c.status === 'CLOSED' ? 'Selesai' : 'Dibuka'}
                    variant={c.status === 'CLOSED' ? 'success' : 'info'}
                  />
                  {canPerformClosing && c.cashDifference && (
                    <TouchableOpacity
                      style={styles.reopenBtn}
                      onPress={() => {
                        setCashReviewTarget(c);
                        setCashReviewNote('');
                        setError(null);
                      }}
                    >
                      <Text style={styles.reopenText}>Periksa selisih</Text>
                    </TouchableOpacity>
                  )}
                  {canPerformClosing && c.status === 'CLOSED' && (
                    <TouchableOpacity style={styles.reopenBtn} onPress={() => openReopen(c)}>
                      <Text style={styles.reopenText}>Reopen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title="Reopen Closing"
        subtitle={`Periode ${reopenTarget?.periodKey || ''}`}
        footer={
          <BaseButton
            label="Buka Kembali"
            onPress={handleReopen}
            loading={reopening}
            fullWidth
            size="lg"
            variant="danger"
          />
        }
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}

        {outboxSummary.totalUnresolved > 0 && (
          <Notice
            type="warning"
            message={
              outboxSummary.waitingSyncCount > 0 && outboxSummary.needsReviewCount > 0
                ? `Perhatian: Terdapat ${outboxSummary.waitingSyncCount} pesanan menunggu sinkronisasi dan ${outboxSummary.needsReviewCount} pesanan memerlukan peninjauan di antrean lokal. Rekap kas server belum mencakup transaksi tersebut. Pastikan kasir menyinkronkan atau meninjau transaksi sebelum closing.`
                : outboxSummary.waitingSyncCount > 0
                  ? `Perhatian: Terdapat ${outboxSummary.waitingSyncCount} pesanan di antrean lokal yang belum disinkronkan ke server. Rekap kas server belum mencakup transaksi ini.`
                  : `Perhatian: Terdapat ${outboxSummary.needsReviewCount} pesanan di antrean lokal berstatus perlu peninjauan (needs_review). Transaksi belum tercatat di server namun uang fisik kasir mungkin sudah diterima.`
            }
          />
        )}
          <Input
            label="Alasan reopen"
            value={reopenReason}
            onChangeText={setReopenReason}
            placeholder="Minimal 5 karakter"
          />
        </View>
      </Modal>

      <Modal
        visible={!!cashReviewTarget}
        onClose={() => setCashReviewTarget(null)}
        title="Investigasi Selisih Kas"
        subtitle={`Periode ${cashReviewTarget?.periodKey || ''} · Selisih Rp ${formatRupiah(cashReviewTarget?.cashDifference || 0)}`}
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Input
            label="Catatan investigasi"
            value={cashReviewNote}
            onChangeText={setCashReviewNote}
            placeholder="Hasil pemeriksaan selisih (opsional)"
          />
          <View style={styles.cashActionRow}>
            {['SEDANG_DIPERIKSA', 'SUDAH_DIKETAHUI', 'BELUM_TERSELESAIKAN'].map((status) => (
              <BaseButton
                key={status}
                label={CASH_STATUS_LABEL[status]}
                onPress={() => handleCashReview(status)}
                loading={savingCashReview}
                disabled={savingCashReview}
                variant={status === 'SUDAH_DIKETAHUI' ? 'primary' : 'secondary'}
                size="sm"
              />
            ))}
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cashActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  modeBtnActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  modeText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  modeTextActive: {
    color: colors.light.onPrimary,
  },
  formCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  closingRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  reopenBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.light.dangerSurface,
  },
  reopenText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.danger,
  },
  modalContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  previewBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    gap: spacing.xs,
  },
  previewText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
});
