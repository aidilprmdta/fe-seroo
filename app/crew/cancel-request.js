// CrewCancelRequestScreen — Ajukan pembatalan pesanan (terpisah dari riwayat)
// Figma: 13 · Ajukan pembatalan · Tablet · Prototype
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { createOrdersApi } from '../../src/api/orders';
import { createApiClient, createApiRequestWrapper } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function CrewCancelRequestScreen() {
  const { id: orderId } = useLocalSearchParams();
  const { selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;

  const [order, setOrder] = useState(null);
  const [reason, setReason] = useState('');
  const [recordWaste, setRecordWaste] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(() => {
    return createOrdersApi({ request: createApiRequestWrapper(apiRequest) });
  }, []);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getApi().getOrder(outletId, orderId);
      setOrder(data?.data?.order || data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Pesanan tidak ditemukan.');
    }
  }, [orderId, outletId, getApi]);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId, loadOrder]);

  const handleCancel = useCallback(async () => {
    setError(null);
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Alasan pembatalan minimal 5 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().cancelOrder(outletId, orderId, {
        reason: reason.trim(),
        recordWaste,
      });
      Alert.alert('Berhasil', 'Pesanan dibatalkan.');
      // Navigasi kembali ke riwayat (dijalankan oleh parent navigation)
      if (Platform && Platform.OS === 'web') {
        window.history.back();
      } else {
        // Di React Native, parent akan handle back
      }
    } catch (err) {
      setError(err?.message || 'Pembatalan gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [orderId, outletId, reason, recordWaste, getApi]);

  if (!order) {
    return (
      <AppShell
        navRole="crew"
        active="cancel-request"
        title="Ajukan Pembatalan"
        subtitle="Pilih pesanan dulu."
        roleLabel="CREW · OUTLET"
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
        contentStyle={styles.container}
      >
        <Notice message="Pilih pesanan dari daftar untuk ajukan pembatalan." type="info" />
      </AppShell>
    );
  }

  return (
    <AppShell
      navRole="crew"
      active="cancel-request"
      title="Ajukan Pembatalan"
      subtitle={`Order #${order?.orderNumber || orderId}`}
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      {error && <Notice message={error} type="error" />}

      <Card style={styles.ruleCard}>
        <Text style={styles.sectionTitle}>Aturan pembatalan</Text>
        <Text style={styles.ruleText}>
          Pembatalan hanya diperbolehkan jika belum dimulai atau sudah mulai tetapi masih
          dalam proses penyelesaian (belum ditutup closing).
        </Text>
      </Card>

      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Detail pesanan yang dibatalkan</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Order #</Text>
          <Text style={styles.value}>{order?.orderNumber || orderId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>Rp {formatRupiah(order?.total || 0)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Metode</Text>
          <Text style={styles.value}>{order?.paymentMethod || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Alasan pembatalan</Text>
        <Input
          value={reason}
          onChangeText={setReason}
          placeholder="Minimal 5 karakter"
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.checkRow, recordWaste && styles.checkRowActive]}
          onPress={() => setRecordWaste(!recordWaste)}
        >
          <Text style={[styles.checkText, recordWaste && styles.checkTextActive]}>
            {recordWaste ? '✓' : '○'} Catat sebagai waste
          </Text>
        </TouchableOpacity>
      </Card>

      <BaseButton
        label="Kirim permintaan pembatalan"
        onPress={handleCancel}
        fullWidth
        size="lg"
        loading={submitting}
        disabled={submitting}
        style={styles.saveButton}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  ruleCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  formCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.surface,
  },
  label: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  value: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  checkRow: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  checkRowActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.surfaceSecondary,
  },
  checkText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  checkTextActive: {
    color: colors.light.primary,
  },
  saveButton: {
    backgroundColor: colors.light.primary,
  },
});
