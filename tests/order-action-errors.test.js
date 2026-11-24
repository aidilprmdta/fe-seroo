// order-action-errors.test.js — Unit test untuk OrderActionError.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OrderActionError,
  ORDER_ACTION_ERROR_CODES,
  isOrderActionError,
} from "../src/pos/orderActionError.js";

describe("OrderActionError", () => {
  it("membuat instance dengan kode dan pesan", () => {
    const error = new OrderActionError(ORDER_ACTION_ERROR_CODES.PERIOD_CLOSED, "Konfirmasi cenderung ditutup");
    assert.equal(error.code, ORDER_ACTION_ERROR_CODES.PERIOD_CLOSED);
    assert.equal(error.message, "Konfirmasi cenderung ditutup");
    assert.equal(error.name, "OrderActionError");
  });

  it("membangun dari respons API", () => {
    const res = {
      status: 409,
      statusText: "Conflict",
      data: { error: { code: "PAYMENT_CONFLICT", message: "Konflik status" } },
    };
    const error = OrderActionError.fromResponse(res);
    assert.equal(error.code, "PAYMENT_CONFLICT");
    assert.equal(error.message, "Konflik status");
  });

  it("mendeteksi instance", () => {
    const error = new OrderActionError(ORDER_ACTION_ERROR_CODES.NETWORK_ERROR, "Offline");
    assert.equal(isOrderActionError(error), true);
  });
});
