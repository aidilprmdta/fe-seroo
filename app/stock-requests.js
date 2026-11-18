// StockRequestsScreen — permintaan stok crew + persetujuan manager
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/auth/AuthContext';
import { createStockRequestsApi } from '../src/api/stock-requests';
import { createInventoryApi } from '../src/api/inventory';
import { createApiClient } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import Input from '../src/components/Input';
import BaseButton from '../src/components/BaseButton';
import Badge from '../src/components/Badge';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import Notice from '../src/components/Notice';
import Modal from '../src/components/Modal';

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function statusLabel(status) {
  if (status === 'PENDING') return '⏳ Menunggu';
  if (status === 'APPROVED') return '✓ Disetujui';
  if (status === 'REJECTED') return '✗ Ditolak';
  return '✓ Selesai';
}

export default function StockRequestsScreen() {
  const { user, selection } = useAuth();
  const outletId = selection.activeOutletId;
  const role = user?.memberships?.find((m) => m.outletId === outletId)?.role;

  const [requests, setRequests] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ inventoryItemId: '', quantity: '', note: '' });
  const [decision, setDecision] = useState(null);

  const getApi = useCallback(() => {
    const client = createApiClient();
    return {
      stockApi: createStockRequestsApi({ request: client }),
      inventoryApi: createInventoryApi({ request: client }),
    };
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await getApi().stockApi.listRequests(outletId);
      setRequests(data?.data?.requests || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Permintaan stok gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, getApi]);

  const loadStocks = useCallback(async () => {
    try {
      const data = await getApi().inventoryApi.getStock(outletId);
      setStocks(data?.data?.stocks || []);
    } catch {
      // item bisa diisi manual
    }
  }, [outletId, getApi]);

  useEffect(() => {
    loadRequests();
    if (role === 'CREW') loadStocks();
  }, [loadRequests, loadStocks, role]);

  const openCreate = useCallback(() => {
    setForm({ inventoryItemId: stocks[0]?.id || '', quantity: '', note: '' });
    setError(null);
    setModal('create');
  }, [stocks]);

  const handleCreate = useCallback(async () => {
    setError(null);
    if (!form.inventoryItemId || !(Number(form.quantity) > 0)) {
      setError('Pilih item dan isi jumlah lebih dari nol.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().stockApi.createRequest(outletId, {
        clientTransactionId: uuidv4(),
        items: [
          {
            inventoryItemId: form.inventoryItemId,
            quantity: String(Number(form.quantity)),
          },
        ],
        note: form.note.trim() || undefined,
      });
      Alert.alert('Berhasil', 'Permintaan stok berhasil dibuat.');
      setModal(null);
      loadRequests();
    } catch (err) {
      setError(err?.message || 'Permintaan stok gagal dibuat.');
    } finally {
      setSubmitting(false);
    }
  }, [form, getApi, outletId, loadRequests]);

  const openDecision = useCallback((request, status) => {
    setDecision({ requestId: request.id, status });
    setError(null);
    setModal('decision');
  }, []);

  const handleDecision = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      await getApi().stockApi.processRequest(outletId, decision.requestId, {
        status: decision.status,
      });
      Alert.alert(
        'Berhasil',
        decision.status === 'APPROVED'
          ? 'Permintaan disetujui.'
          : 'Permintaan ditolak.',
      );
      setModal(null);
      loadRequests();
    } catch (err) {
      setError(err?.message || 'Keputusan gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  }, [decision, getApi, outletId, loadRequests]);

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadRequests} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Permintaan Stok</Text>
          <Text style={styles.subtitle}>Outlet: {outletId}</Text>
        </View>

        {error && !modal && <Notice message={error} type="error" />}

        {role === 'CREW' && (
          <BaseButton label="Buat Permintaan Stok" onPress={openCreate} fullWidth size="lg" />
        )}

        <Text style={styles.sectionTitle}>Permintaan Aktif</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.text}>Memuat permintaan…</Text>
          </View>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📦</Text>}
            title="Tidak ada permintaan"
            subtitle="Permintaan stok akan muncul di sini."
          />
        ) : (
          requests.map((r) => (
            <Card key={r.id} style={styles.requestCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.requestTitle}>
                  {r.items?.[0]?.itemName || 'Tanpa item'}
                </Text>
                <Badge label={statusLabel(r.status)} />
              </View>
              <Text style={styles.requestMeta}>
                Qty: {r.items?.[0]?.quantity || 0}
                {r.note ? ` · ${r.note}` : ''}
              </Text>
              {role === 'MANAGER' && r.status === 'PENDING' && (
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={[styles.action, styles.actionApprove]}
                    onPress={() => openDecision(r, 'APPROVED')}
                  >
                    <Text style={[styles.actionText, styles.actionApproveText]}>Setujui</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.action, styles.actionReject]}
                    onPress={() => openDecision(r, 'REJECTED')}
                  >
                    <Text style={[styles.actionText, styles.actionRejectText]}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modal === 'create'}
        onClose={() => setModal(null)}
        title="Buat Permintaan Stok"
        subtitle="Pilih item dan jumlah yang dibutuhkan."
        footer={
          <BaseButton label="Kirim Permintaan" onPress={handleCreate} loading={submitting} fullWidth size="lg" />
        }
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Text style={styles.modalLabel}>Item Stok</Text>
          <View style={styles.chipRow}>
            {stocks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, form.inventoryItemId === item.id && styles.chipActive]}
                onPress={() => setForm({ ...form, inventoryItemId: item.id })}
              >
                <Text style={[styles.chipText, form.inventoryItemId === item.id && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label="Jumlah" value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} placeholder="0" keyboardType="numeric" />
          <Input label="Catatan" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} placeholder="Opsional" />
        </View>
      </Modal>

      <Modal
        visible={modal === 'decision'}
        onClose={() => setModal(null)}
        title={decision?.status === 'APPROVED' ? 'Setujui Permintaan' : 'Tolak Permintaan'}
        subtitle="Keputusan akan dicatat di audit log."
        footer={
          <BaseButton
            label={decision?.status === 'APPROVED' ? 'Setujui' : 'Tolak'}
            onPress={handleDecision}
            loading={submitting}
            fullWidth
            size="lg"
            variant={decision?.status === 'APPROVED' ? 'primary' : 'danger'}
          />
        }
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Text style={styles.modalText}>
            {decision?.status === 'APPROVED'
              ? 'Stok akan dikurangi dari gudang pusat sesuai jumlah permintaan.'
              : 'Permintaan akan ditutup tanpa perubahan stok.'}
          </Text>
        </View>
      </Modal>
    </ScreenFrame>
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
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  icon: { fontSize: 40 },
  requestCard: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
    flex: 1,
  },
  requestMeta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    alignItems: 'center',
  },
  actionApprove: { backgroundColor: colors.light.successSurface },
  actionReject: { backgroundColor: colors.light.dangerSurface },
  actionText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  actionApproveText: { color: colors.light.success },
  actionRejectText: { color: colors.light.danger },
  modalContent: { padding: spacing.md, gap: spacing.md },
  modalLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  modalText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
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
});
