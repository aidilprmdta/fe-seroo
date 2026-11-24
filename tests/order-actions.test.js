// order-actions.test.js — Unit test untuk useOrderActions hook.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrderActionError, ORDER_ACTION_ERROR_CODES } from "../src/pos/orderActionError.js";
import { executeOrderAction } from "../src/pos/orderActions.js";

describe("executeOrderAction", () => {
  it("menerima API instance", async () => {
    const api = {
      post: async (url, body) => {
        assert.match(url, /verify-qris/);
      },
    };
    const result = await executeOrderAction(api, "VERIFY_QRIS", "o-123", { outletId: "o-1" });
    assert.equal(result.success, true);
  });

  it("melempar ORDER_ACTION_ERROR_CODES.PERIOD_CLOSED untuk aksi tidak didukung", async () => {
    const api = {};
    await assert.rejects(
      executeOrderAction(api, "UNKNOWN_ACTION", "o-1"),
      (error) => error.code === ORDER_ACTION_ERROR_CODES.UNSUPPORTED_ACTION,
    );
  });
});

describe("ORDER_ACTION_ERROR_CODES", () => {
  it("mengandung kode yang diperlukan", () => {
    assert.ok(ORDER_ACTION_ERROR_CODES.PERIOD_CLOSED);
    assert.ok(ORDER_ACTION_ERROR_CODES.PAYMENT_CONFLICT);
    assert.ok(ORDER_ACTION_ERROR_CODES.NETWORK_ERROR);
  });
});
