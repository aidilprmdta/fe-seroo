import assert from "node:assert/strict";
import test from "node:test";
import { createExpenseApi, ExpenseApiError } from "../src/expenses/api.js";
import { createInventoryApi, InventoryApiError } from "../src/inventory/api.js";

const expense = {
  id: "expense-1",
  category: { id: "category-1", name: "Bahan baku", isProvisional: true },
  amount: "25000",
  expenseDate: "2026-11-13T00:00:00.000Z",
  status: "ACTIVE",
  audits: [],
};

test("stock request API scopes and validates request operations", async () => {
  const calls = [];
  const api = createInventoryApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (options?.method === "POST" || options?.method === "PATCH") {
        return {
          request: {
            id: "request-1",
            clientTransactionId: "client-id",
          },
          replayed: false,
        };
      }
      return {
        outletId: "outlet-a",
        requests: [
          {
            id: "request-1",
            status: "PENDING",
            items: [
              {
                inventoryItemId: "item-1",
                itemName: "Susu",
                unit: "ml",
                quantity: "5",
              },
            ],
          },
        ],
      };
    },
  });
  const payload = {
    clientTransactionId: "client-id",
    items: [{ inventoryItemId: "item-1", quantity: "5" }],
  };

  await api.getStockRequests("outlet-a");
  await api.createStockRequest("outlet-a", payload);
  await api.decideStockRequest("outlet-a", "request / 1", {
    status: "APPROVED",
  });

  assert.equal(calls[0].path, "/api/v1/outlets/outlet-a/stock-requests");
  assert.equal(calls[1].options.body, payload);
  assert.equal(calls[2].path, "/api/v1/outlets/outlet-a/stock-requests/request%20%2F%201");
  assert.equal(calls[2].options.method, "PATCH");
});

test("expense API maps the audited write contract and rejects malformed data", async () => {
  const calls = [];
  const api = createExpenseApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (path === "/api/v1/expense-categories") {
        return {
          categories: [
            { id: "category-1", name: "Bahan baku", status: "PROVISIONAL" },
          ],
        };
      }
      if (path.endsWith("/expense-1/audit")) {
        return { expenseId: "expense-1", audits: [] };
      }
      if (!options) return { outletId: "outlet-a", expenses: [expense] };
      return { expense, replayed: false };
    },
  });
  const payload = {
    clientTransactionId: "client-id",
    categoryId: "category-1",
    amount: "25000",
    expenseDate: "2026-11-13T00:00:00.000Z",
  };

  await api.getCategories();
  await api.getExpenses("outlet-a");
  await api.createExpense("outlet-a", payload);
  await api.correctExpense("outlet-a", "expense-1", {
    clientTransactionId: "correction-id",
    amount: "30000",
  });
  await api.cancelExpense("outlet-a", "expense-1", {
    clientTransactionId: "cancel-id",
  });
  await api.getAudit("outlet-a", "expense-1");

  assert.equal(calls[0].path, "/api/v1/expense-categories");
  assert.equal(calls[2].options.body, payload);
  assert.equal(calls[3].path, "/api/v1/outlets/outlet-a/expenses/expense-1");
  assert.equal(calls[3].options.method, "PATCH");
  assert.equal(
    calls[4].path,
    "/api/v1/outlets/outlet-a/expenses/expense-1/cancel",
  );
  assert.equal(calls[5].path, "/api/v1/outlets/outlet-a/expenses/expense-1/audit");

  const malformed = createExpenseApi({
    request: async () => ({
      outletId: "outlet-a",
      expenses: [{ ...expense, amount: 25 }],
    }),
  });
  await assert.rejects(malformed.getExpenses("outlet-a"), ExpenseApiError);

  const malformedRequests = createInventoryApi({
    request: async () => ({
      requests: [{ id: "request-1", status: "UNKNOWN", items: [] }],
    }),
  });
  await assert.rejects(
    malformedRequests.getStockRequests("outlet-a"),
    InventoryApiError,
  );
});
