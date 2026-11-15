import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES, isAllowedRoute, resolveLandingRoute } from "../src/auth/routePolicy.js";
import { DashboardApiError, createDashboardApi } from "../src/dashboard/api.js";

const mockDashboardData = {
  outlet: { id: "outlet-rumbai", name: "Seroo Rumbai", code: "SR-01" },
  today: "2026-11-14",
  currentMonth: "2026-11",
  sales: {
    totalIncome: "65000.00",
    transactionCount: 2,
    cash: { count: 1, total: "40000.00" },
    qris: { count: 1, total: "25000.00", pendingReconciliationCount: 1 },
  },
  expenses: {
    totalExpense: "15000.00",
    expenseCount: 1,
  },
  netBalance: "50000.00",
  stock: {
    totalItems: 3,
    lowStockCount: 1,
    lowStockItems: [{ id: "item-1", name: "Kopi Arabika", unit: "kg", quantity: "2.000" }],
  },
  waste: {
    todayCount: 1,
    todayQuantity: "1.000",
  },
  closingStatus: {
    daily: { periodKey: "2026-11-14", status: "OPEN", version: 0, closedAt: null, closedBy: null },
    monthly: { periodKey: "2026-11", status: "OPEN", version: 0, closedAt: null, closedBy: null },
  },
  activities: [
    {
      id: "ord-1",
      type: "ORDER",
      title: "Pesanan SR-0001",
      subtitle: "CASH · Rp 40000.00",
      status: "COMPLETED",
      actor: "Crew Seroo",
      timestamp: "2026-11-14T03:00:00.000Z",
    },
  ],
};

test("dashboard API scopes request to encoded outlet and returns validated structure", async () => {
  const calls = [];
  const api = createDashboardApi({
    request: async (path) => {
      calls.push(path);
      return mockDashboardData;
    },
  });

  const res = await api.getDashboard("outlet/rumbai");
  assert.equal(calls[0], "/api/v1/outlets/outlet%2Frumbai/dashboard");
  assert.equal(res.outlet.code, "SR-01");
  assert.equal(res.sales.totalIncome, "65000.00");
  assert.equal(res.stock.lowStockCount, 1);
  assert.equal(res.activities.length, 1);
});

test("dashboard API rejects malformed server response", async () => {
  const badApi = createDashboardApi({
    request: async () => ({ unexpected: true }),
  });

  await assert.rejects(
    () => badApi.getDashboard("outlet-1"),
    (err) => err instanceof DashboardApiError && err.code === "INVALID_RESPONSE",
  );
});

test("dashboard route resolution directs Manager and Owner to respective dashboards", () => {
  const managerMemberships = [{ outletId: "outlet-1", role: "MANAGER" }];
  const ownerMemberships = [{ outletId: "outlet-1", role: "OWNER" }];
  const crewMemberships = [{ outletId: "outlet-1", role: "CREW" }];

  assert.equal(
    resolveLandingRoute(managerMemberships, { activeOutletId: "outlet-1", activeRole: "MANAGER" }),
    ROUTES.manager,
  );
  assert.equal(
    resolveLandingRoute(ownerMemberships, { activeOutletId: "outlet-1", activeRole: "OWNER" }),
    ROUTES.owner,
  );
  assert.equal(
    resolveLandingRoute(crewMemberships, { activeOutletId: "outlet-1", activeRole: "CREW" }),
    ROUTES.crew,
  );

  // Manager cannot access Owner dashboard and vice versa
  assert.equal(
    isAllowedRoute(ROUTES.owner, managerMemberships, { activeOutletId: "outlet-1", activeRole: "MANAGER" }),
    false,
  );
  assert.equal(
    isAllowedRoute(ROUTES.manager, ownerMemberships, { activeOutletId: "outlet-1", activeRole: "OWNER" }),
    false,
  );
});

