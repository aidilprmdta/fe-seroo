import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import {
  Alert,
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
const STATUS_LABELS = {
  PENDING: "Menunggu keputusan Manager",
  APPROVED: "Disetujui · belum berarti stok diterima",
  REJECTED: "Ditolak",
};

function StockRequestScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const canDecide = role === "MANAGER";
  const api = useMemo(
    () => createInventoryApi({ request: apiRequest }),
    [apiRequest],
  );
  const [stocks, setStocks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [note, setNote] = useState("");
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
      const [stockResult, requestResult] = await Promise.all([
        api.getStocks(outletId),
        api.getStockRequests(outletId),
      ]);
      setStocks(stockResult.stocks);
      setRequests(requestResult.requests);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleItem = (inventoryItemId) => {
    setSelectedItems((current) => {
      const next = { ...current };
      if (next[inventoryItemId] !== undefined) {
        delete next[inventoryItemId];
      } else {
        next[inventoryItemId] = "";
      }
      return next;
    });
  };

  const submitRequest = async () => {
    if (savingRef.current) return;
    const items = Object.entries(selectedItems).map(
      ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }),
    );
    if (
      items.length === 0 ||
      items.some(
        (item) =>
          !QUANTITY_PATTERN.test(item.quantity) || Number(item.quantity) <= 0,
      )
    ) {
      setError("Pilih sedikitnya satu item dan masukkan jumlah yang valid.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!canReachInternet(networkState)) {
        setError("Permintaan stok memerlukan koneksi internet.");
        return;
      }
      const payload =
        pendingPayload ??
        {
          clientTransactionId: Crypto.randomUUID(),
          items,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      setPendingPayload(payload);
      const result = await api.createStockRequest(outletId, payload);
      setPendingPayload(null);
      setSelectedItems({});
      setNote("");
      setNotice(
        result.replayed
          ? "Permintaan ini sudah tersimpan sebelumnya."
          : "Permintaan stok berhasil dikirim ke server.",
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

  const decideRequest = (request, status) => {
    const isApproval = status === "APPROVED";
    Alert.alert(
      isApproval ? "Setujui permintaan?" : "Tolak permintaan?",
      isApproval
        ? "Persetujuan tidak mengubah saldo stok dan bukan konfirmasi penerimaan."
        : "Permintaan akan ditandai sebagai ditolak.",
      [
        { text: "Kembali", style: "cancel" },
        {
          text: isApproval ? "Setujui" : "Tolak",
          style: isApproval ? "default" : "destructive",
          onPress: async () => {
            if (savingRef.current) return;
            savingRef.current = true;
            setSaving(true);
            setError(null);
            setNotice(null);
            try {
              const networkState = await Network.getNetworkStateAsync();
              if (!canReachInternet(networkState)) {
                setError("Keputusan permintaan hanya dapat dikirim saat online.");
                return;
              }
              const result = await api.decideStockRequest(
                outletId,
                request.id,
                { status },
              );
              setNotice(
                result.replayed
                  ? "Keputusan ini sudah tersimpan."
                  : status === "APPROVED"
                    ? "Permintaan disetujui. Stok belum berubah."
                    : "Permintaan ditolak.",
              );
              await loadData();
            } catch (decisionError) {
              setError(decisionError.message);
              await loadData();
            } finally {
              savingRef.current = false;
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const outlet = user.memberships.find(
    (membership) => membership.outletId === outletId,
  );
  const formDisabled = saving || pendingPayload !== null;

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Persediaan · {role}</Text>
            <Text style={styles.title}>Permintaan stok internal</Text>
            <Text style={styles.subtitle}>{outlet?.outletName}</Text>
          </View>
          <View style={styles.headerActions}>
            <PrimaryButton label="Muat ulang" secondary onPress={loadData} />
            <PrimaryButton
              label="Kembali"
              secondary
              onPress={() =>
                router.replace(
                  role === "MANAGER" ? ROUTES.manager : ROUTES.crew,
                )
              }
            />
          </View>
        </View>

        <Notice message={error} type="error" />
        <Notice message={notice} type="success" />
        {pendingPayload ? (
          <Notice
            message="Hasil kiriman belum diketahui. Coba lagi untuk mengirim payload dan ID transaksi yang sama."
            type="info"
          />
        ) : null}

        <View style={[styles.content, wideLayout && styles.wideContent]}>
          <View style={[styles.panel, wideLayout && styles.formPanel]}>
            <Text style={styles.sectionTitle}>Ajukan kebutuhan</Text>
            <Text style={styles.helper}>
              Permintaan ini hanya berlaku di outlet aktif dan tidak mengubah
              saldo stok saat disetujui.
            </Text>
            {loading ? (
              <Text style={styles.helper}>Memuat item inventaris…</Text>
            ) : stocks.length === 0 ? (
              <Text style={styles.helper}>
                Belum ada item inventaris aktif untuk dipilih.
              </Text>
            ) : (
              <View style={styles.itemList}>
                {stocks.map((item) => {
                  const selected =
                    selectedItems[item.inventoryItemId] !== undefined;
                  return (
                    <View key={item.inventoryItemId} style={styles.itemRow}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        disabled={formDisabled}
                        onPress={() => toggleItem(item.inventoryItemId)}
                        style={[
                          styles.itemSelect,
                          selected && styles.itemSelected,
                          formDisabled && styles.disabled,
                        ]}
                      >
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemMeta}>
                          Stok saat ini: {item.quantity} {item.unit}
                        </Text>
                        <Text style={styles.itemAction}>
                          {selected ? "Dipilih" : "Pilih item"}
                        </Text>
                      </Pressable>
                      {selected ? (
                        <View style={styles.quantityField}>
                          <Text style={styles.label}>
                            Jumlah diminta ({item.unit})
                          </Text>
                          <TextInput
                            accessibilityLabel={`Jumlah ${item.name}`}
                            editable={!formDisabled}
                            keyboardType="decimal-pad"
                            onChangeText={(value) =>
                              setSelectedItems((current) => ({
                                ...current,
                                [item.inventoryItemId]: value,
                              }))
                            }
                            style={styles.input}
                            value={selectedItems[item.inventoryItemId]}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Catatan (opsional)</Text>
              <TextInput
                accessibilityLabel="Catatan permintaan"
                editable={!formDisabled}
                maxLength={500}
                multiline
                onChangeText={setNote}
                style={[styles.input, styles.multiline]}
                value={note}
              />
            </View>
            {pendingPayload ? (
              <Text style={styles.helper}>
                Form dikunci agar retry menggunakan data dan ID transaksi yang
                sama.
              </Text>
            ) : null}
            <PrimaryButton
              label="Kirim permintaan"
              disabled={formDisabled}
              loading={saving}
              onPress={submitRequest}
            />
          </View>

          <View style={[styles.panel, wideLayout && styles.listPanel]}>
            <Text style={styles.sectionTitle}>Riwayat permintaan</Text>
            {loading ? (
              <Text style={styles.helper}>Memuat permintaan…</Text>
            ) : requests.length === 0 ? (
              <Text style={styles.helper}>Belum ada permintaan stok.</Text>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeading}>
                    <Text style={styles.requestStatus}>
                      {STATUS_LABELS[request.status]}
                    </Text>
                    <Text style={styles.requestDate}>
                      {new Date(request.createdAt).toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <Text style={styles.requester}>
                    Diajukan oleh {request.requestedBy?.name ?? "Crew"}
                  </Text>
                  {request.items.map((item) => (
                    <Text key={item.id} style={styles.requestItem}>
                      {item.itemName}: {item.quantity} {item.unit}
                    </Text>
                  ))}
                  {request.note ? (
                    <Text style={styles.helper}>Catatan: {request.note}</Text>
                  ) : null}
                  {request.decisionNote ? (
                    <Text style={styles.helper}>
                      Catatan Manager: {request.decisionNote}
                    </Text>
                  ) : null}
                  {canDecide && request.status === "PENDING" ? (
                    <View style={styles.decisionActions}>
                      <PrimaryButton
                        label="Setujui"
                        disabled={saving}
                        onPress={() => decideRequest(request, "APPROVED")}
                      />
                      <PrimaryButton
                        label="Tolak"
                        secondary
                        disabled={saving}
                        onPress={() => decideRequest(request, "REJECTED")}
                      />
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  content: {
    gap: spacing.md,
  },
  wideContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formPanel: {
    flex: 1.1,
    minWidth: 360,
  },
  listPanel: {
    flex: 1,
    minWidth: 360,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  itemList: {
    gap: spacing.sm,
  },
  itemRow: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  itemSelect: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: 4,
  },
  itemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  itemAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  quantityField: {
    gap: spacing.xs,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  multiline: {
    minHeight: 84,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  disabled: {
    opacity: 0.55,
  },
  requestCard: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  requestHeading: {
    gap: spacing.xs,
  },
  requestStatus: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  requestDate: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  requester: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  requestItem: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  decisionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});

export default StockRequestScreen;
