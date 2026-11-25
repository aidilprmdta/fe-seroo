// ManagerAvailabilityScreen — Ketersediaan Menu Outlet (Manager)
// Figma (rinci): klik satu menu -> Toggle "Tersedia" -> PATCH
// /outlets/:outletId/catalog/products/:productId/availability
//
// Aturan bisnis (Rule 43):
//   - Produk tanpa record ketersediaan dianggap TIDAK TERSEDIA di kasir (POS menyembunyikan).
//   - Menyalakan toggle menciptakan record isAvailable=true.
//   - Mematikan toggle menciptakan record isAvailable=false.
//
// Hanya MANAGER / OWNER / OWNER_MITRA (peran outlet aktif) yang boleh mengakses.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { useResponsive } from '../../src/theme/responsive';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { createCatalogApi } from '../../src/api/catalog';
import Badge from '../../src/components/Badge';
import Card from '../../src/components/Card';
import Notice from '../../src/components/Notice';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';

export default function ManagerAvailabilityScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { isTablet } = useResponsive();
  const outletId = selection?.activeOutletId;

  const [products, setProducts] = useState([]);
  const [outletName, setOutletName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // product.id -> sedang menyimpan perubahan
  const [busy, setBusy] = useState(() => new Set());

  const catalogApi = useMemo(
    () => createCatalogApi({ request: apiRequest }),
    [apiRequest],
  );

  const load = useCallback(async () => {
    if (!outletId) return;
    setError(null);
    setProducts([]);
    try {
      const data = await catalogApi.getProductAvailability(outletId);
      setOutletName(data?.outletName || 'Outlet');
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      setError(err?.message || 'Gagal memuat ketersediaan menu.');
    } finally {
      setLoading(false);
    }
  }, [outletId, catalogApi]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(
    async (productId, wantOn) => {
      if (busy.has(productId)) return;
      setBusy((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
      try {
        const res = await catalogApi.setProductAvailability(
          outletId,
          productId,
          wantOn,
        );
        const nextAvailable = res?.data?.isAvailable ?? wantOn;
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? { ...p, isAvailable: nextAvailable, hasAvailabilityRecord: true }
              : p,
          ),
        );
      } catch (err) {
        setError(err?.message || 'Gagal mengubah ketersediaan menu.');
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [outletId, catalogApi, busy],
  );

  const getStatusLabel = (product) => {
    if (!product.hasAvailabilityRecord) {
      return 'Belum diatur';
    }
    return product.isAvailable ? 'Tersedia' : 'Tidak Tersedia';
  };

  const getStatusVariant = (product) => {
    if (!product.hasAvailabilityRecord) return 'warning';
    return product.isAvailable ? 'success' : 'danger';
  };

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ketersediaan Menu Outlet</Text>
          <Text style={styles.subtitle}>
            {outletName
              ? `Outlet: ${outletName}`
              : 'Pilih outlet terlebih dahulu di layar sebelumnya.'}
          </Text>
        </View>

        {error ? (
          <Notice message={error} type="error" />
        ) : (
          <View style={styles.legend}>
            <Text style={styles.legendText}>
              • Produk tanpa record ketersediaan → dianggap{' '}
              <Text style={styles.legendEmphasis}> tidak tersedia</Text> di kasir.
              • Menyalakan tombol membuat record{' '}
              <Text style={styles.legendEmphasis}> isAvailable=true</Text>; mematikan
              membuat{' '}
              <Text style={styles.legendEmphasis}> isAvailable=false</Text>.
            </Text>
          </View>
        )}

        {!outletId ? (
          <EmptyState
            icon={<Text style={styles.emptyIcon}>🏪</Text>}
            title="Belum ada outlet terpilih"
            subtitle="Pilih outlet terlebih dahulu pada layar sebelumnya."
          />
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={styles.loadingText}>Memuat ketersediaan menu…</Text>
          </View>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.emptyIcon}>📋</Text>}
            title="Tidak ada menu"
            subtitle="Produk katalog belum tersedia untuk outlet ini."
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Daftar Menu</Text>
            {isTablet ? (
              <View style={styles.tabletList}>
                {products.map((product) => (
                  <View key={product.id} style={styles.tabletRow}>
                    <View style={styles.tabletLeft}>
                      <Text style={styles.tabletName}>{product.name}</Text>
                      <Text style={styles.tabletMeta}>
                        {product.category}
                        {product.variants.length ? ` · ${product.variants.length} varian` : ''}
                      </Text>
                    </View>
                    <View style={styles.tabletRight}>
                      <Badge
                        variant={getStatusVariant(product)}
                        label={getStatusLabel(product)}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.tabletToggle, product.isAvailable && styles.tabletToggleOn]}
                      onPress={() => handleToggle(product.id, !product.isAvailable)}
                      disabled={busy.has(product.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        product.isAvailable
                          ? `Matikan menu ${product.name} di outlet ini`
                          : `Aktifkan menu ${product.name} di outlet ini`
                      }
                    >
                      <Text style={[styles.tabletDot, product.isAvailable && styles.tabletDotOn]}>●</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              products.map((product) => (
                <Card key={product.id} style={styles.productCard}>
                  <View style={styles.productRow}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>
                        {product.category}
                        {product.variants.length ? ` · ${product.variants.length} varian` : ''}
                      </Text>
                    </View>
                    <View style={styles.productActions}>
                      <Badge
                        variant={getStatusVariant(product)}
                        label={getStatusLabel(product)}
                      />
                      <TouchableOpacity
                        style={[styles.toggle, product.isAvailable && styles.toggleOn]}
                        onPress={() => handleToggle(product.id, !product.isAvailable)}
                        disabled={busy.has(product.id)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          product.isAvailable
                            ? `Matikan menu ${product.name} di outlet ini`
                            : `Aktifkan menu ${product.name} di outlet ini`
                        }
                      >
                        <Text style={[styles.dot, product.isAvailable && styles.dotOn]}>●</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.fontFamily.display,
    fontSize: 26,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    lineHeight: 18,
  },
  legend: {
    marginBottom: spacing.md,
  },
  legendText: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textTertiary,
    lineHeight: 16,
  },
  legendEmphasis: {
    fontWeight: '600',
    color: colors.light.primary,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.fontFamily.medium,
    fontSize: 13,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
  },
  emptyIcon: {
    fontSize: 40,
  },
  tabletList: {
    gap: spacing.md,
  },
  tabletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light.divider,
  },
  tabletLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  tabletName: {
    ...typography.fontFamily.medium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  tabletMeta: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textTertiary,
  },
  tabletRight: {
    alignItems: 'flex-end',
  },
  tabletToggle: {
    width: 44,
    height: 26,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletToggleOn: {
    backgroundColor: colors.light.success,
    borderColor: colors.light.success,
  },
  tabletDot: {
    color: colors.light.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabletDotOn: {
    color: '#FFF',
  },
  productCard: {
    marginBottom: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  productInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  productName: {
    ...typography.fontFamily.medium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  productMeta: {
    ...typography.fontFamily.regular,
    fontSize: 11,
    color: colors.light.textTertiary,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleOn: {
    backgroundColor: colors.light.success,
    borderColor: colors.light.success,
  },
  dot: {
    color: colors.light.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  dotOn: {
    color: '#FFF',
  },
});
