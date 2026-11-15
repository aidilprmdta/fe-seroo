import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { ROUTES } from "../src/auth/routePolicy";
import Notice from "../src/components/Notice";
import PrimaryButton from "../src/components/PrimaryButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { createInventoryApi } from "../src/inventory/api";
import { canReachInternet } from "../src/pos/cart";
import { colors, spacing } from "../src/theme/tokens";

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;
const MOVEMENT_LABELS = {
  IN: "Stok masuk",
  OUT: "Stok keluar",
  WASTE: "Waste",
  ADJUSTMENT: "Penyesuaian",
  TRANSFER_IN: "Transfer masuk",
  TRANSFER_OUT: "Transfer keluar",
};

function StockInput({ label, value, onChangeText, disabled, numeric = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        keyboardType={numeric ? "decimal-pad" : "default"}
        onChangeText={onChangeText}
        style={[styles.input, disabled && styles.inputDisabled]}
        value={value}
      />
    </View>
  );
}

export default function InventoryScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const canManage = role === "MANAGER";
  const api = useMemo(() => createInventoryApi({ request: apiRequest }), [apiRequest]);
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [movementType, setMovementType] = useState("IN");
  const [direction, setDirection] = useState("INCREASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);
  const savingRef = useRef(false);
  const wideLayout = width >= 900;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockResult, movementResult] = await Promise.all([
        api.getStocks(outletId),
        api.getMovements(outletId),
      ]);
      setStocks(stockResult.stocks);
      setMovements(movementResult.movements);
      setSelectedItemId((current) =>
        stockResult.stocks.some((item) => item.inventoryItemId === current)
          ? current
          : stockResult.stocks[0]?.inventoryItemId ?? "",
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitMovement = async () => {
    if (savingRef.current || !canManage) return;
    if (!selectedItemId || !QUANTITY_PATTERN.test(quantity) || Number(quantity) <= 0) {
      setError("Pilih item dan masukkan jumlah stok yang valid.");
      return;
    }
    if (movementType === "ADJUSTMENT" && !reason.trim()) {
      setError("Alasan penyesuaian wajib diisi.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!canReachInternet(networkState)) {
        setError("Penerimaan dan penyesuaian stok hanya dapat dikirim saat online.");
        return;
      }

      const payload =
        pendingPayload ??
        {
          clientTransactionId: Crypto.randomUUID(),
          inventoryItemId: selectedItemId,
          type: movementType,
          ...(movementType === "ADJUSTMENT" ? { direction } : {}),
          quantity,
          ...(reason.trim() ? { note: reason.trim() } : {}),
        };
      setPendingPayload(payload);
      const result = await api.createMovement(outletId, payload);
      setPendingPayload(null);
      setQuantity("");
      setReason("");
      setNotice(
        result.replayed
          ? "Perubahan stok sudah tercatat sebelumnya."
          : "Perubahan stok dan ledger berhasil disimpan.",
      );
      await loadData();
    } catch (submitError) {
      if (submitError.status && submitError.status < 500) {
        setPendingPayload(null);
      }
      setError(submitError.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selectedOutlet = user.memberships.find(
    (membership) => membership.outletId === outletId,
  );

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Persediaan · {role}</Text>
            <Text style={styles.title}>Stok outlet</Text>
            <Text style={styles.subtitle}>{selectedOutlet?.outletName}</Text>
          </View>
          <View style={styles.headerActions}>
            <PrimaryButton
              label="Muat ulang"
              secondary
              onPress={loadData}
            />
            <PrimaryButton
              label="Waste"
              secondary
              onPress={() => router.push(ROUTES.waste)}
            />
            <PrimaryButton
              label="Kembali"
              secondary
              onPress={() =>
                router.replace(role === "MANAGER" ? ROUTES.manager : ROUTES.crew)
              }
            />
          </View>
        </View>

        <Notice message={error} />
        <Notice message={notice} type="info" />

        {loading ? <Text style={styles.helper}>Memuat data stok...</Text> : null}
        <View style={[styles.columns, wideLayout && styles.wideColumns]}>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Saldo saat ini</Text>
            {!loading && stocks.length === 0 ? (
              <Text style={styles.empty}>
                Belum ada item inventaris aktif. Hubungi pengelola untuk menyiapkan master data.
              </Text>
            ) : null}
            {stocks.map((item) => (
              <View key={item.inventoryItemId} style={styles.stockRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.helper}>{item.updatedAt ? "Saldo diperbarui" : "Belum ada pergerakan"}</Text>
                </View>
                <Text style={styles.quantity}>{item.quantity} {item.unit}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Riwayat pergerakan</Text>
            {movements.length === 0 && !loading ? (
              <Text style={styles.empty}>Belum ada pergerakan stok untuk outlet ini.</Text>
            ) : null}
            {movements.map((movement) => (
              <View key={movement.id} style={styles.historyRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.itemName}>{movement.inventoryItem.name}</Text>
                  <Text style={styles.helper}>
                    {MOVEMENT_LABELS[movement.type] ?? movement.type}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </Text>
                  <Text style={styles.helper}>
                    {movement.createdBy?.name ?? "Pengguna"} ·{" "}
                    {new Date(movement.createdAt).toLocaleString("id-ID")}
                  </Text>
                </View>
                <Text style={styles.quantity}>
                  {movement.quantity} {movement.inventoryItem.unit}
                </Text>
              </View>
            ))}
          </View>

          {canManage ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Catat perubahan stok</Text>
              {pendingPayload ? (
                <Text style={styles.helper}>
                  Hasil permintaan belum diketahui. Kirim ulang data yang sama untuk memastikan tidak terjadi pencatatan ganda.
                </Text>
              ) : null}
              <Text style={styles.label}>Jenis perubahan</Text>
              <View style={styles.choiceRow}>
                {[
                  ["IN", "Stok masuk"],
                  ["ADJUSTMENT", "Penyesuaian"],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: movementType === value }}
                    disabled={Boolean(pendingPayload)}
                    onPress={() => setMovementType(value)}
                    style={[styles.choice, movementType === value && styles.choiceSelected]}
                  >
                    <Text style={styles.choiceText}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              {movementType === "ADJUSTMENT" ? (
                <>
                  <Text style={styles.label}>Arah penyesuaian</Text>
                  <View style={styles.choiceRow}>
                    {[
                      ["INCREASE", "Tambah"],
                      ["DECREASE", "Kurangi"],
                    ].map(([value, label]) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: direction === value }}
                        disabled={Boolean(pendingPayload)}
                        onPress={() => setDirection(value)}
                        style={[styles.choice, direction === value && styles.choiceSelected]}
                      >
                        <Text style={styles.choiceText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Item inventaris</Text>
              <View style={styles.itemChoices}>
                {stocks.map((item) => (
                  <Pressable
                    key={item.inventoryItemId}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selectedItemId === item.inventoryItemId,
                    }}
                    disabled={Boolean(pendingPayload)}
                    onPress={() => setSelectedItemId(item.inventoryItemId)}
                    style={[
                      styles.choice,
                      selectedItemId === item.inventoryItemId && styles.choiceSelected,
                    ]}
                  >
                    <Text style={styles.choiceText}>{item.name} · {item.unit}</Text>
                  </Pressable>
                ))}
              </View>
              <StockInput
                label="Jumlah"
                value={quantity}
                onChangeText={setQuantity}
                disabled={Boolean(pendingPayload)}
                numeric
              />
              {movementType === "ADJUSTMENT" ? (
                <StockInput
                  label="Alasan penyesuaian"
                  value={reason}
                  onChangeText={setReason}
                  disabled={Boolean(pendingPayload)}
                />
              ) : null}
              <PrimaryButton
                label={pendingPayload ? "Kirim ulang perubahan yang sama" : "Simpan perubahan stok"}
                loading={saving}
                disabled={stocks.length === 0}
                onPress={submitMovement}
              />
              <Text style={styles.helper}>
                Perubahan hanya dikirim saat online. Penyesuaian keluar tidak dapat membuat saldo negatif.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, width: "100%", maxWidth: 1280, alignSelf: "center", padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.md },
  headerCopy: { flex: 1, minWidth: 220, gap: spacing.xs },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  eyebrow: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 15 },
  columns: { gap: spacing.md },
  wideColumns: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  panel: { flex: 1, minWidth: 300, gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: "700" },
  stockRow: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  rowCopy: { flex: 1, gap: 4 },
  itemName: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  quantity: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "right" },
  helper: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  field: { gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface },
  inputDisabled: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  itemChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  choiceText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
});
