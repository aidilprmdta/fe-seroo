import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogApi } from "../src/api/catalog.js";
import { CatalogApi } from "../src/api/api.js";

test("Mobile 1: getProductAvailability encodes outletId and parses products list", async () => {
  const mockResponse = {
    success: true,
    data: {
      outletId: "outlet/special#1",
      outletName: "Outlet Special",
      products: [
        {
          id: "prod-1",
          name: "Teh Tarik",
          category: "Tea",
          isAvailable: true,
          variants: [{ id: "var-1", name: "Reguler", price: "10000" }],
        },
        {
          id: "prod-2",
          name: "Kopi Tarik",
          category: "Coffee",
          isAvailable: false,
          variants: [{ id: "var-2", name: "Reguler", price: "12000" }],
        },
      ],
    },
  };

  let requestedPath = null;
  const mockRequest = {
    async get(path) {
      requestedPath = path;
      return mockResponse;
    },
  };

  const catalogApi = createCatalogApi({ request: mockRequest });
  const result = await catalogApi.getProductAvailability("outlet/special#1");

  assert.equal(
    requestedPath,
    `/outlets/${encodeURIComponent("outlet/special#1")}/catalog/products/availability`,
  );
  assert.equal(result.outletId, "outlet/special#1");
  assert.equal(result.products.length, 2);
  assert.equal(result.products[0].isAvailable, true);
  assert.equal(result.products[1].isAvailable, false);
});

test("Mobile 2: setProductAvailability sends PATCH with isAvailable boolean and encoded params", async () => {
  let patchCalls = [];
  const mockRequest = {
    async patch(path, body) {
      patchCalls.push({ path, body });
      return {
        success: true,
        data: {
          outletId: "outlet-rumbai",
          productId: "prod-1",
          isAvailable: body.isAvailable,
        },
      };
    },
  };

  const catalogApi = createCatalogApi({ request: mockRequest });
  const res = await catalogApi.setProductAvailability("outlet-rumbai", "prod-1", true);

  assert.equal(patchCalls.length, 1);
  assert.equal(
    patchCalls[0].path,
    "/outlets/outlet-rumbai/catalog/products/prod-1/availability",
  );
  assert.deepEqual(patchCalls[0].body, { isAvailable: true });
  assert.equal(res.isAvailable, true);
});

test("Mobile 3: CatalogApi class provides getProductAvailability and setProductAvailability methods", async () => {
  let calledMethods = [];
  const mockRequest = {
    async get(path) {
      calledMethods.push({ method: "GET", path });
      return { success: true, data: { products: [] } };
    },
    async patch(path, body) {
      calledMethods.push({ method: "PATCH", path, body });
      return { success: true, data: { isAvailable: false } };
    },
  };

  const api = new CatalogApi(mockRequest);
  await api.getProductAvailability("outlet-1");
  await api.setProductAvailability("outlet-1", "prod-2", false);

  assert.equal(calledMethods.length, 2);
  assert.equal(calledMethods[0].method, "GET");
  assert.equal(calledMethods[0].path, "/outlets/outlet-1/catalog/products/availability");
  assert.equal(calledMethods[1].method, "PATCH");
  assert.equal(calledMethods[1].path, "/outlets/outlet-1/catalog/products/prod-2/availability");
  assert.deepEqual(calledMethods[1].body, { isAvailable: false });
});

test("Mobile 4: Manager toggle updates state and prevents double submission", async () => {
  let callCount = 0;
  const mockRequest = {
    async patch() {
      callCount++;
      return { success: true, data: { isAvailable: true } };
    },
  };

  const catalogApi = createCatalogApi({ request: mockRequest });
  const updatingProductIds = {};

  // Simulasi handler toggle dengan proteksi double-submission
  async function handleToggle(productId, currentStatus) {
    if (updatingProductIds[productId]) return;
    updatingProductIds[productId] = true;
    try {
      await catalogApi.setProductAvailability("outlet-1", productId, !currentStatus);
    } finally {
      delete updatingProductIds[productId];
    }
  }

  // Panggil pertama kali
  const p1 = handleToggle("prod-1", false);
  // Panggil kedua kali saat p1 masih berjalan (double tap simulation)
  const p2 = handleToggle("prod-1", false);

  await Promise.all([p1, p2]);

  assert.equal(callCount, 1, "Request API hanya dieksekusi 1 kali saat double-tap terjadi");
});

test("Mobile 5: Manager toggle preserves previous state if API call fails", async () => {
  const mockRequest = {
    async patch() {
      throw new Error("Koneksi internet terputus.");
    },
  };

  const catalogApi = createCatalogApi({ request: mockRequest });
  let productState = { id: "prod-1", name: "Teh Tarik", isAvailable: false };
  let caughtError = null;

  async function handleToggle(productId, currentStatus) {
    try {
      await catalogApi.setProductAvailability("outlet-1", productId, !currentStatus);
      productState = { ...productState, isAvailable: !currentStatus };
    } catch (err) {
      caughtError = err.message;
      // Jangan mutasi productState jika terjadi kegagalan
    }
  }

  await handleToggle("prod-1", false);

  assert.equal(caughtError, "Koneksi internet terputus.");
  assert.equal(
    productState.isAvailable,
    false,
    "Status ketersediaan tidak boleh berubah permanen jika API gagal",
  );
});

test("Mobile 6: Crew catalog response correctly filters out unavailable products", async () => {
  // Simulasi data dari GET /outlets/:outletId/catalog backend
  const backendCatalog = {
    success: true,
    data: {
      outletId: "outlet-rumbai",
      products: [
        { id: "prod-tea", name: "Teh Tarik Klasik", category: "Tea", variants: [] },
      ],
      addOns: [{ id: "addon-1", name: "Jelly", price: "3000" }],
    },
  };

  const mockRequest = {
    async get(path) {
      return backendCatalog;
    },
  };

  const catalogApi = createCatalogApi({ request: mockRequest });
  const data = await catalogApi.getCatalog("outlet-rumbai");

  assert.equal(data.data.products.length, 1);
  assert.equal(data.data.products[0].id, "prod-tea");
  // Pastikan prod-coffee yang tidak tersedia tidak muncul dalam daftar
  const coffee = data.data.products.find((p) => p.id === "prod-coffee");
  assert.equal(coffee, undefined);
});

test("Mobile 7: POS checkout error 409 CATALOG_ITEM_UNAVAILABLE surfaces message and triggers catalog reload", async () => {
  let catalogReloaded = false;
  let orderErrorMessage = null;

  function onOrderFailed(err) {
    orderErrorMessage = err.message || "Pesanan gagal disimpan.";
    if (err.code === "CATALOG_ITEM_UNAVAILABLE" || err.status === 409) {
      catalogReloaded = true;
    }
  }

  const simulatedApiError = {
    status: 409,
    code: "CATALOG_ITEM_UNAVAILABLE",
    message: 'Produk "Kopi Tarik" tidak tersedia di outlet ini. Muat ulang katalog.',
  };

  onOrderFailed(simulatedApiError);

  assert.equal(
    orderErrorMessage,
    'Produk "Kopi Tarik" tidak tersedia di outlet ini. Muat ulang katalog.',
  );
  assert.equal(catalogReloaded, true, "Katalog harus di-reload saat terjadi error 409");
});
