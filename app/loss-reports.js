import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { createApiClient } from '../src/api/api';
import { createLossReportsApi } from '../src/api/loss-reports';
import { createInventoryApi } from '../src/api/inventory';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import BaseButton from '../src/components/BaseButton';
import Input from '../src/components/Input';
import Notice from '../src/components/Notice';
import Badge from '../src/components/Badge';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';

export default function LossReportsScreen() {
  const router = useRouter();
  const { user, selection } = useAuth();
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const isManager = role === 'MANAGER' || role === 'OWNER' || role === 'OWNER_MITRA';

  // Data states
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ PENDING: 0, CONFIRMED: 0, REJECTED: 0 });
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Form states (Crew)
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Review states (Manager)
  const [reviewModalReport, setReviewModalReport] = useState(null);
  const [reviewAction, setReviewAction] = useState(null); // 'CONFIRMED' | 'REJECTED'
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Global notice / error
  const [globalError, setGlobalError] = useState(null);

  const getApi = useCallback(() => {
    const client = createApiClient();
    return createLossReportsApi({ request: client });
  }, []);

  const getInventoryApi = useCallback(() => {
    const client = createApiClient();
    return createInventoryApi({ request: client });
  }, []);

  const loadData = useCallback(async () => {
    if (!outletId) return;
    try {
      setGlobalError(null);
      const api = getApi();
      const params = filterStatus !== 'ALL' ? { status: filterStatus } : {};
      const res = await api.listLossReports(outletId, params);
      const list = res?.data || [];
      setReports(list);
      if (res?.meta?.summary) {
        setSummary(res.meta.summary);
      } else {
        const s = { PENDING: 0, CONFIRMED: 0, REJECTED: 0 };
        list.forEach((r) => {
          if (s[r.status] !== undefined) s[r.status]++;
        });
        setSummary(s);
      }

      // Load stock items if not loaded
      if (stocks.length === 0) {
        const invApi = getInventoryApi();
        const stockRes = await invApi.getStock(outletId, { page: 1, pageSize: 100 });
        const items = stockRes?.data?.stocks || [];
        setStocks(items);
        if (items.length > 0 && !selectedItemId) {
          setSelectedItemId(items[0]?.inventoryItemId || items[0]?.id || '');
        }
      }
    } catch (err) {
      setGlobalError(err?.message || 'Gagal memuat data laporan kehilangan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, filterStatus, getApi, getInventoryApi, stocks.length, selectedItemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCreateReport = useCallback(async () => {
    setFormError(null);
    setFormSuccess(null);

    if (!selectedItemId) {
      setFormError('Pilih item inventaris yang hilang.');
      return;
    }
    const numQty = Number(quantity);
    if (!quantity.trim() || isNaN(numQty) || numQty <= 0) {
      setFormError('Jumlah kehilangan harus angka lebih dari 0.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Alasan kehilangan wajib diisi.');
      return;
    }

    setSubmittingForm(true);
    try {
      const api = getApi();
      await api.createLossReport(outletId, {
        inventoryItemId: selectedItemId,
        quantity: quantity.trim(),
        reason: reason.trim(),
        description: description.trim() || undefined,
      });

      setFormSuccess('Laporan kehilangan berhasil dibuat dengan status PENDING.');
      setQuantity('');
      setReason('');
      setDescription('');
      loadData();
    } catch (err) {
      setFormError(err?.message || 'Gagal mengirim laporan kehilangan.');
    } finally {
      setSubmittingForm(false);
    }
  }, [selectedItemId, quantity, reason, description, outletId, getApi, loadData]);

  const handleOpenReview = useCallback((report, action) => {
    setReviewModalReport(report);
    setReviewAction(action);
    setReviewNote('');
    setReviewError(null);
  }, []);

  const handleCancelReview = useCallback(() => {
    if (submittingReview) return;
    setReviewModalReport(null);
    setReviewAction(null);
    setReviewNote('');
    setReviewError(null);
  }, [submittingReview]);

  const handleProcessReview = useCallback(async () => {
    if (!reviewModalReport || !reviewAction || submittingReview) return;
    setReviewError(null);

    if (reviewAction === 'REJECTED' && !reviewNote.trim()) {
      setReviewError('Catatan penolakan wajib diisi untuk menjelaskan alasan penolakan.');
      return;
    }

    setSubmittingReview(true);

    try {
      const api = getApi();
      await api.reviewLossReport(outletId, reviewModalReport.id, {
        status: reviewAction,
        reviewNote: reviewNote.trim() || undefined,
      });

      setReviewModalReport(null);
      setReviewAction(null);
      setReviewNote('');
      loadData();
    } catch (err) {
      setReviewError(err?.message || 'Gagal memproses review laporan.');
    } finally {
      setSubmittingReview(false);
    }
  }, [reviewModalReport, reviewAction, submittingReview, reviewNote, outletId, getApi, loadData]);

  const selectedStockItem = useMemo(() => {
    return stocks.find((s) => (s.inventoryItemId || s.id) === selectedItemId);
  }, [stocks, selectedItemId]);

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'PENDING':
      default:
        return 'warning';
    }
  };

  const getStatusBadgeLabel = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'DIKONFIRMASI';
      case 'REJECTED':
        return 'DITOLAK';
      case 'PENDING':
      default:
        return 'MENUNGGU REVIEW';
    }
  };

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Laporan Kehilangan</Text>
          <Text style={styles.subtitle}>
            {isManager
              ? 'Pemeriksaan & Persetujuan Kehilangan Barang Outlet'
              : 'Pencatatan Kehilangan Bahan / Barang untuk Diperiksa Manager'}
          </Text>
        </View>

        {globalError ? <Notice variant="danger">{globalError}</Notice> : null}

        {/* Manager Summary Cards */}
        {isManager ? (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryPending]}>
              <Text style={styles.summaryNumber}>{summary.PENDING || 0}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryConfirmed]}>
              <Text style={styles.summaryNumber}>{summary.CONFIRMED || 0}</Text>
              <Text style={styles.summaryLabel}>Dikonfirmasi</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryRejected]}>
              <Text style={styles.summaryNumber}>{summary.REJECTED || 0}</Text>
              <Text style={styles.summaryLabel}>Ditolak</Text>
            </View>
          </View>
        ) : null}

        {/* Crew: Form Input Laporan Kehilangan */}
        {!isManager ? (
          <Card style={styles.formCard}>
            <Text style={styles.cardTitle}>Buat Laporan Kehilangan</Text>
            <Text style={styles.cardSubtitle}>
              Stok tidak akan berkurang sampai laporan ini disetujui oleh Manager.
            </Text>

            {formSuccess ? <Notice variant="success">{formSuccess}</Notice> : null}
            {formError ? <Notice variant="danger">{formError}</Notice> : null}

            {/* Item selector */}
            <Text style={styles.inputLabel}>Pilih Item Inventaris *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemPills}>
              {stocks.map((item) => {
                const id = item.inventoryItemId || item.id;
                const name = item.inventoryItem?.name || item.name || 'Item';
                const unit = item.inventoryItem?.unit || item.unit || '';
                const isSelected = selectedItemId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setSelectedItemId(id)}
                    style={[styles.itemPill, isSelected && styles.itemPillActive]}
                  >
                    <Text style={[styles.itemPillText, isSelected && styles.itemPillTextActive]}>
                      {name} {unit ? `(${unit})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedStockItem ? (
              <Text style={styles.selectedItemNote}>
                Item terpilih: {selectedStockItem.inventoryItem?.name || selectedStockItem.name} · Satuan:{' '}
                {selectedStockItem.inventoryItem?.unit || selectedStockItem.unit || '-'}
              </Text>
            ) : null}

            <Input
              label="Jumlah Kehilangan *"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Contoh: 2 atau 0.5"
              keyboardType="decimal-pad"
            />

            <Input
              label="Alasan Kehilangan *"
              value={reason}
              onChangeText={setReason}
              placeholder="Contoh: Tumpah saat pembuatan / Rusak kemasan"
            />

            <Input
              label="Keterangan Tambahan (Opsional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Detail kronologi atau catatan lain"
              multiline
              numberOfLines={3}
            />

            <BaseButton
              label={submittingForm ? 'Mengirim...' : 'Kirim Laporan Kehilangan'}
              onPress={handleCreateReport}
              disabled={submittingForm}
              variant="primary"
              style={styles.submitBtn}
            />
          </Card>
        ) : null}

        {/* Manager Review Modal Dialog */}
        {reviewModalReport ? (
          <Card style={styles.reviewModalCard}>
            <Text style={styles.modalTitle}>
              {reviewAction === 'CONFIRMED'
                ? '⚠️ Konfirmasi Laporan Kehilangan'
                : '❌ Tolak Laporan Kehilangan'}
            </Text>
            <Text style={styles.modalDescription}>
              {reviewAction === 'CONFIRMED'
                ? `Mengonfirmasi laporan ini akan MEMOTONG stok ${reviewModalReport.itemName} sebanyak ${reviewModalReport.quantity} ${reviewModalReport.unit} secara otomatis.`
                : `Menolak laporan ini TIDAK AKAN mengubah stok inventaris.`}
            </Text>

            <View style={styles.reportDetailBox}>
              <Text style={styles.reportDetailText}>
                <Text style={styles.bold}>Item:</Text> {reviewModalReport.itemName}
              </Text>
              <Text style={styles.reportDetailText}>
                <Text style={styles.bold}>Jumlah:</Text> {reviewModalReport.quantity}{' '}
                {reviewModalReport.unit}
              </Text>
              <Text style={styles.reportDetailText}>
                <Text style={styles.bold}>Pelapor:</Text>{' '}
                {reviewModalReport.reportedBy?.name || 'Crew'}
              </Text>
              <Text style={styles.reportDetailText}>
                <Text style={styles.bold}>Alasan:</Text> {reviewModalReport.reason}
              </Text>
            </View>

            {reviewError ? <Notice variant="danger">{reviewError}</Notice> : null}

            <Text style={styles.inputLabel}>
              Catatan Review {reviewAction === 'REJECTED' ? '(Wajib Diisi) *' : '(Opsional)'}:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="Tulis alasan konfirmasi atau penolakan..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtnRow}>
              <BaseButton
                label="Batal"
                onPress={handleCancelReview}
                disabled={submittingReview}
                variant="secondary"
                style={styles.modalHalfBtn}
              />
              <BaseButton
                label={
                  submittingReview
                    ? 'Memproses...'
                    : reviewAction === 'CONFIRMED'
                    ? 'Ya, Konfirmasi'
                    : 'Ya, Tolak'
                }
                onPress={handleProcessReview}
                disabled={submittingReview}
                variant={reviewAction === 'CONFIRMED' ? 'success' : 'danger'}
                style={styles.modalHalfBtn}
              />
            </View>
          </Card>
        ) : null}

        {/* List Section */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {isManager ? 'Daftar Laporan Kehilangan' : 'Riwayat Laporan Saya'}
          </Text>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'].map((st) => (
              <TouchableOpacity
                key={st}
                onPress={() => setFilterStatus(st)}
                style={[styles.filterPill, filterStatus === st && styles.filterPillActive]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterStatus === st && styles.filterPillTextActive,
                  ]}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="Belum Ada Laporan"
            description="Tidak ditemukan laporan kehilangan dengan status ini."
          />
        ) : (
          reports.map((report) => {
            const isPending = report.status === 'PENDING';
            const dateStr = report.createdAt
              ? new Date(report.createdAt).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <Card key={report.id} style={styles.reportCard}>
                <View style={styles.reportTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportItemName}>{report.itemName}</Text>
                    <Text style={styles.reportDate}>{dateStr}</Text>
                  </View>
                  <Badge
                    variant={getStatusBadgeVariant(report.status)}
                    label={getStatusBadgeLabel(report.status)}
                  />
                </View>

                <View style={styles.reportMetaGrid}>
                  <View style={styles.reportMetaItem}>
                    <Text style={styles.metaLabel}>Jumlah Hilang</Text>
                    <Text style={styles.metaValue}>
                      {report.quantity} {report.unit}
                    </Text>
                  </View>
                  <View style={styles.reportMetaItem}>
                    <Text style={styles.metaLabel}>Pelapor</Text>
                    <Text style={styles.metaValue}>{report.reportedBy?.name || 'Crew'}</Text>
                  </View>
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Alasan:</Text>
                  <Text style={styles.reasonText}>{report.reason}</Text>
                  {report.description ? (
                    <Text style={styles.descText}>Keterangan: {report.description}</Text>
                  ) : null}
                </View>

                {report.reviewedBy ? (
                  <View style={styles.reviewInfoBox}>
                    <Text style={styles.reviewInfoText}>
                      Direview oleh: {report.reviewedBy.name}
                      {report.reviewedAt
                        ? ` · ${new Date(report.reviewedAt).toLocaleDateString('id-ID')}`
                        : ''}
                    </Text>
                    {report.reviewNote ? (
                      <Text style={styles.reviewNoteText}>Catatan: {report.reviewNote}</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Manager Review Action Buttons */}
                {isManager && isPending ? (
                  <View style={styles.actionBtnRow}>
                    <BaseButton
                      label="Tolak"
                      variant="danger"
                      onPress={() => handleOpenReview(report, 'REJECTED')}
                      style={styles.actionBtnHalf}
                    />
                    <BaseButton
                      label="Konfirmasi & Kurangi Stok"
                      variant="primary"
                      onPress={() => handleOpenReview(report, 'CONFIRMED')}
                      style={styles.actionBtnHalf}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  backButton: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.sizes.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  summaryPending: {
    backgroundColor: '#FEF3C7',
  },
  summaryConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  summaryRejected: {
    backgroundColor: '#FEE2E2',
  },
  summaryNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  formCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemPills: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  itemPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
  },
  itemPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemPillText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  itemPillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  selectedItemNote: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  reviewModalCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  modalDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginVertical: spacing.xs,
  },
  reportDetailBox: {
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportDetailText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    marginBottom: 2,
  },
  bold: {
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    backgroundColor: '#FFF',
    fontSize: typography.sizes.sm,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalHalfBtn: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterPillText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  reportCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  reportTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reportItemName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  reportDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  reportMetaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  reportMetaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  reasonBox: {
    marginVertical: spacing.xs,
  },
  reasonLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.text,
  },
  reasonText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  descText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewInfoBox: {
    backgroundColor: colors.surface,
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  reviewInfoText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  reviewNoteText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtnHalf: {
    flex: 1,
  },
});
