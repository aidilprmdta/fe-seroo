import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrdersApi } from "../src/api/orders.js";
import { createClosingApi } from "../src/closings/api.js";

test("cancelItem posts to item cancellation endpoint and updateCashDifference patches status", async () => {
  const calls = [];
  const ordersApi = createOrdersApi({
    request: {
      async post(path, body) {
        calls.push({ path, body });
        return { success: true, data: { order: { id: "order-1" } } };
      },
    },
  });
  await ordersApi.cancelItem("outlet-a", "order-1", "item-2", { reason: "Salah input" });
  assert.equal(
    calls[0].path,
    "/outlets/outlet-a/orders/order-1/items/item-2/cancel",
  );
  assert.deepEqual(calls[0].body, { reason: "Salah input" });

  const closingCalls = [];
  const closingApi = createClosingApi({
    request: async (path, options) => {
      closingCalls.push({ path, options });
      return { closing: { cashDifferenceStatus: "SUDAH_DIKETAHUI" } };
    },
  });
  const result = await closingApi.updateCashDifference("outlet-a", "closing-9", {
    status: "SUDAH_DIKETAHUI",
  });
  assert.equal(
    closingCalls[0].path,
    "/api/v1/outlets/outlet-a/closings/closing-9/cash-difference",
  );
  assert.equal(closingCalls[0].options.method, "PATCH");
  assert.equal(result.closing.cashDifferenceStatus, "SUDAH_DIKETAHUI");
});
