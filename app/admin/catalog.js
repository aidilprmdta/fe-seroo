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
import { createRecipeApi } from "../../src/recipes/api";
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

  const recipeApi = useMemo(
    () => createRecipeApi({ request: apiRequest }),
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

  // Modal states for managing recipe
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeVariant, setRecipeVariant] = useState(null);
  const [recipeItems, setRecipeItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);

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

  const openRecipeModal = async (variant, product) => {
    setRecipeVariant({ ...variant, productName: product.name });
    setShowRecipeModal(true);
    setLoadingRecipe(true);
    setError(null);
    try {
      const [recData, ingList] = await Promise.all([
        recipeApi.getVariantRecipe(variant.id),
        recipeApi.listIngredients().catch(() => []),
      ]);
      setRecipeItems(
        (recData.items || []).map((it) => ({
          inventoryItemId: it.inventoryItemId,
          name: it.ingredientName,
          unit: it.unit,
          quantity: it.quantity,
        })),
      );
      setAvailableIngredients(ingList);
      if (ingList.length > 0) {
        setSelectedIngredientId(ingList[0].id);
      }
    } catch (err) {
      setError(err.message || "Gagal memuat resep.");
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleAddRecipeItem = () => {
    if (!selectedIngredientId || !ingredientQty || Number(ingredientQty) <= 0) {
      setError("Pilih bahan baku dan masukkan takaran kuantitas yang valid.");
      return;
    }
    const ing = availableIngredients.find((i) => i.id === selectedIngredientId);
    if (!ing) return;
    if (recipeItems.some((it) => it.inventoryItemId === ing.id)) {
      setError("Bahan baku tersebut sudah ada di resep ini.");
      return;
    }
    setRecipeItems((prev) => [
      ...prev,
      {
        inventoryItemId: ing.id,
        name: ing.name,
        unit: ing.unit,
        quantity: ingredientQty.trim(),
      },
    ]);
    setIngredientQty("");
    setError(null);
  };

  const handleRemoveRecipeItem = (index) => {
    setRecipeItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveRecipe = async () => {
    if (!recipeVariant) return;
    setSavingRecipe(true);
    setError(null);
    try {
      await recipeApi.setVariantRecipe(
        recipeVariant.id,
        recipeItems.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantity: it.quantity,
        })),
      );
      setShowRecipeModal(false);
      setRecipeVariant(null);
      setSuccessMsg(
        `Resep ${recipeVariant.productName} (${recipeVariant.name}) berhasil disimpan. Pemotongan stok otomatis aktif di seluruh outlet.`,
      );
    } catch (err) {
      setError(err.message || "Gagal menyimpan resep.");
    } finally {
      setSavingRecipe(false);
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

        {authNotice ? <Notice variant="info">{authNotice}</Notice> : null}
        {error ? <Notice variant="danger">{error}</Notice> : null}
        {successMsg ? <Notice variant="success">{successMsg}</Notice> : null}

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
                              <Pressable
                                style={styles.recipeBtn}
                                onPress={() => {
                                  setError(null);
                                  setSuccessMsg(null);
                                  openRecipeModal(variant, product);
                                }}
                              >
                                <Text style={styles.recipeBtnText}>🧪 Kelola Resep</Text>
                              </Pressable>

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

        {/* Modal Kelola Resep */}
        <Modal
          visible={showRecipeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRecipeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxWidth: 540 }]}>
              <Text style={styles.modalTitle}>
                Kelola Resep: {recipeVariant?.productName} ({recipeVariant?.name})
              </Text>
              <Text style={styles.modalSubtitle}>
                Tentukan takaran bahan baku per porsi minuman. Transaksi POS kasir akan otomatis memotong stok sesuai resep ini.
              </Text>

              {loadingRecipe ? (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13 }}>
                    Memuat resep bahan baku...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
                    Daftar Bahan Resep ({recipeItems.length}):
                  </Text>
                  {recipeItems.length === 0 ? (
                    <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic", marginBottom: 8 }}>
                      Belum ada bahan baku pada resep ini. Tambahkan bahan di bawah.
                    </Text>
                  ) : (
                    <View style={styles.recipeItemList}>
                      {recipeItems.map((item, idx) => (
                        <View key={item.inventoryItemId || idx} style={styles.recipeItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.recipeItemName}>{item.name}</Text>
                            <Text style={styles.recipeItemQty}>
                              {item.quantity} {item.unit}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleRemoveRecipeItem(idx)}
                            style={styles.removeRecipeBtn}
                          >
                            <Text style={styles.removeRecipeBtnText}>Hapus</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Form Tambah Bahan ke Resep */}
                  <View style={styles.addRecipeBox}>
                    <Text style={styles.addRecipeBoxTitle}>+ Tambah Bahan ke Resep</Text>
                    {availableIngredients.length === 0 ? (
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Tidak ada bahan baku master yang tersedia.
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.fieldLabel}>Pilih Bahan Baku:</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginBottom: 8 }}
                        >
                          {availableIngredients.map((ing) => (
                            <Pressable
                              key={ing.id}
                              onPress={() => setSelectedIngredientId(ing.id)}
                              style={[
                                styles.ingredientPill,
                                selectedIngredientId === ing.id && styles.ingredientPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ingredientPillText,
                                  selectedIngredientId === ing.id && styles.ingredientPillTextActive,
                                ]}
                              >
                                {ing.name} ({ing.unit})
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>

                        <Text style={styles.fieldLabel}>Takaran Kuantitas Pemakaian:</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Contoh: 15.000 atau 30"
                            keyboardType="numeric"
                            value={ingredientQty}
                            onChangeText={setIngredientQty}
                          />
                          <Pressable
                            onPress={handleAddRecipeItem}
                            style={styles.addIngredientBtn}
                          >
                            <Text style={styles.addIngredientBtnText}>+ Tambah</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}

              <View style={styles.modalActionRow}>
                <PrimaryButton
                  label="Tutup"
                  secondary
                  disabled={savingRecipe}
                  onPress={() => setShowRecipeModal(false)}
                />
                <PrimaryButton
                  label={savingRecipe ? "Menyimpan..." : "Simpan Resep"}
                  disabled={savingRecipe || loadingRecipe}
                  onPress={handleSaveRecipe}
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

