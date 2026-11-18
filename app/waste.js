// WasteScreen — pencatatan & riwayat waste (sesuai schema backend)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/auth/AuthContext';
import { createWasteApi } from '../src/api/waste';
import { createApiClient } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import ListItem from '../src/components/ListItem';
import Input from '../src/components/Input';
import BaseButton from '../src/components/BaseButton';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import Notice from '../src/components/Notice';

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toIsoDate(dateKey) {
  return new Date(`${dateKey}T00:00:00+07:00`).toISOString();
}

export default function WasteScreen() {
  const { selection } = useAuth();
  const outletId = selection.activeOutletId;

  const [wasteRecords, setWasteRecords] = useState([]);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Bahan Baku');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [date, setDate] = useState(todayKey());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(() => {
    const client = createApiClient();
    return createWasteApi({ request: client });
  }, []);

  const loadWaste = useCallback(async () => {
    try {
      const data = await getApi().listWaste(outletId, { pageSize: 100 });
      setWasteRecords(data?.data?.waste || data?.data?.wasteRecords || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Riwayat waste gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, getApi]);

  useEffect(() => {
    loadWaste();
  }, [loadWaste]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!itemName.trim() || !category.trim() || !(Number(quantity) > 0) || !unit.trim()) {
      setError('Nama item, kategori, jumlah, dan unit wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().createWaste(outletId, {
        clientTransactionId: uuidv4(),
        itemName: itemName.trim(),
        category: category.trim(),
        quantity: String(Number(quantity)),
        unit: unit.trim(),
        description: description.trim() || undefined,
        wasteDate: toIsoDate(date),
      });
      setItemName('');
      setQuantity('');
      setDescription('');
      setDate(todayKey());
      await loadWaste();
      Alert.alert('Berhasil', 'Waste berhasil dicatat.');
    } catch (err) {
      setError(err?.message || 'Waste gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  }, [itemName, category, quantity, unit, description, date, outletId, getApi, loadWaste]);

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadWaste} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Pencatatan Waste</Text>
          <Text style={styles.subtitle}>Outlet: {outletId}</Text>
        </View>

        {error && <Notice message={error} type="error" />}

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Catat Waste</Text>
          <Input label="Nama item" value={itemName} onChangeText={setItemName} placeholder="Contoh: Teh tarik tumpah" />
          <Input label="Kategori" value={category} onChangeText={setCategory} placeholder="Bahan Baku / Produk Batal" />
          <Input label="Kuantitas" value={quantity} onChangeText={setQuantity} placeholder="0" keyboardType="numeric" />
          <Input label="Unit" value={unit} onChangeText={setUnit} placeholder="pcs / cup / kg" />
          <Input label="Tanggal" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numeric" />
          <Input label="Deskripsi" value={description} onChangeText={setDescription} placeholder="Alasan waste (opsional)" />
          <BaseButton label="Simpan Waste" onPress={handleSubmit} loading={submitting} fullWidth size="lg" />
        </Card>

        <Text style={styles.sectionTitle}>Riwayat Waste</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : wasteRecords.length === 0 ? (
          <EmptyState icon={<Text style={styles.icon}>🗑️</Text>} title="Belum ada catatan" subtitle="Waste akan muncul di sini setelah dicatat." />
        ) : (
          wasteRecords.map((record) => (
            <ListItem
              key={record.id}
              title={`${record.itemName || 'Item'} · ${record.quantity} ${record.unit || ''}`}
              subtitle={`${record.category || '-'} · ${record.description || 'Tanpa keterangan'}`}
              right={<Text style={styles.date}>{(record.wasteDate || record.createdAt || '').slice(0, 10)}</Text>}
            />
          ))
        )}
      </ScrollView>
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
  formCard: { gap: spacing.md },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  loading: { padding: spacing.xl, alignItems: 'center' },
  icon: { fontSize: 40 },
  date: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
});
