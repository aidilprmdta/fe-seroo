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
import { wasteOutbox } from "../src/inventory/nativeWasteOutbox";
import { canReachInternet, classifyOutboxFailure, retryDelayMs } from "../src/pos/cart";
import { colors, spacing } from "../src/theme/tokens";

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;

function statusLabel(status) {
  switch (status) {
    case "queued":
      return "Menunggu koneksi";
    case "syncing":
      return "Mengirim ke server";
    case "synced":
      return "Tersimpan di server";
    case "retryable_failure":
      return "Gagal sementara · akan dicoba lagi";
    case "needs_review":
      return "Perlu diperiksa";
    default:
      return "Tersimpan di server";
  }
}

function FormField({ label, value, onChangeText, disabled, numeric = false }) {
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

export default function WasteScreen() {
  const { user, selection, apiRequest } = useAuth();
  const { width } = useWindowDimensions();
  const outletId = selection.activeOutletId;
  const role = selection.activeRole;
  const api = useMemo(() => createInventoryApi({ request: apiRequest }), [apiRequest]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(null);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [serverWaste, setServerWaste] = useState([]);
  const [localRecords, setLocalRecords] = useState([]);
  const [networkAvailable, setNetworkAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const onlineRef = useRef(false);
  const syncingRef = useRef(false);
  const submittingRef = useRef(false);
  const wideLayout = width >= 900;

  const refreshLocalRecords = useCallback(async () => {
    setLocalRecords(
      await wasteOutbox.listRecent({ ownerUserId: user.id, outletId }),
    );
  }, [outletId, user.id]);

  const refreshRecords = useCallback(async () => {
    await wasteOutbox.initialize();
    await refreshLocalRecords();
    if (onlineRef.current) {
      try {
        const [wasteResult, stockResult] = await Promise.all([
          api.getWaste(outletId),
          api.getStocks(outletId),
        ]);
        setServerWaste(wasteResult.waste);
        setInventoryItems(stockResult.stocks);
      } catch (loadError) {
        setError(loadError.message);
      }
    }
  }, [api, outletId, refreshLocalRecords]);

  const syncPending = useCallback(async (force = false) => {
    if (!onlineRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await wasteOutbox.initialize();
      const pending = await wasteOutbox.listPending({
        ownerUserId: user.id,
        outletId,
        force,
      });
      for (const record of pending) {
        await wasteOutbox.setStatus({
          clientTransactionId: record.clientTransactionId,
          ownerUserId: user.id,
          outletId,
          status: "syncing",
        });
        await refreshLocalRecords();
        try {
          const result = await api.createWaste(outletId, record.payload);
          await wasteOutbox.setStatus({
            clientTransactionId: record.clientTransactionId,
            ownerUserId: user.id,
            outletId,
            status: "synced",
            serverWaste: result.waste,
          });
        } catch (syncError) {
          const status = classifyOutboxFailure(syncError);
          await wasteOutbox.setStatus({
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
                ? new Date(Date.now() + retryDelayMs(record.retryCount ?? 0)).toISOString()
                : null,
          });
          await refreshLocalRecords();
          if (syncError.status === 401 || syncError.status === 403) {
            setError(syncError.message);
            break;
          }
        }
        await refreshLocalRecords();
      }
      await refreshRecords();
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [api, outletId, refreshLocalRecords, refreshRecords, user.id]);

  const handleNetworkState = useCallback(
    async (networkState) => {
      const available = canReachInternet(networkState);
      onlineRef.current = available;
      setNetworkAvailable(available);
      await refreshRecords();
      if (available) await syncPending();
    },
    [refreshRecords, syncPending],
  );

  useEffect(() => {
    let active = true;
    wasteOutbox
      .initialize()
      .then(() => refreshRecords())
      .catch((storageError) => {
        if (active) setError(storageError.message);
      });
    Network.getNetworkStateAsync()
      .then((state) => active && handleNetworkState(state))
      .catch(() => {
        if (active) {
          onlineRef.current = false;
          setNetworkAvailable(false);
          setError("Status jaringan tidak dapat diperiksa. Coba muat ulang.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const subscription = Network.addNetworkStateListener((state) => {
      if (active) handleNetworkState(state);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleNetworkState, refreshRecords]);

  const chooseInventoryItem = (item) => {
    setSelectedInventoryItemId(item?.inventoryItemId ?? null);
    if (item) {
      setItemName(item.name);
      setUnit(item.unit);
    } else {
      setItemName("");
      setUnit("");
    }
  };

  const submitWaste = async () => {
    if (submittingRef.current) return;
    if (
      !itemName.trim() ||
      !category.trim() ||
      !QUANTITY_PATTERN.test(quantity) ||
      Number(quantity) <= 0 ||
      !unit.trim()
    ) {
      setError("Lengkapi nama item, kategori, jumlah, dan satuan dengan benar.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      let online = false;
      try {
        online = canReachInternet(await Network.getNetworkStateAsync());
      } catch {
        online = false;
      }
      onlineRef.current = online;
      setNetworkAvailable(online);

      const payload = {
        clientTransactionId: Crypto.randomUUID(),
        ...(selectedInventoryItemId
          ? { inventoryItemId: selectedInventoryItemId }
          : {}),
        itemName: itemName.trim(),
        category: category.trim(),
        quantity,
        unit: unit.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        wasteDate: new Date().toISOString(),
      };
      await wasteOutbox.enqueue({ ownerUserId: user.id, outletId, payload });
      setItemName("");
      setCategory("");
      setQuantity("");
      setUnit("");
      setDescription("");
      setSelectedInventoryItemId(null);
      await refreshRecords();

      if (online) {
        await syncPending();
      } else {
        setNotice("Catatan waste disimpan di perangkat dan menunggu koneksi untuk disinkronkan.");
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const remoteClientIds = new Set(
    serverWaste.map((record) => record.clientTransactionId).filter(Boolean),
  );
  const visibleLocal = localRecords.filter(
    (record) => !remoteClientIds.has(record.clientTransactionId),
  );
  const records = [
    ...serverWaste.map((record) => ({
      ...record,
      localStatus: null,
      date: record.wasteDate,
    })),
    ...visibleLocal.map((record) => {
      const saved = record.serverWaste ?? record.payload;
      return {
        ...saved,
        clientTransactionId: record.clientTransactionId,
        localStatus: record.status,
        date: saved.wasteDate ?? record.createdAt,
      };
    }),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const selectedOutlet = user.memberships.find(
    (membership) => membership.outletId === outletId,
  );

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Waste · {role}</Text>
            <Text style={styles.title}>Catatan waste</Text>
            <Text style={styles.subtitle}>{selectedOutlet?.outletName}</Text>
          </View>
          <View style={styles.headerActions}>
            <Text style={styles.connection}>
              {networkAvailable ? "Terhubung" : "Offline"}
            </Text>
            {syncing ? <Text style={styles.connection}>Menyinkronkan...</Text> : null}
            <PrimaryButton
              label="Stok"
              secondary
              onPress={() => router.push(ROUTES.inventory)}
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

        <View style={[styles.columns, wideLayout && styles.wideColumns]}>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Catat waste</Text>
            <Text style={styles.helper}>
              Catatan waste tidak mengurangi saldo stok secara otomatis.
            </Text>
            <Text style={styles.label}>Pilih item inventaris (opsional)</Text>
            <View style={styles.itemChoices}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedInventoryItemId === null }}
                onPress={() => chooseInventoryItem(null)}
                style={[
                  styles.choice,
                  selectedInventoryItemId === null && styles.choiceSelected,
                ]}
              >
                <Text style={styles.choiceText}>Input manual</Text>
              </Pressable>
              {inventoryItems.map((item) => (
                <Pressable
                  key={item.inventoryItemId}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selectedInventoryItemId === item.inventoryItemId,
                  }}
                  onPress={() => chooseInventoryItem(item)}
                  style={[
                    styles.choice,
                    selectedInventoryItemId === item.inventoryItemId &&
                      styles.choiceSelected,
                  ]}
                >
                  <Text style={styles.choiceText}>{item.name} · {item.unit}</Text>
                </Pressable>
              ))}
            </View>
            <FormField
              label="Nama item"
              value={itemName}
              onChangeText={setItemName}
              disabled={Boolean(selectedInventoryItemId)}
            />
            <FormField label="Kategori / alasan" value={category} onChangeText={setCategory} />
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <FormField label="Jumlah" value={quantity} onChangeText={setQuantity} numeric />
              </View>
              <View style={styles.formHalf}>
                <FormField
                  label="Satuan"
                  value={unit}
                  onChangeText={setUnit}
                  disabled={Boolean(selectedInventoryItemId)}
                />
              </View>
            </View>
            <FormField label="Keterangan (opsional)" value={description} onChangeText={setDescription} />
            <PrimaryButton
              label="Simpan catatan waste"
              loading={submitting}
              onPress={submitWaste}
            />
            <PrimaryButton
              label="Coba sinkronkan sekarang"
              secondary
              disabled={!networkAvailable || syncing}
              loading={syncing}
              onPress={() => syncPending(true)}
            />
          </View>

          <View style={styles.panel}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>
                {role === "MANAGER" ? "Laporan waste outlet" : "Catatan waste saya"}
              </Text>
              <Text style={styles.helper}>Maksimal 100 catatan terbaru</Text>
            </View>
            {loading ? <Text style={styles.helper}>Memuat catatan...</Text> : null}
            {!loading && records.length === 0 ? (
              <Text style={styles.empty}>
                {networkAvailable
                  ? "Belum ada catatan waste."
                  : "Belum ada catatan lokal. Sambungkan ke internet untuk memuat laporan server."}
              </Text>
            ) : null}
            {records.map((record, index) => (
              <View
                key={record.id ?? record.clientTransactionId ?? `${record.itemName}-${index}`}
                style={styles.record}
              >
                <View style={styles.recordHeading}>
                  <Text style={styles.itemName}>{record.itemName}</Text>
                  <Text style={styles.quantity}>{record.quantity} {record.unit}</Text>
                </View>
                <Text style={styles.helper}>
                  {record.category}
                  {record.description ? ` · ${record.description}` : ""}
                </Text>
                <Text style={styles.helper}>
                  {record.createdBy?.name ? `${record.createdBy.name} · ` : ""}
                  {new Date(record.date).toLocaleString("id-ID")}
                </Text>
                <Text style={styles.status}>
                  {statusLabel(record.localStatus)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, width: "100%", maxWidth: 1280, alignSelf: "center", padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.md },
  headerCopy: { flex: 1, minWidth: 220, gap: spacing.xs },
  headerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  eyebrow: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 15 },
  connection: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  columns: { gap: spacing.md },
  wideColumns: { flexDirection: "row", alignItems: "flex-start" },
  panel: { flex: 1, minWidth: 320, gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: "700" },
  helper: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  field: { flex: 1, gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface },
  inputDisabled: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  itemChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  choiceText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  formRow: { flexDirection: "row", gap: spacing.sm },
  formHalf: { flex: 1 },
  listHeader: { gap: spacing.xs },
  record: { gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  recordHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  itemName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  quantity: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  status: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
});
