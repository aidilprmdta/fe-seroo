import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
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
import { ROUTES } from "../../src/auth/routePolicy";
import LogoutButton from "../../src/components/LogoutButton";
import Notice from "../../src/components/Notice";
import PrimaryButton from "../../src/components/PrimaryButton";
import ProfileButton from "../../src/components/ProfileButton";
import ScreenFrame from "../../src/components/ScreenFrame";
import { createCatalogAdminApi } from "../../src/catalog/api";
import { colors, spacing } from "../../src/theme/tokens";

function formatRupiah(value) {
  if (value === null || value === undefined) return "0";
  const num = Math.round(Number(value));
  return num.toLocaleString("id-ID");
}

export default function AdminCatalogScreen() {
  const { user, apiRequest, notice: authNotice } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const api = useMemo(
    () => createCatalogAdminApi({ request: apiRequest }),
    [apiRequest],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [catalog, setCatalog] = useState({ products: [], addOns: [] });

  // Modal states for creating product
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Minuman");
  const [prodDesc, setProdDesc] = useState("");
  const [regPrice, setRegPrice] = useState("10000");
  const [lrgPrice, setLrgPrice] = useState("13000");
  const [savingProduct, setSavingProduct] = useState(false);

  // Modal states for updating price
  const [showEditPriceModal, setShowEditPriceModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [editPriceInput, setEditPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCatalog();
      setCatalog(res);
    } catch (err) {
      setError(err.message || "Gagal memuat katalog brand.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleCreateProduct = async () => {
    if (!prodName.trim()) {
      setError("Nama produk wajib diisi.");
      return;
    }
    setSavingProduct(true);
    setError(null);
    try {
      await api.createProduct({
        name: prodName.trim(),
        category: prodCategory.trim(),
        description: prodDesc.trim() || undefined,
        variants: [
          { name: "Regular", price: regPrice },
          { name: "Large", price: lrgPrice },
        ],
      });
      setShowAddProductModal(false);
      setProdName("");
      setProdDesc("");
      setSuccessMsg("Produk dan harga baru berhasil ditambahkan untuk seluruh outlet.");
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Gagal menambahkan produk.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!selectedVariant || !editPriceInput.trim()) return;
    setSavingPrice(true);
    setError(null);
    try {
      await api.updateVariant(selectedVariant.id, {
        price: editPriceInput.trim(),
      });
      setShowEditPriceModal(false);
      setSelectedVariant(null);
      setSuccessMsg("Harga varian berhasil diperbarui dan berlaku di seluruh outlet.");
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Gagal memperbarui harga.");
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>Seroo Pusat · Brand Owner</Text>
            <Text style={styles.title}>Manajemen Menu & Harga Brand</Text>
            <Text style={styles.subtitle}>
              {user?.name} · Pengaturan menu dan harga berlaku terpusat untuk seluruh outlet.
            </Text>
          </View>
          <View style={styles.headerBtnCol}>
            <PrimaryButton
              label="Manajemen Akun"
              secondary
              onPress={() => router.push(ROUTES.adminAccounts)}
            />
            <ProfileButton />
            <PrimaryButton
              label="+ Tambah Menu Baru"
              onPress={() => {
                setError(null);
                setSuccessMsg(null);
                setShowAddProductModal(true);
              }}
            />
            <LogoutButton />
          </View>
        </View>

        {/* Brand Control Notice Banner */}
        <View style={styles.brandBanner}>
          <Text style={styles.brandIcon}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Otoritas Brand Owner / Admin Pusat</Text>
            <Text style={styles.brandSubtitle}>
              Pengaturan menu, varian ukuran, dan harga jual dikontrol secara terpusat oleh Brand Owner. Mitra outlet tidak dapat mengubah harga atau menu sendiri untuk menjaga konsistensi brand Seroo.
            </Text>
          </View>
        </View>

        {authNotice ? <Notice type="info">{authNotice}</Notice> : null}
        {error ? <Notice type="error">{error}</Notice> : null}
        {successMsg ? <Notice type="success">{successMsg}</Notice> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat katalog menu terpusat...</Text>
          </View>
        ) : (
          <>
            {/* Products & Variants Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daftar Menu Produk ({catalog.products.length})</Text>
              {catalog.products.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Belum ada menu produk terdaftar.</Text>
                </View>
              ) : (
                <View style={isWide ? styles.grid : styles.col}>
                  {catalog.products.map((product) => (
                    <View key={product.id} style={styles.productCard}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.categoryBadge}>{product.category || "Minuman"}</Text>
                        </View>
                      </View>
                      {product.description ? (
                        <Text style={styles.descText}>{product.description}</Text>
                      ) : null}

                      <Text style={styles.variantsLabel}>Varian & Harga Resmi (Seluruh Outlet):</Text>
                      <View style={styles.variantList}>
                        {product.variants.map((variant) => (
                          <View key={variant.id} style={styles.variantRow}>
                            <View>
                              <Text style={styles.variantName}>{variant.name}</Text>
                              <Text style={styles.variantPrice}>
                                Rp {formatRupiah(variant.price)}
                              </Text>
                            </View>
                            <View style={styles.variantActionRow}>
                              <View style={{ width: 80 }} />
                              <Pressable
                                style={styles.editPriceBtn}
                                onPress={() => {
                                  setSelectedVariant(variant);
                                  setEditPriceInput(variant.price);
                                  setError(null);
                                  setSuccessMsg(null);
                                  setShowEditPriceModal(true);
                                }}
                              >
                                <Text style={styles.editPriceBtnText}>Ubah Harga</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Add-Ons Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Topping & Add-On ({catalog.addOns.length})</Text>
              <View style={styles.addOnBox}>
                {catalog.addOns.map((addOn) => (
                  <View key={addOn.id} style={styles.addOnRow}>
                    <Text style={styles.addOnName}>{addOn.name}</Text>
                    <Text style={styles.addOnPrice}>+ Rp {formatRupiah(addOn.price)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Modal Tambah Menu */}
        <Modal
          visible={showAddProductModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddProductModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Tambah Menu Produk Brand</Text>
              <Text style={styles.modalSubtitle}>
                Menu baru akan langsung tersedia di katalog POS seluruh outlet mitra.
              </Text>

              <Text style={styles.fieldLabel}>Nama Produk *</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Kopi Tarik Pandan"
                value={prodName}
                onChangeText={setProdName}
              />

              <Text style={styles.fieldLabel}>Kategori</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Kopi / Teh / Special"
                value={prodCategory}
                onChangeText={setProdCategory}
              />

              <Text style={styles.fieldLabel}>Deskripsi Produk</Text>
              <TextInput
                style={styles.input}
                placeholder="Deskripsi singkat produk"
                value={prodDesc}
                onChangeText={setProdDesc}
              />

              <View style={styles.priceRow}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.fieldLabel}>Harga Regular (Rp) *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={regPrice}
                    onChangeText={setRegPrice}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.fieldLabel}>Harga Large (Rp) *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={lrgPrice}
                    onChangeText={setLrgPrice}
                  />
                </View>
              </View>

              <View style={styles.modalActionRow}>
                <PrimaryButton
                  label="Batal"
                  secondary
                  onPress={() => setShowAddProductModal(false)}
                />
                <PrimaryButton
                  label={savingProduct ? "Menyimpan..." : "Simpan Menu"}
                  disabled={savingProduct}
                  onPress={handleCreateProduct}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Ubah Harga */}
        <Modal
          visible={showEditPriceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditPriceModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Ubah Harga Resmi Varian</Text>
              <Text style={styles.modalSubtitle}>
                Varian: {selectedVariant?.name}. Perubahan ini akan segera berlaku di seluruh outlet.
              </Text>

              <Text style={styles.fieldLabel}>Harga Baru (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editPriceInput}
                onChangeText={setEditPriceInput}
              />

              <View style={styles.modalActionRow}>
                <PrimaryButton
                  label="Batal"
                  secondary
                  onPress={() => setShowEditPriceModal(false)}
                />
                <PrimaryButton
                  label={savingPrice ? "Menyimpan..." : "Terapkan Harga"}
                  disabled={savingPrice}
                  onPress={handleUpdatePrice}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 260,
  },
  headerBtnCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.sm,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  brandBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  brandIcon: {
    fontSize: 24,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#1E3A8A",
    marginTop: 2,
    lineHeight: 18,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 8,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  col: {
    flexDirection: "column",
    gap: spacing.md,
  },
  productCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  categoryBadge: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  descText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  variantsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  variantList: {
    gap: spacing.xs,
  },
  variantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  variantPrice: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  editPriceBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editPriceBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  variantActionRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  recipeBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recipeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  recipeItemList: {
    gap: 6,
    marginBottom: spacing.sm,
    maxHeight: 160,
  },
  recipeItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  recipeItemQty: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  removeRecipeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#FEE2E2",
  },
  removeRecipeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.danger ?? "#B91C1C",
  },
  addRecipeBox: {
    backgroundColor: "#F9FAFB",
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    marginTop: 4,
  },
  addRecipeBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ingredientPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
  },
  ingredientPillActive: {
    borderColor: colors.primary,
    backgroundColor: "#EFF6FF",
  },
  ingredientPillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ingredientPillTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  addIngredientBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  addIngredientBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  addOnBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  addOnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addOnName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  addOnPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalBox: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  priceRow: {
    flexDirection: "row",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

