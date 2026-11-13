import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import {
  buildOrderPayload,
  calculateCartTotalMinor,
  canReachInternet,
  classifyOutboxFailure,
  formatMoney,
  orderSyncLabel,
  retryDelayMs,
  toMinorUnits,
} from "../../src/pos/cart";
import { createPosApi } from "../../src/pos/api";
import { posOutbox } from "../../src/pos/nativeOutbox";
import { colors, spacing } from "../../src/theme/tokens";
import { ROUTES } from "../../src/auth/routePolicy";

function formatPrice(price) {
  return formatMoney(toMinorUnits(price));
}

function recordSummary(record) {
  if (record.serverOrder) {
    return `No. ${record.serverOrder.orderNumber} · ${formatPrice(record.serverOrder.total)}`;
  }
  const itemCount = record.payload.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  return `${itemCount} minuman · ${record.payload.paymentMethod}`;
}

export default function PosScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = selection.activeOutletId;
  const api = useMemo(() => createPosApi({ request: apiRequest }), [apiRequest]);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [networkAvailable, setNetworkAvailable] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [addOnQuantities, setAddOnQuantities] = useState({});
  const [builderQuantity, setBuilderQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const submittingRef = useRef(false);
  const onlineRef = useRef(false);
  const wideLayout = width >= 900;

  const refreshRecords = useCallback(async () => {
    await posOutbox.initialize();
    const recent = await posOutbox.listRecent({
      ownerUserId: user.id,
      outletId,
    });
    setRecords(recent);
  }, [outletId, user.id]);

  const loadCatalog = useCallback(async () => {
    if (!onlineRef.current) {
      setCatalogLoading(false);
      setError((current) =>
        current ?? "Katalog membutuhkan koneksi internet untuk dimuat.",
      );
      return;
    }

    setCatalogLoading(true);
    try {
      setCatalog(await api.getCatalog(outletId));
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setCatalogLoading(false);
    }
  }, [api, outletId]);

  const syncPending = useCallback(async (force = false) => {
    if (!onlineRef.current || syncingRef.current) {
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    try {
      await posOutbox.initialize();
      const pending = await posOutbox.listPending({
        ownerUserId: user.id,
        outletId,
        force,
      });

      for (const record of pending) {
        await posOutbox.setStatus({
          clientTransactionId: record.clientTransactionId,
          ownerUserId: user.id,
          outletId,
          status: "syncing",
        });
        try {
          const result = await api.createOrder(outletId, record.payload);
          await posOutbox.setStatus({
            clientTransactionId: record.clientTransactionId,
            ownerUserId: user.id,
            outletId,
            status: "synced",
            serverOrder: result.order,
          });
        } catch (syncError) {
          const status = classifyOutboxFailure(syncError);
          await posOutbox.setStatus({
            clientTransactionId: record.clientTransactionId,
            ownerUserId: user.id,
            outletId,
            status,
            errorCode: syncError.code ?? "SYNC_FAILED",
            retryCount:
              status === "retryable_failure"
                ? (record.retryCount ?? 0) + 1
                : record.retryCount,
            nextRetryAt:
              status === "retryable_failure"
                ? new Date(
                    Date.now() + retryDelayMs(record.retryCount ?? 0),
                  ).toISOString()
                : null,
          });
          if (syncError.status === 401 || syncError.status === 403) {
            setError(syncError.message);
            break;
          }
        }
      }

      await refreshRecords();
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [api, outletId, refreshRecords, user.id]);

  const handleNetworkState = useCallback(
    async (networkState) => {
      const available = canReachInternet(networkState);
      onlineRef.current = available;
      setNetworkAvailable(available);
      if (available) {
        await loadCatalog();
        await syncPending();
      }
    },
    [loadCatalog, syncPending],
  );

  useEffect(() => {
    let active = true;
    posOutbox
      .initialize()
      .then(() => refreshRecords())
      .catch((storageError) => {
        if (active) setError(storageError.message);
      });

    Network.getNetworkStateAsync()
      .then((networkState) => active && handleNetworkState(networkState))
      .catch(() => {
        if (active) {
          onlineRef.current = false;
          setNetworkAvailable(false);
          setCatalogLoading(false);
          setError("Status jaringan tidak dapat diperiksa. Coba muat ulang.");
        }
      });

    const subscription = Network.addNetworkStateListener((networkState) => {
      if (active) handleNetworkState(networkState);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleNetworkState, refreshRecords]);

  const selectedProduct = catalog?.products.find(
    (product) => product.id === selectedProductId,
  );
  const selectedVariant =
    selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ??
    selectedProduct?.variants[0] ??
    null;
  const cartTotal = calculateCartTotalMinor(cart);

  const chooseProduct = (product) => {
    setSelectedProductId(product.id);
    setSelectedVariantId(product.variants[0]?.id ?? null);
    setAddOnQuantities({});
    setBuilderQuantity(1);
  };

  const changeAddOnQuantity = (addOnId, delta) => {
    setAddOnQuantities((current) => {
      const next = Math.max(0, Math.min(10, (current[addOnId] ?? 0) + delta));
      return { ...current, [addOnId]: next };
    });
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) return;
    const addOns = (catalog?.addOns ?? [])
      .filter((addOn) => (addOnQuantities[addOn.id] ?? 0) > 0)
      .map((addOn) => ({
        addOnId: addOn.id,
        name: addOn.name,
        unitPrice: addOn.price,
        quantity: addOnQuantities[addOn.id],
      }));
    const key = [
      selectedVariant.id,
      ...addOns
        .map((addOn) => `${addOn.addOnId}:${addOn.quantity}`)
        .sort(),
    ].join("|");
    const existing = cart.find((item) => item.key === key);
    if (existing && existing.quantity + builderQuantity > 99) {
      setError("Jumlah item maksimal 99.");
      return;
    }

    setCart((current) => {
      const found = current.find((item) => item.key === key);
      if (found) {
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + builderQuantity }
            : item,
        );
      }
      return [
        ...current,
        {
          key,
          productVariantId: selectedVariant.id,
          productName: selectedProduct.name,
          variantName: selectedVariant.name,
          variantPrice: selectedVariant.price,
          quantity: builderQuantity,
          addOns,
        },
      ];
    });
    setError(null);
    setAddOnQuantities({});
    setBuilderQuantity(1);
  };

  const changeCartQuantity = (key, delta) => {
    setCart((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              quantity: Math.max(1, Math.min(99, item.quantity + delta)),
            }
          : item,
      ),
    );
  };

  const removeFromCart = (key) => {
    setCart((current) => current.filter((item) => item.key !== key));
  };

  const submitOrder = async () => {
    if (cart.length === 0 || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      let networkState = null;
      try {
        networkState = await Network.getNetworkStateAsync();
      } catch {
        networkState = null;
      }
      const online = canReachInternet(networkState);
      onlineRef.current = online;
      setNetworkAvailable(online);

      const payload = buildOrderPayload({
        clientTransactionId: Crypto.randomUUID(),
        paymentMethod,
        recordedOffline: !online,
        cart,
      });
      await posOutbox.enqueue({
        ownerUserId: user.id,
        outletId,
        payload,
      });
      setCart([]);
      setAddOnQuantities({});
      await refreshRecords();

      if (online) {
        await syncPending();
      } else {
        setNotice(
          paymentMethod === "QRIS"
            ? "Transaksi disimpan di perangkat, belum dikirim. QRIS belum terverifikasi."
            : "Transaksi disimpan di perangkat, belum dikirim ke server.",
        );
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const selectedAddOnCount = (catalog?.addOns ?? []).filter(
    (addOn) => (addOnQuantities[addOn.id] ?? 0) > 0,
  ).length;

  return (
    <ScreenFrame>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.eyebrow}>Kasir · {selection.activeRole}</Text>
            <Text style={styles.title}>POS</Text>
            <Text style={styles.subtitle}>
              {user.memberships.find((item) => item.outletId === outletId)
                ?.outletName ?? "Outlet aktif"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Text style={styles.connection}>
              {networkAvailable ? "Terhubung" : "Offline"}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(ROUTES.crew)}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>Kembali</Text>
            </Pressable>
          </View>
        </View>

        <Notice message={error} />
        <Notice message={notice} type="info" />

        <View style={[styles.columns, wideLayout && styles.wideColumns]}>
          <ScrollView
            style={[styles.catalogPane, wideLayout && styles.wideCatalogPane]}
            contentContainerStyle={styles.paneContent}
          >
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Katalog</Text>
              <Pressable
                accessibilityRole="button"
                onPress={loadCatalog}
                style={styles.smallAction}
              >
                <Text style={styles.smallActionText}>Muat ulang</Text>
              </Pressable>
            </View>
            {catalogLoading ? (
              <Text style={styles.helper}>Memuat katalog dari server...</Text>
            ) : null}
            {!catalogLoading && !catalog?.products?.length ? (
              <Text style={styles.empty}>
                {networkAvailable
                  ? "Belum ada produk aktif di katalog outlet."
                  : "Katalog belum tersedia. Sambungkan ke internet untuk memuat produk."}
              </Text>
            ) : null}

            <View style={styles.productGrid}>
              {(catalog?.products ?? []).map((product) => (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: product.id === selectedProductId,
                  }}
                  onPress={() => chooseProduct(product)}
                  style={[
                    styles.productTile,
                    product.id === selectedProductId && styles.selectedTile,
                  ]}
                >
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.variants.length} ukuran tersedia
                  </Text>
                </Pressable>
              ))}
            </View>

            {selectedProduct ? (
              <View style={styles.builder}>
                <Text style={styles.sectionTitle}>Pilihan pesanan</Text>
                <Text style={styles.label}>Ukuran</Text>
                <View style={styles.optionRow}>
                  {selectedProduct.variants.map((variant) => (
                    <Pressable
                      key={variant.id}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: selectedVariant?.id === variant.id,
                      }}
                      onPress={() => setSelectedVariantId(variant.id)}
                      style={[
                        styles.optionButton,
                        selectedVariant?.id === variant.id &&
                          styles.selectedOption,
                      ]}
                    >
                      <Text style={styles.optionName}>{variant.name}</Text>
                      <Text style={styles.optionPrice}>
                        {formatPrice(variant.price)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Topping / add-on</Text>
                {(catalog?.addOns ?? []).length === 0 ? (
                  <Text style={styles.helper}>Tidak ada add-on aktif.</Text>
                ) : (
                  <View style={styles.addOnList}>
                    {(catalog?.addOns ?? []).map((addOn) => {
                      const quantity = addOnQuantities[addOn.id] ?? 0;
                      return (
                        <View key={addOn.id} style={styles.addOnRow}>
                          <View style={styles.addOnInfo}>
                            <Text style={styles.addOnName}>{addOn.name}</Text>
                            <Text style={styles.helper}>
                              {formatPrice(addOn.price)}
                            </Text>
                          </View>
                          <View style={styles.stepper}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Kurangi ${addOn.name}`}
                              onPress={() => changeAddOnQuantity(addOn.id, -1)}
                              style={styles.stepButton}
                            >
                              <Text style={styles.stepText}>−</Text>
                            </Pressable>
                            <Text style={styles.stepValue}>{quantity}</Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Tambah ${addOn.name}`}
                              onPress={() => changeAddOnQuantity(addOn.id, 1)}
                              style={styles.stepButton}
                            >
                              <Text style={styles.stepText}>+</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.builderFooter}>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Kurangi jumlah produk"
                      onPress={() =>
                        setBuilderQuantity((quantity) =>
                          Math.max(1, quantity - 1),
                        )
                      }
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{builderQuantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Tambah jumlah produk"
                      onPress={() =>
                        setBuilderQuantity((quantity) =>
                          Math.min(99, quantity + 1),
                        )
                      }
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                  <PrimaryButton
                    label={`Tambah ke keranjang${selectedAddOnCount ? ` · ${selectedAddOnCount} topping` : ""}`}
                    onPress={addToCart}
                    disabled={!selectedVariant}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>

          <ScrollView
            style={[styles.cartPane, wideLayout && styles.wideCartPane]}
            contentContainerStyle={styles.paneContent}
          >
            <Text style={styles.sectionTitle}>Keranjang</Text>
            {cart.length === 0 ? (
              <Text style={styles.empty}>Pilih produk untuk memulai transaksi.</Text>
            ) : (
              cart.map((item) => {
                const addOnTotal = item.addOns.reduce(
                  (total, addOn) =>
                    total +
                    toMinorUnits(addOn.unitPrice) * addOn.quantity,
                  0,
                );
                const lineTotal =
                  (toMinorUnits(item.variantPrice) + addOnTotal) *
                  item.quantity;
                return (
                  <View key={item.key} style={styles.cartItem}>
                    <View style={styles.cartItemHeading}>
                      <View style={styles.cartItemText}>
                        <Text style={styles.cartName}>{item.productName}</Text>
                        <Text style={styles.helper}>
                          {item.variantName} · {formatPrice(item.variantPrice)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus ${item.productName} dari keranjang`}
                        onPress={() => removeFromCart(item.key)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeText}>Hapus</Text>
                      </Pressable>
                    </View>
                    {item.addOns.map((addOn) => (
                      <Text key={addOn.addOnId} style={styles.helper}>
                        + {addOn.name} × {addOn.quantity}
                      </Text>
                    ))}
                    <View style={styles.cartItemFooter}>
                      <View style={styles.stepper}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Kurangi jumlah ${item.productName}`}
                          onPress={() => changeCartQuantity(item.key, -1)}
                          style={styles.stepButton}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{item.quantity}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Tambah jumlah ${item.productName}`}
                          onPress={() => changeCartQuantity(item.key, 1)}
                          style={styles.stepButton}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.lineTotal}>
                        {formatMoney(lineTotal)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.checkout}>
              <Text style={styles.label}>Metode pembayaran</Text>
              <View style={styles.paymentRow}>
                {["CASH", "QRIS"].map((method) => (
                  <Pressable
                    key={method}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: paymentMethod === method }}
                    onPress={() => setPaymentMethod(method)}
                    style={[
                      styles.paymentButton,
                      paymentMethod === method && styles.selectedOption,
                    ]}
                  >
                    <Text style={styles.optionName}>
                      {method === "CASH" ? "Cash" : "QRIS"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Perkiraan total</Text>
                <Text style={styles.totalValue}>{formatMoney(cartTotal)}</Text>
              </View>
              <Text style={styles.helper}>
                Total final dihitung dan dikonfirmasi oleh server.
              </Text>
              {paymentMethod === "QRIS" ? (
                <Text style={styles.helper}>
                  QRIS hanya dicatat sebagai metode pembayaran, bukan bukti
                  settlement.
                </Text>
              ) : null}
              <PrimaryButton
                label="Simpan transaksi"
                onPress={submitOrder}
                disabled={cart.length === 0}
                loading={submitting}
              />
            </View>
          </ScrollView>
        </View>

        <View style={styles.queueHeader}>
          <View style={styles.queueTitleGroup}>
            <Text style={styles.sectionTitle}>Transaksi dan sinkronisasi</Text>
            <Text style={styles.helper}>
              Status lokal bukan konfirmasi server.
            </Text>
          </View>
          <PrimaryButton
            label={syncing ? "Menyinkronkan..." : "Sinkronkan antrean"}
            secondary
            onPress={() => syncPending(true)}
            disabled={!networkAvailable || syncing}
            loading={syncing}
          />
        </View>
        {records.length === 0 ? (
          <Text style={styles.empty}>Belum ada transaksi pada outlet ini.</Text>
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={styles.recordList}
            showsHorizontalScrollIndicator={false}
          >
            {records.map((record) => (
              <View
                key={record.clientTransactionId}
                style={styles.recordCard}
              >
                <Text style={styles.recordStatus}>{orderSyncLabel(record)}</Text>
                <Text style={styles.recordSummary}>{recordSummary(record)}</Text>
                {record.errorCode ? (
                  <Text style={styles.helper}>Kode: {record.errorCode}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  headerTitle: {
    gap: 2,
  },
  headerActions: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  connection: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  headerButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  headerButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  columns: {
    flex: 1,
    gap: spacing.md,
  },
  wideColumns: {
    flexDirection: "row",
  },
  catalogPane: {
    flex: 1,
    minHeight: 300,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  wideCatalogPane: {
    flex: 1.15,
  },
  cartPane: {
    flex: 1,
    minHeight: 260,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  wideCartPane: {
    flex: 0.85,
  },
  paneContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "800",
  },
  smallAction: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  smallActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.sm,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  productTile: {
    minHeight: 78,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: "44%",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  selectedTile: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  productName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  productMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  builder: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionButton: {
    minHeight: 56,
    minWidth: 120,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  optionName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  optionPrice: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  addOnList: {
    gap: spacing.xs,
  },
  addOnRow: {
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  addOnInfo: {
    flex: 1,
    gap: 2,
  },
  addOnName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  stepButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  stepValue: {
    minWidth: 30,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  builderFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  cartItem: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cartItemText: {
    flex: 1,
    gap: 2,
  },
  cartName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  removeButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  removeText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  cartItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineTotal: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  checkout: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  paymentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  paymentButton: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  totalValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  queueTitleGroup: {
    flex: 1,
    gap: 2,
  },
  recordList: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  recordCard: {
    width: 260,
    minHeight: 84,
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recordStatus: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  recordSummary: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
