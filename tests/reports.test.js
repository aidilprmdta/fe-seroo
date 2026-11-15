import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES, isAllowedRoute } from "../src/auth/routePolicy.js";
import { ReportApiError, createReportApi } from "../src/reports/api.js";

const mockDailyPayload = {
  outletId: "outlet-rumbai",
  period: {
    type: "DAILY",
    date: "2026-11-13",
    startDate: "2026-11-12T17:00:00.000Z",
    endDate: "2026-11-13T17:00:00.000Z",
    timezone: "Asia/Jakarta",
  },
  summary: {
    totalIncome: "60000.00",
    totalExpense: "15000.00",
    netBalance: "45000.00",
    transactionCount: 2,
    expenseCount: 1,
  },
  paymentSummary: {
    cash: { count: 1, total: "40000.00" },
    qris: {
      count: 1,
      total: "20000.00",
      recorded: { count: 1, total: "20000.00" },
      pendingReconciliation: { count: 0, total: "0.00" },
    },
  },
  productSales: [
    {
      productVariantId: "var-1",
      productName: "Kopi Susu",
      variantName: "Regular",
      quantity: 3,
      total: "45000.00",
    },
  ],
  expenseSummary: {
    total: "15000.00",
    count: 1,
    categories: [
      { categoryId: "cat-1", categoryName: "Es Batu", count: 1, total: "15000.00" },
    ],
  },
};

const mockMonthlyPayload = {
  ...mockDailyPayload,
  period: {
    type: "MONTHLY",
    month: "2026-11",
    startDate: "2026-10-31T17:00:00.000Z",
    endDate: "2026-11-30T17:00:00.000Z",
    timezone: "Asia/Jakarta",
  },
  dailyBreakdown: [
    {
      date: "2026-11-13",
      transactionCount: 2,
      totalIncome: "60000.00",
      totalExpense: "15000.00",
      netBalance: "45000.00",
    },
  ],
};

test("reports API scopes requests to encoded outlet and preserves query params", async () => {
  const calls = [];
  const api = createReportApi({
    request: async (path) => {
      calls.push(path);
      if (path.includes("reports/daily")) {
        return mockDailyPayload;
      }
      return mockMonthlyPayload;
    },
  });

  const daily = await api.getDailyReport("outlet/rumbai", "2026-11-13");
  assert.equal(calls[0], "/api/v1/outlets/outlet%2Frumbai/reports/daily?date=2026-11-13");
  assert.equal(daily.summary.totalIncome, "60000.00");
  assert.equal(daily.summary.transactionCount, 2);

  const monthly = await api.getMonthlyReport("outlet/rumbai", "2026-11");
  assert.equal(calls[1], "/api/v1/outlets/outlet%2Frumbai/reports/monthly?month=2026-11");
  assert.equal(monthly.dailyBreakdown.length, 1);
});

test("reports API rejects malformed server response", async () => {
  const badApi = createReportApi({
    request: async () => ({ unexpected: true }),
  });

  await assert.rejects(
    () => badApi.getDailyReport("outlet-1", "2026-11-13"),
    (err) => err instanceof ReportApiError && err.code === "INVALID_RESPONSE",
  );
});

test("reports route policy permits Manager and Owner and blocks Crew", () => {
  const managerMemberships = [
    { outletId: "outlet-1", role: "MANAGER" },
  ];
  const ownerMemberships = [
    { outletId: "outlet-1", role: "OWNER" },
  ];
  const crewMemberships = [
    { outletId: "outlet-1", role: "CREW" },
  ];

  // Manager is allowed
  assert.equal(
    isAllowedRoute(ROUTES.reports, managerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "MANAGER",
    }),
    true,
  );

  // Owner is allowed
  assert.equal(
    isAllowedRoute(ROUTES.reports, ownerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "OWNER",
    }),
    true,
  );

  // Crew is NOT allowed
  assert.equal(
    isAllowedRoute(ROUTES.reports, crewMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "CREW",
    }),
    false,
  );

  // Mismatched active role is blocked
  assert.equal(
    isAllowedRoute(ROUTES.reports, managerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "OWNER",
    }),
    false,
  );
});

