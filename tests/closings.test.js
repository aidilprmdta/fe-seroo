import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES, isAllowedRoute } from "../src/auth/routePolicy.js";
import { ClosingApiError, createClosingApi } from "../src/closings/api.js";

const mockPreviewPayload = {
  outletId: "outlet-rumbai",
  closingType: "DAILY",
  periodKey: "2026-11-13",
  reportSummary: {
    summary: {
      totalIncome: "50000.00",
      totalExpense: "10000.00",
      netBalance: "40000.00",
      transactionCount: 2,
    },
  },
  unfinishedTransactions: [
    {
      id: "ord-unsettled",
      orderNumber: "SR-0099",
      total: "15000.00",
      paymentMethod: "QRIS",
      paymentStatus: "PENDING_RECONCILIATION",
      createdAt: "2026-11-13T05:00:00.000Z",
      crewName: "Crew Seroo",
    },
  ],
  unfinishedCount: 1,
  currentClosing: null,
};

test("closing API scopes requests and validates response contracts", async () => {
  const calls = [];
  const api = createClosingApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (path.includes("closings/preview")) {
        return mockPreviewPayload;
      }
      if (path.includes("closings/reopen")) {
        return {
          record: {
            id: "cls-1",
            status: "REOPENED",
            reopenReason: "Koreksi data",
          },
        };
      }
      return {
        record: {
          id: "cls-1",
          status: "CLOSED",
          version: 1,
        },
      };
    },
  });

  const preview = await api.getPreview("outlet/rumbai", {
    type: "DAILY",
    periodKey: "2026-11-13",
  });
  assert.equal(
    calls[0].path,
    "/api/v1/outlets/outlet%2Frumbai/closings/preview?type=DAILY&periodKey=2026-11-13",
  );
  assert.equal(preview.unfinishedCount, 1);
  assert.equal(preview.unfinishedTransactions[0].orderNumber, "SR-0099");

  const closeResult = await api.performClosing("outlet/rumbai", {
    clientTransactionId: "uuid-1",
    closingType: "DAILY",
    periodKey: "2026-11-13",
  });
  assert.equal(calls[1].path, "/api/v1/outlets/outlet%2Frumbai/closings");
  assert.equal(closeResult.record.status, "CLOSED");

  const reopenResult = await api.reopenClosing("outlet/rumbai", {
    clientTransactionId: "uuid-2",
    closingId: "cls-1",
    reason: "Koreksi data",
  });
  assert.equal(calls[2].path, "/api/v1/outlets/outlet%2Frumbai/closings/reopen");
  assert.equal(reopenResult.record.status, "REOPENED");
});

test("closing API rejects malformed server response", async () => {
  const badApi = createClosingApi({
    request: async () => ({ invalid: true }),
  });

  await assert.rejects(
    () => badApi.getPreview("outlet-1", { type: "DAILY", periodKey: "2026-11-13" }),
    (err) => err instanceof ClosingApiError && err.code === "INVALID_RESPONSE",
  );
});

test("closing route policy permits Manager and Owner and blocks Crew", () => {
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
    isAllowedRoute(ROUTES.closings, managerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "MANAGER",
    }),
    true,
  );

  // Owner is allowed
  assert.equal(
    isAllowedRoute(ROUTES.closings, ownerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "OWNER",
    }),
    true,
  );

  // Crew is NOT allowed
  assert.equal(
    isAllowedRoute(ROUTES.closings, crewMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "CREW",
    }),
    false,
  );

  // Mismatched role is blocked
  assert.equal(
    isAllowedRoute(ROUTES.closings, managerMemberships, {
      activeOutletId: "outlet-1",
      activeRole: "OWNER",
    }),
    false,
  );
});

test("cash opening API records and fetches opening cash correctly", async () => {
  const calls = [];
  const api = createClosingApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (options?.method === "POST") {
        return {
          id: "co-1",
          outletId: "outlet-1",
          periodKey: "2026-11-14",
          openingCash: "100000.00",
          notes: "Modal pagi",
        };
      }
      return {
        cashOpening: {
          id: "co-1",
          outletId: "outlet-1",
          periodKey: "2026-11-14",
          openingCash: "100000.00",
        },
      };
    },
  });

  const recordResult = await api.recordCashOpening("outlet/1", {
    periodKey: "2026-11-14",
    openingCash: 100000,
    notes: "Modal pagi",
  });
  assert.equal(calls[0].path, "/api/v1/outlets/outlet%2F1/cash-openings");
  assert.equal(recordResult.openingCash, "100000.00");

  const getResult = await api.getCashOpening("outlet/1", "2026-11-14");
  assert.equal(calls[1].path, "/api/v1/outlets/outlet%2F1/cash-openings/2026-11-14");
  assert.equal(getResult.openingCash, "100000.00");
});


