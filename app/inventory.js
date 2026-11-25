// InventoryScreen — stok aktif + form Stok Masuk / Stok Sesuai
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/auth/AuthContext';
import { createInventoryApi } from '../src/api/inventory';
import { createApiRequestWrapper } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import ListItem from '../src/components/ListItem';
import BaseButton from '../src/components/BaseButton';
import Input from '../src/components/Input';
import Notice from '../src/components/Notice';
import Modal from '../src/components/Modal';
import Badge from '../src/components/Badge';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import AppShell from '../src/components/AppShell';

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function InventoryScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection.activeOutletId;
  const activeRole = user?.memberships?.find((m) => m.outletId === outletId)?.role || selection.activeRole;
  const isOwner = activeRole === 'OWNER_MITRA' || activeRole === 'OWNER';
  const navRole = isOwner ? 'ownerMitra' : 'manager';
  const canMutateStock = activeRole === 'MANAGER';
  const roleLabel = activeRole || 'MANAGER';

  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState('IN');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState('INCREASE');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadStock = useCallback(async () => {
    try {
      const inventoryApi = createInventoryApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await inventoryApi.getStock(outletId, { page: 1, pageSize: 50 });
      setStocks(data?.data?.stocks || []);
    } catch (err) {
      setError(err?.message || 'Stok gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId]);

  const loadMovements = useCallback(async () => {
    try {
      const api = createInventoryApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await api.getStockMovements(outletId, { pageSize: 50 });
      setMovements(data?.data?.movements || []);
    } catch {
      // riwayat bersifat opsional
    }
  }, [outletId]);

  useEffect(() => {
    loadStock();
    loadMovements();
  }, [loadStock, loadMovements]);

  const openModal = useCallback((nextMode) => {
    setMode(nextMode);
    setInventoryItemId('');
    setQuantity('');
    setDirection('INCREASE');
    setNote('');
    setError(null);
    setModalVisible(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!inventoryItemId.trim()) {
      setError('Pilih item stok terlebih dahulu.');
      return;
    }
    if (!(Number(quantity) > 0)) {
      setError('Jumlah harus lebih dari nol.');
      return;
    }
    if (mode === 'ADJUSTMENT' && !note.trim()) {
      setError('Alasan penyesuaian wajib diisi.');
      return;
    }

    const payload = {
      clientTransactionId: uuidv4(),
      inventoryItemId: inventoryItemId.trim(),
      type: mode,
      quantity: String(Number(quantity)),
      ...(mode === 'ADJUSTMENT' ? { direction, note: note.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const api = createInventoryApi({ request: createApiRequestWrapper(apiRequest) });
      if (mode === 'ADJUSTMENT') {
        await api.createStockAdjustment(outletId, payload);
      } else {
        await api.createStockReceipt(outletId, payload);
      }
      Alert.alert('Berhasil', 'Pergerakan stok berhasil dicatat.');
      setModalVisible(false);
      loadStock();
      loadMovements();
    } catch (err) {
      setError(err?.message || 'Pergerakan stok gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  }, [inventoryItemId, quantity, mode, direction, note, outletId, loadStock, loadMovements]);

  return (
    <AppShell
      navRole={navRole}
      active="stok"
      title="Inventaris outlet"
      subtitle={isOwner ? "Memantau jumlah, satuan, batas minimum, dan pergerakan stok." : "Manager melihat jumlah, satuan, batas minimum, dan pergerakan stok."}
      roleLabel={roleLabel}
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadStock();
              loadMovements();
            }}
          />
        }
      >
        {error && !modalVisible && <Notice message={error} type="error" />}

        {canMutateStock && (
          <View style={styles.actionsCard}>
            <View style={styles.scopeBadge}>
              <Text style={styles.scopeBadgeText}>OUTLET INI</Text>
            </View>
            <View style={styles.actions}>
              <BaseButton
                label="Stok masuk"
                onPress={() => openModal('IN')}
                fullWidth
                size="lg"
                variant="primary"
              />
              <BaseButton
                label="Penyesuaian"
                onPress={() => openModal('ADJUSTMENT')}
                fullWidth
                size="lg"
                variant="secondary"
              />
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Daftar barang</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.text}>Memuat stok…</Text>
          </View>
        ) : stocks.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📦</Text>}
            title="Tidak ada stok"
            subtitle="Stok akan muncul setelah ada data."
          />
        ) : (
          stocks.map((item) => (
            <ListItem
              key={item.id}
              title={item.name}
              subtitle={`Unit: ${item.unit} · Sisa: ${item.quantity || 0}`}
              right={
                <Badge
                  label={item.minimumQuantity > 0 && item.quantity < item.minimumQuantity
                    ? '⚠️ Rendah'
                    : '✓ OK'}
                />
              }
            />
          ))
        )}
        <Text style={styles.sectionTitle}>Mutasi Stok</Text>
        {movements.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>📦</Text>}
            title="Belum ada mutasi"
            subtitle="Mutasi stok akan muncul setelah dicatat."
          />
        ) : (
          movements.map((item) => (
            <ListItem
              key={item.id}
              title={`${item.inventoryItem?.name || item.inventoryItemId || 'Item'} · ${item.type}`}
              subtitle={`${item.quantity} · ${item.note || 'Tanpa catatan'}`}
              right={<Badge label={(item.createdAt || '').slice(0, 10)} />}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={mode === 'IN' ? 'Stok Masuk' : 'Stok Sesuai'}
        subtitle="Pilih item dan masukkan jumlah pergerakan stok."
        footer={
          <BaseButton
            label="Simpan Pergerakan"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            size="lg"
          />
        }
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}

          <Text style={styles.modalLabel}>Item Stok</Text>
          <View style={styles.itemChips}>
            {stocks.slice(0, 12).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, inventoryItemId === item.id && styles.chipActive]}
                onPress={() => setInventoryItemId(item.id)}
              >
                <Text style={[styles.chipText, inventoryItemId === item.id && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input
            label="Atau masukkan ID item"
            value={inventoryItemId}
            onChangeText={setInventoryItemId}
            placeholder="ID item stok"
          />
          <Input
            label="Jumlah"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="numeric"
          />

          {mode === 'ADJUSTMENT' && (
            <>
              <Text style={styles.modalLabel}>Arah Penyesuaian</Text>
              <View style={styles.roleRow}>
                {['INCREASE', 'DECREASE'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, direction === option && styles.chipActive]}
                    onPress={() => setDirection(option)}
                  >
                    <Text style={[styles.chipText, direction === option && styles.chipTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                label="Alasan penyesuaian"
                value={note}
                onChangeText={setNote}
                placeholder="Contoh: stok rusak saat penerimaan"
              />
            </>
          )}
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm, justifyContent: 'center' },
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
  actionsCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  scopeBadge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  scopeBadgeText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.maroon,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  modalContent: { padding: spacing.md, gap: spacing.md },
  modalLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  itemChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
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
