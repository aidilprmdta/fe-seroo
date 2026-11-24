// CrewShopeeFoodScreen — Pemesanan dari platform eksternal (ShopeeFood/Grab)
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createShopeeApi } from '../../src/api/shopee';
import { createApiClient } from '../../src/api/api';
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

export default function CrewShopeeFoodScreen() {
  const { user, selection } = useAuth();
  const outletId = selection?.activeOutletId;
  const crewId = user?.id;

  const [form, setForm] = useState({
    platformOrderNumber: '',
    shopeeProduct: '',
    quantity: '',
    amount: '',
    paymentMethod: 'COD',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!form.platformOrderNumber.trim()) {
      setError('Nomor pesanan platform wajib diisi.');
      return;
    }
    if (!form.shopeeProduct.trim()) {
      setError('Nama produk Shopee wajib diisi.');
      return;
    }
    if (!(Number(form.quantity) > 0)) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setError('Nominal pembayaran harus lebih dari 0.');
      return;
    }

    try {
      setSaving(true);
      const client = createApiClient();
      const shopeeApi = createShopeeApi({ request: client });
      await shopeeApi.createOrder(outletId, {
        clientTransactionId: `shopee-${Date.now()}`,
        recordedOffline: false,
        paymentMethod: form.paymentMethod,
        payments: [{ paymentMethod: 'CASH', amount: formatRupiah(form.amount) }],
        items: [
          {
            productVariantId: `shopee-${form.shopeeProduct.trim()}`,
            quantity: Number(form.quantity),
            expectedVariantPrice: formatRupiah(form.amount),
            addOns: [],
          },
        ],
      });
      setSaved(true);
      Alert.alert('Berhasil', 'Pesanan ShopeeFood berhasil disimpan.');
      setForm({ platformOrderNumber: '', shopeeProduct: '', quantity: '', amount: '', paymentMethod: 'COD' });
    } catch (err) {
      setError(err?.message || 'Pesanan ShopeeFood gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      navRole="crew"
      active="shopee"
      title="ShopeeFood"
      subtitle="Terima & catat pesanan dari platform eksternal."
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && <Notice message={error} type="error" />}

        {!saved ? (
          <>
            <Card style={styles.formCard}>
              <Text style={styles.sectionTitle}>Input pesanan Shopee</Text>

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Platform order number</Text>
                <Text style={styles.hint}>Contoh: LM00012345</Text>
              </View>
              <Input
                value={form.platformOrderNumber}
                onChangeText={(v) => setForm({ ...form, platformOrderNumber: v })}
                placeholder="LM00012345"
              />

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Nama produk Shopee</Text>
                <Text style={styles.hint}>Contoh: Teh Tarik Original</Text>
              </View>
              <Input
                value={form.shopeeProduct}
                onChangeText={(v) => setForm({ ...form, shopeeProduct: v })}
                placeholder="Teh Tarik Original"
              />

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Quantity</Text>
                <Text style={styles.hint}>Jumlah pesanan</Text>
              </View>
              <Input
                value={form.quantity}
                onChangeText={(v) => setForm({ ...form, quantity: v })}
                placeholder="1"
                keyboardType="numeric"
              />

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Nominal (Rp)</Text>
                <Text style={styles.hint}>Total bayar dari Shopee</Text>
              </View>
              <Input
                value={form.amount}
                onChangeText={(v) => setForm({ ...form, amount: v })}
                placeholder="15000"
                keyboardType="numeric"
              />

              <Text style={styles.sectionTitle}>Metode pembayaran</Text>
              <TouchableOpacity
                style={[styles.methodRow, form.paymentMethod === 'COD' && styles.methodRowActive]}
                onPress={() => setForm({ ...form, paymentMethod: 'COD' })}
              >
                <View style={styles.methodDot} />
                <Text style={[styles.methodText, form.paymentMethod === 'COD' && styles.methodTextActive]}>
                  COD (Cash on Delivery)
                </Text>
                <Text style={[styles.methodPilih, form.paymentMethod === 'COD' && styles.methodPilihActive]}>
                  PILIH
                </Text>
              </TouchableOpacity>

              <Text style={styles.priceNote}>
                * Pembayaran COD diterima di loket saat driver mengantarkan pesanan.
              </Text>
            </Card>

            <BaseButton
              label="Simpan pesanan Shopee"
              onPress={handleSubmit}
              fullWidth
              size="lg"
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            />
          </>
        ) : (
          <Card style={styles.successCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Pesanan tersimpan</Text>
            <Text style={styles.successSubtitle}>
              Pesanan ShopeeFood berhasil dicatat. Langkah berikutnya: serah terima ke driver.
            </Text>
          </Card>
        )}

        {/* Driver handoff steps */}
        <Card style={styles.handoffCard}>
          <Text style={styles.handoffTitle}>Serah terima ke driver</Text>
          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>Ambil pesanan dari kurir ShopeeFood</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>Bawa pesanan ke pelanggan</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>Konfirmasi settlement ke outlet</Text>
            </View>
          </View>

          <View style={styles.settlementNote}>
            <Text style={styles.settlementNoteTitle}>Settlement</Text>
            <Text style={styles.settlementNoteText}>
              Nomor pesanan: {form.platformOrderNumber || '—'} · Total: Rp {formatRupiah(form.amount)}
            </Text>
          </View>

          <View style={styles.outletStatus}>
            <Text style={styles.outletStatusLabel}>Status outlet</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>READY</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  scrollContent: { paddingBottom: spacing.lg },
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  hint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  methodRowActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.surfaceSecondary,
  },
  methodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.light.border,
  },
  methodDotActive: {
    backgroundColor: colors.light.primary,
  },
  methodText: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  methodTextActive: {
    color: colors.light.primary,
  },
  methodPilih: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.surfaceMuted,
    color: colors.light.maroon,
    fontSize: 7,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  methodPilihActive: {
    backgroundColor: colors.light.primary,
    color: colors.light.surface,
  },
  priceNote: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 14,
  },
  saveButton: {
    backgroundColor: colors.light.primary,
  },
  successCard: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    fontSize: 24,
    color: colors.light.success,
    fontWeight: 'bold',
  },
  successTitle: {
    ...typography.fontFamily.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  successSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  handoffCard: {
    gap: spacing.md,
  },
  handoffTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.light.primary,
  },
  stepText: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  stepConnector: {
    width: 2,
    height: 24,
    backgroundColor: colors.light.border,
  },
  settlementNote: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  settlementNoteTitle: {
    ...typography.fontFamily.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.maroon,
    marginBottom: spacing.xs,
  },
  settlementNoteText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    lineHeight: 14,
  },
  outletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.surface,
  },
  outletStatusLabel: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  statusBadge: {
    backgroundColor: colors.light.successSurface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusBadgeText: {
    ...typography.fontFamily.semibold,
    fontSize: 10,
    color: colors.light.success,
  },
});
