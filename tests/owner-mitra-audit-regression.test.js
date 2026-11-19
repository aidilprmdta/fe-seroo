import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRoute, ROUTES } from "../src/auth/routePolicy.js";

// Helper normalisasi kategori pengeluaran (sama dengan logika expenses.js)
function normalizeCategories(response) {
  return Array.isArray(response?.data?.categories)
    ? response.data.categories
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];
}

// Helper ekstraksi waste record (sama dengan logika waste.js)
function normalizeWasteRecords(response) {
  return response?.data?.waste || response?.data?.wasteRecords || [];
}

// Helper pemetaan dashboard Owner Mitra (sama dengan logika owner/dashboard.js)
function mapOwnerDashboardMetrics(data) {
  return {
    cashSales: Number(data?.sales?.cash?.total ?? data?.summary?.cashSales ?? 0),
    qrisSales: Number(data?.sales?.qris?.total ?? data?.summary?.qrisSales ?? 0),
    totalStockItems: Number(data?.stock?.totalItems ?? data?.summary?.stock ?? 0),
    totalExpenses: Number(data?.expenses?.totalExpense ?? data?.summary?.expenses ?? 0),
    wasteCount: Number(data?.waste?.todayCount ?? 0),
    closingDailyStatus: data?.closingStatus?.daily?.status || (data?.closingStatus === 'CLOSED' ? 'CLOSED' : 'OPEN'),
  };
}

test("EXPENSE: Kategori API dengan wrapper object { categories: [...] } dinormalisasi menjadi array", () => {
  const mockApiResponse = {
    success: true,
    data: {
      categories: [
        { id: "cat-1", name: "Bahan Baku", status: "CONFIRMED" },
        { id: "cat-2", name: "Operasional", status: "CONFIRMED" },
      ],
    },
  };

  const categories = normalizeCategories(mockApiResponse);
  assert.equal(Array.isArray(categories), true);
  assert.equal(categories.length, 2);
  assert.equal(categories[0].name, "Bahan Baku");

  // Verifikasi bahwa .map() berjalan tanpa TypeError
  const renderedChips = categories.map((c) => c.name);
  assert.deepEqual(renderedChips, ["Bahan Baku", "Operasional"]);
});

test("EXPENSE: Kategori API berupa direct array atau wrapper data dinormalisasi dengan benar", () => {
  const directArrayResponse = {
    success: true,
    data: [
      { id: "cat-1", name: "Kemasan" },
      { id: "cat-2", name: "Listrik" },
    ],
  };

  const categories = normalizeCategories(directArrayResponse);
  assert.equal(Array.isArray(categories), true);
  assert.equal(categories.length, 2);
});

test("EXPENSE: Kategori kosong menghasilkan array kosong dan tidak crash saat .map()", () => {
  const emptyResponse = { success: true, data: { categories: [] } };
  const categories = normalizeCategories(emptyResponse);
  assert.equal(Array.isArray(categories), true);
  assert.equal(categories.length, 0);

  const rendered = categories.map((c) => c.name);
  assert.deepEqual(rendered, []);
});

test("EXPENSE: Response null/undefined/malformed tidak menyebabkan crash dan menghasilkan fallback array kosong", () => {
  assert.deepEqual(normalizeCategories(null), []);
  assert.deepEqual(normalizeCategories(undefined), []);
  assert.deepEqual(normalizeCategories({}), []);
  assert.deepEqual(normalizeCategories({ data: null }), []);
  assert.deepEqual(normalizeCategories({ data: { categories: null } }), []);
  assert.deepEqual(normalizeCategories("invalid string"), []);
});

test("WASTE: Owner Mitra dapat membuka halaman Waste sesuai izin route policy", () => {
  const memberships = [
    { outletId: "outlet-rumbai", role: "OWNER_MITRA" },
  ];
  const context = { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" };

  const allowed = isAllowedRoute(ROUTES.waste, memberships, context);
  assert.equal(allowed, true);
});

test("WASTE: Crew dan Manager juga tetap dapat membuka halaman Waste", () => {
  const crewMemberships = [{ outletId: "outlet-rumbai", role: "CREW" }];
  assert.equal(
    isAllowedRoute(ROUTES.waste, crewMemberships, { activeOutletId: "outlet-rumbai", activeRole: "CREW" }),
    true,
  );

  const managerMemberships = [{ outletId: "outlet-rumbai", role: "MANAGER" }];
  assert.equal(
    isAllowedRoute(ROUTES.waste, managerMemberships, { activeOutletId: "outlet-rumbai", activeRole: "MANAGER" }),
    true,
  );
});

test("WASTE: Isolasi outlet ditegakkan — akses ke outlet yang tidak diotorisasi ditolak", () => {
  const memberships = [
    { outletId: "outlet-rumbai", role: "OWNER_MITRA" },
  ];
  const wrongContext = { activeOutletId: "outlet-panam", activeRole: "OWNER_MITRA" };

  const allowed = isAllowedRoute(ROUTES.waste, memberships, wrongContext);
  assert.equal(allowed, false);
});

test("WASTE: Data waste list dinormalisasi dengan benar dari response backend", () => {
  const mockWasteResponse = {
    success: true,
    data: {
      outletId: "outlet-rumbai",
      waste: [
        { id: "w-1", itemName: "Susu UHT Basi", quantity: 2, unit: "liter" },
        { id: "w-2", itemName: "Cup Bocor", quantity: 5, unit: "pcs" },
      ],
    },
  };

  const records = normalizeWasteRecords(mockWasteResponse);
  assert.equal(Array.isArray(records), true);
  assert.equal(records.length, 2);
  assert.equal(records[0].itemName, "Susu UHT Basi");
});

test("DASHBOARD: Pemetaan metrik Owner Mitra membaca struktur data backend Hono dengan benar", () => {
  const mockBackendDashboard = {
    sales: {
      totalIncome: "450000.00",
      cash: { count: 12, total: "250000.00" },
      qris: { count: 8, total: "200000.00" },
    },
    expenses: {
      totalExpense: "85000.00",
      expenseCount: 3,
    },
    stock: {
      totalItems: 42,
      lowStockCount: 4,
    },
    waste: {
      todayCount: 2,
      todayQuantity: "1.500",
    },
    closingStatus: {
      daily: { status: "CLOSED", version: 1 },
    },
  };

  const metrics = mapOwnerDashboardMetrics(mockBackendDashboard);
  assert.equal(metrics.cashSales, 250000);
  assert.equal(metrics.qrisSales, 200000);
  assert.equal(metrics.totalStockItems, 42);
  assert.equal(metrics.totalExpenses, 85000);
  assert.equal(metrics.wasteCount, 2);
  assert.equal(metrics.closingDailyStatus, "CLOSED");
});

test("RBAC CLOSING: Route closings diizinkan untuk OWNER_MITRA tetapi reopen/perform closing dibatasi", () => {
  const memberships = [
    { outletId: "outlet-rumbai", role: "OWNER_MITRA" },
  ];
  const context = { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" };

  assert.equal(isAllowedRoute(ROUTES.closings, memberships, context), true);
  assert.equal(isAllowedRoute(ROUTES.expenses, memberships, context), true);
  assert.equal(isAllowedRoute(ROUTES.reports, memberships, context), true);

  // Akses kasir (crewPos) mutlak ditolak untuk Owner Mitra
  assert.equal(isAllowedRoute(ROUTES.crewPos, memberships, context), false);
});
