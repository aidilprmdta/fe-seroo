// CrewPOSScreen — POS lengkap: katalog + add-on + keranjang + pembayaran + kirim order
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { useAuth } from '../../src/auth/AuthContext';
import { createCatalogApi } from '../../src/api/catalog';
import { createOrdersApi } from '../../src/api/orders';
import { createApiClient } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Notice from '../../src/components/Notice';
import EmptyState from '../../src/components/EmptyState';
import AppShell from '../../src/components/AppShell';
import OfflineBanner from '../../src/components/OfflineBanner';
import Card from '../../src/components/Card';
import { readQueue, enqueueOrder, removeQueuedOrder } from '../../src/lib/offlineQueue';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

function money(value) {
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cartKey(variantId, addOns) {
  const ids = (addOns || []).map((a) => a.id).sort().join(',');
  return `${variantId}:${ids}`;
}

export default function CrewPOSScreen() {
  const { selection } = useAuth();
  const outletId = selection.activeOutletId;
  const [view, setView] = useState('catalog');
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;
    Network.getNetworkStateAsync()
      .then((state) => { if (alive) setOnline(Boolean(state.isConnected)); })
      .catch(() => { if (alive) setOnline(false); });
    return () => { alive = false; };
  }, []);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const client = createApiClient();
      const catalogApi = createCatalogApi({ request: client });
      const data = await catalogApi.getCatalog(outletId);
      setCatalog(data);
    } catch (err) {
      setOrderError(err?.message || 'Katalog gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const isOnline = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      return Boolean(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return false;
    }
  }, []);

  const syncQueue = useCallback(async () => {
    const queue = await readQueue();
    setQueueCount(queue.length);
    if (queue.length === 0 || !(await isOnline())) return queue.length;

    setSyncing(true);
    const client = createApiClient();
    const ordersApi = createOrdersApi({ request: client });
    let remaining = [...queue];

    for (const entry of queue) {
      try {
        await ordersApi.createOrder(outletId, entry.payload);
        await removeQueuedOrder(entry.id);
        remaining = remaining.filter((item) => item.id !== entry.id);
      } catch (err) {
        if (
          ['PRICE_CHANGED', 'CATALOG_ITEM_UNAVAILABLE', 'IDEMPOTENCY_KEY_REUSED'].includes(err?.code)
        ) {
          await removeQueuedOrder(entry.id);
          remaining = remaining.filter((item) => item.id !== entry.id);
        } else {
          break;
        }
      }
    }

    setQueueCount(remaining.length);
    setSyncing(false);
    return remaining.length;
  }, [outletId, isOnline]);

  useEffect(() => {
    syncQueue();
  }, [syncQueue]);

  const toggleAddOn = useCallback((addOn) => {
    setSelectedAddOns((prev) =>
      prev.some((a) => a.id === addOn.id)
        ? prev.filter((a) => a.id !== addOn.id)
        : [...prev, addOn],
    );
  }, []);

  const addToCart = useCallback((product, variant) => {
    const addOns = selectedAddOns;
    const key = cartKey(variant.id, addOns);
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { key, product, variant, addOns, quantity: 1 }];
    });
    setSelectedAddOns([]);
    setOrderError(null);
  }, [selectedAddOns]);

  const removeFromCart = useCallback((key) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateQuantity = useCallback((key, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const quantity = item.quantity + delta;
          return quantity <= 0 ? null : { ...item, quantity };
        })
        .filter(Boolean),
    );
  }, []);

  const subtotal = cart.reduce((sum, item) => {
    const variantPrice = Number(item.variant.price || 0);
    const addOnsPrice = item.addOns.reduce((a, b) => a + (Number(b.price) || 0), 0);
    return sum + (variantPrice + addOnsPrice) * item.quantity;
  }, 0);

  const total = subtotal;
  const paid = Number(paidAmount) || 0;
  const change = Math.max(0, paid - total);

  const changePaymentMethod = useCallback((method) => {
    setPaymentMethod(method);
    setPaidAmount(method === 'QRIS' && total > 0 ? money(total) : '');
    setOrderError(null);
  }, [total]);

  const handleSubmit = useCallback(async () => {
    if (cart.length === 0) {
      setOrderError('Keranjang masih kosong.');
      return;
    }
    setOrderError(null);

    let payments;
    if (paymentMethod === 'SPLIT') {
      if (paid <= 0 || paid >= total) {
        setOrderError('Nominal CASH harus lebih dari 0 dan kurang dari total.');
        return;
      }
      payments = [
        { paymentMethod: 'CASH', amount: money(paid) },
        { paymentMethod: 'QRIS', amount: money(total - paid) },
      ];
    } else if (paymentMethod === 'QRIS') {
      payments = [{ paymentMethod: 'QRIS', amount: money(total) }];
    } else {
      if (paid <= 0) {
        setOrderError('Masukkan nominal uang bayar.');
        return;
      }
      if (paid < total) {
        setOrderError(`Pembayaran kurang Rp ${formatRupiah(total - paid)}.`);
        return;
      }
      payments = [{ paymentMethod: 'CASH', amount: money(paid) }];
    }

    const orderData = {
      clientTransactionId: uuidv4(),
      recordedOffline: false,
      paymentMethod,
      payments,
      items: cart.map((item) => ({
        productVariantId: item.variant.id,
        quantity: item.quantity,
        expectedVariantPrice: money(item.variant.price),
        addOns: item.addOns.map((a) => ({
          addOnId: a.id,
          quantity: 1,
          expectedUnitPrice: money(a.price),
        })),
      })),
    };

    const online = await isOnline();
    const payload = { ...orderData, recordedOffline: !online };

    if (!online) {
      await enqueueOrder(payload);
      setQueueCount((count) => count + 1);
      setCart([]);
      setSelectedAddOns([]);
      setPaidAmount('');
      Alert.alert(
        'Tersimpan offline',
        'Pesanan akan dikirim otomatis saat koneksi kembali.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const client = createApiClient();
      const ordersApi = createOrdersApi({ request: client });
      const response = await ordersApi.createOrder(outletId, payload);
      const order = response?.data?.order;
      if (!response?.success || !order) {
        throw new Error('Respons order tidak sesuai kontrak.');
      }
      Alert.alert(
        'Pesanan berhasil dicatat',
        `Nomor: ${order.orderNumber}\nTotal: Rp ${formatRupiah(order.total)}`,
      );
      setCart([]);
      setSelectedAddOns([]);
      setPaidAmount('');
      loadCatalog();
    } catch (err) {
      if (
        err?.code === 'NETWORK_ERROR' ||
        err?.code === 'NETWORK_TIMEOUT' ||
        err?.status === 0
      ) {
        await enqueueOrder({ ...payload, recordedOffline: true });
        setQueueCount((count) => count + 1);
        setCart([]);
        setSelectedAddOns([]);
        setPaidAmount('');
        Alert.alert(
          'Tersimpan offline',
          'Koneksi terputus. Pesanan akan dikirim otomatis nanti.',
        );
      } else {
        setOrderError(err?.message || 'Pesanan gagal disimpan.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [cart, paymentMethod, paid, total, outletId, loadCatalog, isOnline]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.light.primary} />
        <Text style={styles.text}>Memuat katalog…</Text>
      </View>
    );
  }

  return (
    <AppShell
      navRole="crew"
      active="menu"
      title={view === 'checkout' ? 'Pembayaran' : 'Katalog menu'}
      subtitle={view === 'checkout'
        ? 'Semua item harus siap sebelum dibayar dan diserahkan.'
        : 'Seluruh menu Seroo · pilih produk untuk mengatur ukuran dan topping.'}
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadCatalog} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Katalog menu</Text>
        <Text style={styles.subtitle}>Outlet: {outletId}</Text>
      </View>

        {!online && <OfflineBanner detail="Pesanan tetap disimpan dan akan dikirim saat koneksi kembali." />}

      {queueCount > 0 && (
        <Notice
          message={`${queueCount} pesanan menunggu sinkronisasi.`}
          type="warning"
        />
      )}
      {queueCount > 0 && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={syncQueue}
          disabled={syncing}
        >
          <Text style={styles.syncText}>
            {syncing ? 'Mengirim…' : 'Sinkronisasi Sekarang'}
          </Text>
        </TouchableOpacity>
      )}

      {orderError && <Notice message={orderError} type="error" />}

      {view === 'checkout' ? (
        <View style={styles.checkoutWrapper}>
          <View style={styles.checkoutSummary}>
            <Text style={styles.checkoutSectionTitle}>Ringkasan pesanan</Text>
            <View style={styles.unpaidBadge}>
              <Text style={styles.unpaidBadgeText}>BELUM DIBAYAR</Text>
            </View>
            {cart.map((item) => (
              <View key={item.key} style={styles.checkoutItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkoutItemName}>{item.product.name}</Text>
                  <Text style={styles.checkoutItemVariant}>
                    {item.variant.name} · {item.quantity} cup
                  </Text>
                </View>
                <Text style={styles.checkoutItemPrice}>
                  Rp {formatRupiah(item.variant.price)}
                </Text>
              </View>
            ))}
            <View style={styles.checkoutDivider} />
            <View style={styles.checkoutTotalRow}>
              <Text style={styles.checkoutTotalLabel}>TOTAL</Text>
              <Text style={styles.checkoutTotalValue}>Rp {formatRupiah(total)}</Text>
            </View>
          </View>

          <View style={styles.checkoutPaymentCard}>
            <Text style={styles.checkoutSectionTitle}>Alokasi pembayaran</Text>
            <Text style={styles.checkoutHint}>
              Pilih Tunai, QRIS, atau gabungkan keduanya.
            </Text>

            <View style={styles.checkoutMethodRow}>
              {[
                { key: 'CASH', label: 'Tunai', desc: 'Bisa digabung' },
                { key: 'QRIS', label: 'QRIS', desc: 'Verifikasi manual' },
                { key: 'SPLIT', label: 'Gabungan', desc: 'Tunai + QRIS' },
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[styles.checkoutMethod, paymentMethod === method.key && styles.checkoutMethodActive]}
                  onPress={() => changePaymentMethod(method.key)}
                >
                  <Text style={styles.checkoutMethodTitle}>{method.label}</Text>
                  <Text style={styles.checkoutMethodDesc}>{method.desc}</Text>
                  <Text style={[styles.checkoutMethodPilih, paymentMethod === method.key && styles.checkoutMethodPilihActive]}>
                    PILIH
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod !== 'QRIS' ? (
              <Input
                label={paymentMethod === 'SPLIT' ? 'Nominal CASH (sisanya QRIS)' : 'Uang diterima (Tunai)'}
                value={paidAmount}
                onChangeText={setPaidAmount}
                placeholder={paymentMethod === 'SPLIT' ? 'Nominal CASH' : 'Masukkan nominal uang tunai yang diterima'}
                keyboardType="numeric"
              />
            ) : (
              <Input
                label="Nominal QRIS terverifikasi"
                value={paidAmount}
                onChangeText={setPaidAmount}
                placeholder="Masukkan nominal QRIS yang berhasil diverifikasi"
                keyboardType="numeric"
              />
            )}

            {paymentMethod === 'SPLIT' ? (
              <Text style={styles.checkoutQrisAmount}>
                QRIS terverifikasi: Rp {formatRupiah(Math.max(0, total - paid))}
              </Text>
            ) : null}

            <View style={styles.changePanel}>
              <Text style={styles.changeLabel}>ALOKASI TUNAI OTOMATIS</Text>
              <Text style={styles.changeValue}>Total pesanan − QRIS</Text>
              <Text style={styles.changeValue}>Kembalian: Rp {formatRupiah(change)}</Text>
            </View>

            <Text style={styles.checkoutNote}>
              Alokasi tunai + QRIS harus sama dengan total pesanan. Kembalian = uang diterima −
              alokasi tunai. QRIS wajib diverifikasi manual.
            </Text>

            <BaseButton
              label="Verifikasi & konfirmasi pembayaran"
              onPress={handleSubmit}
              fullWidth
              size="lg"
              loading={submitting}
              disabled={submitting}
            />

            <TouchableOpacity onPress={() => setView('catalog')}>
              <Text style={styles.backToCatalog}>← Kembali ke katalog</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
      <>
      <View style={styles.paymentRow}>
        {['CASH', 'QRIS', 'SPLIT'].map((method) => (
          <TouchableOpacity
            key={method}
            style={[styles.paymentMethod, paymentMethod === method && styles.paymentMethodActive]}
            onPress={() => changePaymentMethod(method)}
          >
            <Text style={[
              styles.paymentMethodText,
              paymentMethod === method && styles.paymentMethodTextActive,
            ]}>
              {method === 'CASH' ? '💵' : method === 'QRIS' ? '📱' : '👥'} {method}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cart.length > 0 ? (
        <View style={styles.cartSummary}>
          <Text style={styles.cartLabel}>Keranjang ({cart.length} item)</Text>
          {cart.map((item) => (
            <View key={item.key} style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.product.name}</Text>
                <Text style={styles.cartItemVariant}>
                  {item.variant.name} — Rp {formatRupiah(item.variant.price)}
                </Text>
                {item.addOns.length > 0 && (
                  <Text style={styles.cartAddOns}>
                    Add-On: {item.addOns.map((a) => a.name).join(', ')}
                  </Text>
                )}
              </View>
              <View style={styles.cartItemQty}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.key, -1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.key, 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item.key)}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>Total</Text>
            <Text style={styles.cartTotalValue}>Rp {formatRupiah(total)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutAction} onPress={() => setView('checkout')}>
            <Text style={styles.checkoutActionText}>Lanjutkan →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <EmptyState
          icon={<Text style={styles.emptyIcon}>🛒</Text>}
          title="Keranjang kosong"
          subtitle="Pilih menu dari katalog untuk memulai pesanan."
        />
      )}

      <View style={styles.productGrid}>
      {catalog?.data?.products?.map((product) => (
        <Card key={product.id} style={styles.productCard}>
          <Text style={styles.productTitle}>{product.name}</Text>
          {product.variants?.map((variant) => (
            <TouchableOpacity
              key={variant.id}
              style={styles.variantRow}
              onPress={() => addToCart(product, variant)}
            >
              <Text style={styles.variantName}>{variant.name}</Text>
              <Text style={styles.variantPrice}>Rp {formatRupiah(variant.price)}</Text>
              <Text style={styles.pilihBadge}>PILIH</Text>
            </TouchableOpacity>
          ))}
        </Card>
      ))}
      </View>

      {catalog?.data?.addOns?.length > 0 && (
        <Card style={styles.addOnsCard}>
          <Text style={styles.addOnsTitle}>Topping / Add-On</Text>
          <Text style={styles.addOnsHint}>
            Pilih topping, lalu ketuk varian minuman untuk menambah pesanan.
          </Text>
          {catalog.data.addOns.map((a) => {
            const selected = selectedAddOns.some((s) => s.id === a.id);
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.addOnRow, selected && styles.addOnRowSelected]}
                onPress={() => toggleAddOn(a)}
              >
                <Text style={[styles.addOnName, selected && styles.addOnNameSelected]}>
                  {selected ? '✓ ' : ''}{a.name}
                </Text>
                <Text style={styles.addOnPrice}>Rp {formatRupiah(a.price)}</Text>
              </TouchableOpacity>
            );
          })}
        </Card>
      )}

      {cart.length > 0 && (
        <View style={styles.paymentSummary}>
          <Text style={styles.paymentLabel}>
            {paymentMethod === 'SPLIT' ? 'Nominal CASH (sisanya QRIS)' : 'Uang bayar'}
          </Text>
          <Input
            value={paidAmount}
            onChangeText={setPaidAmount}
            placeholder={paymentMethod === 'SPLIT' ? 'Nominal CASH' : 'Uang bayar'}
            keyboardType="numeric"
          />
          <View style={styles.paymentSummaryRow}>
            <Text style={styles.paymentSummaryLabel}>Total</Text>
            <Text style={styles.paymentSummaryValue}>Rp {formatRupiah(total)}</Text>
          </View>
          <View style={styles.paymentSummaryRow}>
            <Text style={styles.paymentSummaryLabel}>Kembali</Text>
            <Text style={styles.paymentSummaryValue}>Rp {formatRupiah(change)}</Text>
          </View>
          <BaseButton
            label="Selesaikan Pesanan"
            onPress={handleSubmit}
            fullWidth
            size="lg"
            loading={submitting}
            disabled={submitting}
          />
        </View>
      )}
      </>
      )}

    </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { ...typography.fontFamily.regular, fontSize: typography.sizes.base, color: colors.light.textSecondary },
  header: { gap: spacing.sm, justifyContent: 'center' },
  title: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.xxl, color: colors.light.textPrimary },
  subtitle: { ...typography.fontFamily.regular, fontSize: typography.sizes.base, color: colors.light.textSecondary },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  paymentMethod: { flex: 1, minWidth: 96, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface },
  paymentMethodActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  paymentMethodText: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.textSecondary },
  paymentMethodTextActive: { color: colors.light.onPrimary },
  cartSummary: { gap: spacing.md },
  cartLabel: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.textSecondary },
  cartItem: { flexDirection: 'row', gap: spacing.md, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  cartItemInfo: { flex: 1, gap: spacing.xs },
  cartItemName: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.base, color: colors.light.textPrimary },
  cartItemVariant: { ...typography.fontFamily.regular, fontSize: typography.sizes.sm, color: colors.light.textSecondary },
  cartAddOns: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.primary },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  qtyBtn: { width: 24, height: 24, borderRadius: radii.full, backgroundColor: colors.light.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 12, color: colors.light.textPrimary },
  qtyText: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.base, color: colors.light.textPrimary, minWidth: 20, textAlign: 'center' },
  removeBtn: { width: 20, height: 20, borderRadius: radii.full, backgroundColor: colors.light.dangerSurface, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { fontSize: 12, color: colors.light.danger },
  cartTotal: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.light.surfaceSecondary, borderRadius: radii.md },
  cartTotalLabel: { ...typography.fontFamily.medium, ...typography.weights.semibold, color: colors.light.textSecondary },
  cartTotalValue: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.lg, color: colors.light.textPrimary },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  productCard: { flex: 1, minWidth: 150, marginTop: spacing.sm, padding: spacing.sm },
  productTitle: { ...typography.fontFamily.semibold, ...typography.weights.semibold, fontSize: 9.2, color: colors.light.textPrimary, marginBottom: spacing.sm },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.light.surfaceSecondary },
  variantName: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary, flex: 1 },
  variantPrice: { ...typography.fontFamily.semibold, ...typography.weights.semibold, fontSize: 9, color: colors.light.primary },
  pilihBadge: { backgroundColor: colors.light.primary, color: colors.light.onPrimary, fontSize: 7, fontWeight: '700', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  checkoutAction: { backgroundColor: colors.light.maroon, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  checkoutActionText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 11, color: colors.light.surface },
  checkoutWrapper: { gap: spacing.md },
  checkoutSummary: { backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  checkoutSectionTitle: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 14, color: colors.light.textPrimary },
  unpaidBadge: { alignSelf: 'flex-start', backgroundColor: '#F4E6D2', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  unpaidBadgeText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.maroon },
  checkoutItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkoutItemName: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 11, color: colors.light.textPrimary },
  checkoutItemVariant: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary },
  checkoutItemPrice: { ...typography.fontFamily.medium, fontSize: 9, color: colors.light.maroon },
  checkoutDivider: { height: 1, backgroundColor: colors.light.border },
  checkoutTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutTotalLabel: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.textSecondary },
  checkoutTotalValue: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 16, color: colors.light.primary },
  checkoutPaymentCard: { backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: spacing.md, gap: spacing.md },
  checkoutHint: { ...typography.fontFamily.medium, fontSize: 9, color: colors.light.textSecondary },
  checkoutMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  checkoutMethod: { flex: 1, minWidth: 96, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: spacing.sm, gap: 2 },
  checkoutMethodActive: { borderColor: colors.light.primary, backgroundColor: colors.light.surfaceMuted },
  checkoutMethodTitle: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 11, color: colors.light.textPrimary },
  checkoutMethodDesc: { ...typography.fontFamily.regular, fontSize: 8, color: colors.light.textSecondary },
  checkoutMethodPilih: { alignSelf: 'flex-start', backgroundColor: colors.light.surfaceMuted, color: colors.light.maroon, fontSize: 7, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  checkoutMethodPilihActive: { backgroundColor: colors.light.primary, color: colors.light.surface },
  checkoutQrisAmount: { ...typography.fontFamily.medium, fontSize: 9, color: colors.light.maroon },
  changePanel: { backgroundColor: colors.light.surfaceMuted, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  changeLabel: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 8, color: colors.light.maroon },
  changeValue: { ...typography.fontFamily.medium, fontSize: 9, color: colors.light.maroon },
  checkoutNote: { ...typography.fontFamily.regular, fontSize: 8, color: colors.light.textSecondary },
  backToCatalog: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.primary, textAlign: 'center' },
  addOnsCard: { marginTop: spacing.sm },
  addOnsTitle: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.textPrimary },
  addOnsHint: { ...typography.fontFamily.regular, fontSize: typography.sizes.xs, color: colors.light.textSecondary, marginBottom: spacing.sm },
  addOnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border },
  addOnRowSelected: { borderColor: colors.light.primary, backgroundColor: colors.light.surfaceSecondary },
  addOnName: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.textPrimary },
  addOnNameSelected: { color: colors.light.primary },
  addOnPrice: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.primary },
  paymentSummary: { gap: spacing.md },
  paymentLabel: { ...typography.fontFamily.medium, ...typography.weights.semibold, fontSize: typography.sizes.sm, color: colors.light.textSecondary },
  paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  paymentSummaryLabel: { ...typography.fontFamily.medium, ...typography.weights.semibold, color: colors.light.textSecondary },
  paymentSummaryValue: { ...typography.fontFamily.medium, ...typography.weights.semibold, color: colors.light.textPrimary },
  emptyIcon: { fontSize: 40 },
  syncButton: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.light.warningSurface,
    alignItems: 'center',
  },
  syncText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
});
