// CrewShopeeFoodScreen — Pemesanan dari platform eksternal (ShopeeFood/Grab)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createCatalogApi } from '../../src/api/catalog';
import { createOrdersApi } from '../../src/api/orders';
import { createApiRequestWrapper } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import EmptyState from '../../src/components/EmptyState';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function CrewShopeeFoodScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;

  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    platformOrderNumber: '',
    quantity: '',
    paymentMethod: 'SHOPEEFOOD_IN_APP',
  });
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async () => {
    if (!outletId) return;
    try {
      const catalogApi = createCatalogApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await catalogApi.getCatalog(outletId);
      setCatalog(data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Katalog gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [outletId, apiRequest]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const products = catalog?.data?.products ?? [];
  const flatVariants = products.flatMap((product) =>
    product.variants.map((variant) => ({ ...variant, productName: product.name })),
  );

  const handleSubmit = async () => {
    setError(null);
    if (!form.platformOrderNumber.trim()) {
      setError('Nomor pesanan platform wajib diisi.');
      return;
    }
    if (!selectedVariant) {
      setError('Pilih produk dan varian dari katalog.');
      return;
    }
    if (!(Number(form.quantity) > 0)) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }

    try {
      setSaving(true);
      const ordersApi = createOrdersApi({ request: createApiRequestWrapper(apiRequest) });
      await ordersApi.createOrder(outletId, {
        platformOrderId: form.platformOrderNumber.trim(),
        recordedOffline: false,
        paymentMethod: form.paymentMethod,
        items: [
          {
            productVariantId: selectedVariant.id,
            quantity: Number(form.quantity),
            expectedVariantPrice: selectedVariant.price,
            addOns: [],
          },
        ],
      });
      setSaved(true);
      Alert.alert('Berhasil', 'Pesanan ShopeeFood berhasil disimpan sebagai pesanan POS berlabel ShopeeFood.');
      setForm({ platformOrderNumber: '', quantity: '', paymentMethod: 'SHOPEEFOOD_IN_APP' });
      setSelectedVariant(null);
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
                <Text style={styles.label}>Produk & varian</Text>
                <Text style={styles.hint}>Dari katalog outlet</Text>
              </View>
              {loading ? (
                <Text style={styles.hint}>Memuat katalog...</Text>
              ) : flatVariants.length === 0 ? (
                <EmptyState
                  title="Katalog kosong"
                  description="Tidak ada produk aktif untuk outlet ini."
                />
              ) : (
                flatVariants.map((variant) => (
                  <TouchableOpacity
                    key={variant.id}
                    style={[styles.methodRow, selectedVariant?.id === variant.id && styles.methodRowActive]}
                    onPress={() => setSelectedVariant(variant)}
                  >
                    <View style={styles.methodDot} />
                    <Text style={[styles.methodText, selectedVariant?.id === variant.id && styles.methodTextActive]}>
                      {variant.productName} · {variant.name} · Rp {formatRupiah(variant.price)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

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

              <Text style={styles.sectionTitle}>Metode pembayaran</Text>
              {[
                { key: 'SHOPEEFOOD_IN_APP', label: 'ShopeeFood In-App (settlement platform)' },
                { key: 'SHOPEEFOOD_COD', label: 'ShopeeFood COD (dibayar ke driver)' },
                { key: 'CASH', label: 'Cash di outlet' },
                { key: 'QRIS', label: 'QRIS (menunggu verifikasi kasir)' },
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[styles.methodRow, form.paymentMethod === method.key && styles.methodRowActive]}
                  onPress={() => setForm({ ...form, paymentMethod: method.key })}
                >
                  <View style={styles.methodDot} />
                  <Text style={[styles.methodText, form.paymentMethod === method.key && styles.methodTextActive]}>
                    {method.label}
                  </Text>
                  <Text style={[styles.methodPilih, form.paymentMethod === method.key && styles.methodPilihActive]}>
                    PILIH
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.priceNote}>
                * Total dihitung backend dari harga katalog. Pesanan tercatat sebagai pesanan POS
                dengan penanda sumber ShopeeFood.
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
              Nomor pesanan: {form.platformOrderNumber || '—'}
              {selectedVariant ? ` · ${selectedVariant.productName} ${selectedVariant.name} · Rp ${formatRupiah(selectedVariant.price)}` : ''}
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
