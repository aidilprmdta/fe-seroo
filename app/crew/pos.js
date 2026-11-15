import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [paymentMode, setPaymentMode] = useState("SINGLE"); // "SINGLE" | "SPLIT"
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [splitCash, setSplitCash] = useState("");
  const [splitQris, setSplitQris] = useState("");
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [cancellingRecord, setCancellingRecord] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRecordWaste, setCancelRecordWaste] = useState(true);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const syncingRef = useRef(false);
  const submittingRef = useRef(false);
  const onlineRef = useRef(false);
  const wideLayout = width >= 900;

  const handleVerifyQris = async (record) => {
    if (!record.serverOrder?.id || verifyingId) return;
    setVerifyingId(record.serverOrder.id);
    setError(null);
    try {
      const result = await api.verifyQris(outletId, record.serverOrder.id);
      await posOutbox.setStatus({
        clientTransactionId: record.clientTransactionId,
        ownerUserId: user.id,
        outletId,
        status: "synced",
        serverOrder: result.order,
      });
      await refreshRecords();
      setNotice(
        `Pembayaran QRIS No. ${record.serverOrder.orderNumber} berhasil diverifikasi (Lunas).`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingRecord?.serverOrder?.id || cancelSubmitting) return;
    if (cancelReason.trim().length < 5) {
      setError("Alasan pembatalan minimal 5 karakter.");
      return;
    }
    setCancelSubmitting(true);
    setError(null);
    try {
      const result = await api.cancelOrder(
        outletId,
        cancellingRecord.serverOrder.id,
        {
          reason: cancelReason.trim(),
          recordWaste: cancelRecordWaste,
        },
      );
      await posOutbox.setStatus({
        clientTransactionId: cancellingRecord.clientTransactionId,
        ownerUserId: user.id,
        outletId,
        status: "synced",
        serverOrder: result.order,
      });
      await refreshRecords();
      setCancellingRecord(null);
      setCancelReason("");
      setCancelRecordWaste(true);
      setNotice(
        `Pesanan No. ${result.order.orderNumber} berhasil dibatalkan (${cancelRecordWaste ? "dicatat waste" : "stok dikembalikan"}).`,
      );
    } catch (err) {
      setError(err.message || "Gagal membatalkan pesanan.");
    } finally {
      setCancelSubmitting(false);
    }
  };

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
          setReceiptOrder(result.order);
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

      let orderPayments = undefined;
      let orderPaymentMethod = paymentMethod;

      if (paymentMode === "SPLIT") {
        const cartTotalRupiah = cartTotal / 100;
        const splitCashNum = Number(splitCash) || 0;
        const splitQrisNum = Number(splitQris) || 0;
        const splitTotalPaid = splitCashNum + splitQrisNum;
        const splitDiff = splitTotalPaid - cartTotalRupiah;

        if (splitCashNum <= 0 || splitQrisNum <= 0 || splitDiff !== 0) {
          setError(
            `Total pembayaran (Rp ${splitTotalPaid.toLocaleString("id-ID")}) harus sama dengan total tagihan (Rp ${cartTotalRupiah.toLocaleString("id-ID")}). ${
              splitDiff < 0
                ? `Kurang Rp ${Math.abs(splitDiff).toLocaleString("id-ID")}. Status: belum lunas.`
                : `Lebih Rp ${splitDiff.toLocaleString("id-ID")}.`
            }`,
          );
          submittingRef.current = false;
          setSubmitting(false);
          return;
        }

        orderPaymentMethod = "SPLIT";
        orderPayments = [
          { paymentMethod: "CASH", amount: splitCashNum.toFixed(2) },
          { paymentMethod: "QRIS", amount: splitQrisNum.toFixed(2) },
        ];
      }

      const payload = buildOrderPayload({
        clientTransactionId: Crypto.randomUUID(),
        paymentMethod: orderPaymentMethod,
        payments: orderPayments,
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
      setSplitCash("");
      setSplitQris("");
      setPaymentMode("SINGLE");
      await refreshRecords();

      if (online) {
        await syncPending();
        if (orderPaymentMethod === "QRIS" || orderPaymentMethod === "SPLIT") {
          setNotice(
            "Transaksi berhasil dikirim. Pembayaran QRIS belum terverifikasi (periksa mutasi merchant sebelum menandai verifikasi).",
          );
        }
      } else {
        setNotice(
          orderPaymentMethod === "QRIS" || orderPaymentMethod === "SPLIT"
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
                {[
                  { key: "CASH", label: "Cash" },
                  { key: "QRIS", label: "QRIS" },
                  { key: "SPLIT", label: "Split" },
                ].map((opt) => {
                  const isActive =
                    opt.key === "SPLIT"
                      ? paymentMode === "SPLIT"
                      : paymentMode === "SINGLE" && paymentMethod === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={
                        opt.key === "SPLIT"
                          ? "Split: bayar sebagian Cash sebagian QRIS"
                          : `Bayar dengan ${opt.label}`
                      }
                      onPress={() => {
                        if (opt.key === "SPLIT") {
                          setPaymentMode("SPLIT");
                          setSplitCash("");
                          setSplitQris("");
                        } else {
                          setPaymentMode("SINGLE");
                          setPaymentMethod(opt.key);
                          setSplitCash("");
                          setSplitQris("");
                        }
                      }}
                      style={[
                        styles.paymentButton,
                        isActive && styles.selectedOption,
                      ]}
                    >
                      <Text style={styles.optionName}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {paymentMode === "SPLIT" ? (() => {
                const cartTotalRupiah = cartTotal / 100;
                const cashNum = Number(splitCash) || 0;
                const qrisNum = Number(splitQris) || 0;
                const paid = cashNum + qrisNum;
                const diff = paid - cartTotalRupiah;
                const isExact = cashNum > 0 && qrisNum > 0 && diff === 0;
                const diffLabel =
                  cashNum > 0 && qrisNum > 0
                    ? diff < 0
                      ? `Kurang Rp ${Math.abs(diff).toLocaleString("id-ID")} · belum lunas`
                      : diff > 0
                        ? `Lebih Rp ${diff.toLocaleString("id-ID")}`
                        : "✓ Lunas"
                    : null;

                return (
                  <View style={styles.splitPanel}>
                    <View style={styles.splitField}>
                      <Text style={styles.label}>Cash (Rp)</Text>
                      <TextInput
                        style={styles.splitInput}
                        keyboardType="numeric"
                        returnKeyType="next"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        value={splitCash}
                        onChangeText={(text) =>
                          setSplitCash(text.replace(/[^0-9]/g, ""))
                        }
                        accessibilityLabel="Nominal Cash untuk split payment"
                      />
                    </View>
                    <View style={styles.splitField}>
                      <Text style={styles.label}>QRIS (Rp)</Text>
                      <TextInput
                        style={styles.splitInput}
                        keyboardType="numeric"
                        returnKeyType="done"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        value={splitQris}
                        onChangeText={(text) =>
                          setSplitQris(text.replace(/[^0-9]/g, ""))
                        }
                        accessibilityLabel="Nominal QRIS untuk split payment"
                      />
                    </View>
                    {diffLabel ? (
                      <Text
                        style={[
                          styles.splitStatus,
                          isExact
                            ? styles.splitStatusOk
                            : styles.splitStatusErr,
                        ]}
                      >
                        {diffLabel}
                      </Text>
                    ) : null}
                    <Text style={styles.helper}>
                      QRIS belum terverifikasi sebagai bukti settlement.
                    </Text>
                  </View>
                );
              })() : null}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Perkiraan total</Text>
                <Text style={styles.totalValue}>{formatMoney(cartTotal)}</Text>
              </View>
              <Text style={styles.helper}>
                Total final dihitung dan dikonfirmasi oleh server.
              </Text>
              {paymentMode === "SINGLE" && paymentMethod === "QRIS" ? (
                <Text style={styles.helper}>
                  QRIS hanya dicatat sebagai metode pembayaran, bukan bukti
                  settlement.
                </Text>
              ) : null}
              <PrimaryButton
                label="Simpan transaksi"
                onPress={submitOrder}
                disabled={
                  cart.length === 0 ||
                  (paymentMode === "SPLIT" &&
                    (Number(splitCash) <= 0 || Number(splitQris) <= 0))
                }
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
                {record.serverOrder ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setReceiptOrder(record.serverOrder)}
                    style={styles.receiptButton}
                  >
                    <Text style={styles.receiptButtonText}>Lihat struk</Text>
                  </Pressable>
                ) : null}
                {record.errorCode ? (
                  <Text style={styles.helper}>Kode: {record.errorCode}</Text>
                ) : null}

                {record.serverOrder?.paymentStatus === "PENDING_RECONCILIATION" ? (
                  <View style={styles.verifyActionGroup}>
                    <Text style={styles.pendingQrisBadge}>
                      ⚠️ QRIS Belum Verifikasi
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Verifikasi pembayaran QRIS transaksi ${record.serverOrder.orderNumber}`}
                      onPress={() => handleVerifyQris(record)}
                      disabled={verifyingId === record.serverOrder.id}
                      style={[
                        styles.verifyButton,
                        verifyingId === record.serverOrder.id &&
                          styles.verifyButtonDisabled,
                      ]}
                    >
                      <Text style={styles.verifyButtonText}>
                        {verifyingId === record.serverOrder.id
                          ? "Memverifikasi..."
                          : "Tandai Terverifikasi"}
                      </Text>
                    </Pressable>
                  </View>
                ) : record.serverOrder?.verifiedAt ? (
                  <Text style={styles.verifiedBadge}>✓ QRIS Terverifikasi</Text>
                ) : null}

                {record.serverOrder?.status === "CANCELLED" ? (
                  <View style={styles.cancelledBadgeBox}>
                    <Text style={styles.cancelledBadge}>🔴 Dibatalkan</Text>
                    {record.serverOrder.cancellationReason ? (
                      <Text style={styles.cancelledReasonText} numberOfLines={2}>
                        {record.serverOrder.cancellationReason}
                      </Text>
                    ) : null}
                  </View>
                ) : record.serverOrder ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Batalkan pesanan ${record.serverOrder.orderNumber}`}
                    onPress={() => {
                      setCancellingRecord(record);
                      setCancelReason("");
                      setCancelRecordWaste(true);
                    }}
                    style={styles.cancelOrderButton}
                  >
                    <Text style={styles.cancelOrderButtonText}>Batalkan Pesanan</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={Boolean(receiptOrder)}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <Text style={styles.receiptBrand}>Teh Tarik Seroo</Text>
            <Text style={styles.receiptTitle}>Struk Transaksi</Text>
            <Text style={styles.receiptMeta}>No. {receiptOrder?.orderNumber}</Text>
            <Text style={styles.receiptMeta}>{receiptOrder?.createdAt ?? "-"}</Text>
            <View style={styles.receiptDivider} />
            {(receiptOrder?.items ?? []).map((item) => (
              <View key={item.id} style={styles.receiptLine}>
                <Text style={styles.receiptItem}>
                  {item.productName} · {item.variantName} x{item.quantity}
                </Text>
                <Text style={styles.receiptAmount}>{formatMoney(toMinorUnits(item.subtotal))}</Text>
              </View>
            ))}
            <View style={styles.receiptDivider} />
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Total</Text>
              <Text style={styles.receiptTotal}>{formatMoney(toMinorUnits(receiptOrder?.total))}</Text>
            </View>
            <Text style={styles.receiptMeta}>
              Pembayaran: {receiptOrder?.paymentMethod ?? "-"}
            </Text>
            {receiptOrder?.paymentStatus === "PENDING_RECONCILIATION" ? (
              <Text style={styles.receiptWarning}>QRIS belum terverifikasi</Text>
            ) : null}
            <PrimaryButton label="Tutup" secondary onPress={() => setReceiptOrder(null)} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(cancellingRecord)}
        transparent
        animationType="fade"
        onRequestClose={() => setCancellingRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Batalkan Pesanan #{cancellingRecord?.serverOrder?.orderNumber}
            </Text>
            <Text style={styles.modalSubtitle}>
              Transaksi akan ditandai CANCELLED dan status pembayaran menjadi REFUNDED.
            </Text>

            <Text style={styles.inputLabel}>Alasan Pembatalan (min. 5 karakter):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contoh: Pelanggan membatalkan pesanan"
              placeholderTextColor={colors.muted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              maxLength={255}
            />

            <Text style={styles.inputLabel}>Status Minuman:</Text>
            <View style={styles.wasteToggleRow}>
              <Pressable
                onPress={() => setCancelRecordWaste(true)}
                style={[
                  styles.wasteOptionBtn,
                  cancelRecordWaste && styles.wasteOptionBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.wasteOptionText,
                    cancelRecordWaste && styles.wasteOptionTextActive,
                  ]}
                >
                  🗑️ Minuman Sudah Dibuat (Catat Waste)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCancelRecordWaste(false)}
                style={[
                  styles.wasteOptionBtn,
                  !cancelRecordWaste && styles.wasteOptionBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.wasteOptionText,
                    !cancelRecordWaste && styles.wasteOptionTextActive,
                  ]}
                >
                  ↩️ Belum Dibuat (Kembalikan Stok Bahan)
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setCancellingRecord(null);
                  setCancelReason("");
                }}
                disabled={cancelSubmitting}
              >
                <Text style={styles.modalCancelBtnText}>Tutup</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalConfirmBtn,
                  (cancelReason.trim().length < 5 || cancelSubmitting) &&
                    styles.modalConfirmBtnDisabled,
                ]}
                onPress={handleCancelOrder}
                disabled={cancelReason.trim().length < 5 || cancelSubmitting}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {cancelSubmitting ? "Memproses..." : "Konfirmasi Batal"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  splitPanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  splitField: {
    gap: spacing.xs,
  },
  splitInput: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  splitStatus: {
    fontSize: 14,
    fontWeight: "700",
    paddingTop: spacing.xs,
  },
  splitStatusOk: {
    color: colors.success ?? "#2d6a4f",
  },
  splitStatusErr: {
    color: colors.danger,
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
    width: 280,
    minHeight: 96,
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  verifyActionGroup: {
    gap: 4,
    marginTop: 4,
  },
  pendingQrisBadge: {
    color: colors.warning ?? "#b08968",
    fontSize: 12,
    fontWeight: "700",
  },
  verifyButton: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  verifiedBadge: {
    color: colors.success ?? "#2d6a4f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
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
  receiptButton: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  receiptButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  cancelOrderButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    backgroundColor: "#fff0f0",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f5c2c2",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  cancelOrderButtonText: {
    color: colors.danger ?? "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelledBadgeBox: {
    marginTop: 4,
    padding: 6,
    backgroundColor: "#fff0f0",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f5c2c2",
  },
  cancelledBadge: {
    color: colors.danger ?? "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelledReasonText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  receiptCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  receiptBrand: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  receiptTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  receiptMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  receiptLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  receiptItem: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  receiptAmount: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptTotalLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  receiptTotal: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  receiptWarning: { color: colors.warning ?? "#B45309", fontSize: 13, fontWeight: "700" },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 4,
  },
  modalInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  wasteToggleRow: {
    gap: 8,
  },
  wasteOptionBtn: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wasteOptionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "#f4f9f6",
  },
  wasteOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  wasteOptionTextActive: {
    fontWeight: "700",
    color: colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger ?? "#b91c1c",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  modalConfirmBtnDisabled: {
    opacity: 0.5,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
