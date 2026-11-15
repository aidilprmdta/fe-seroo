import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderPayload,
  calculateCartTotalMinor,
  canReachInternet,
  classifyOutboxFailure,
  retryDelayMs,
} from "../src/pos/cart.js";
import { createPosApi } from "../src/pos/api.js";
import { createPosOutbox, OutboxConflictError } from "../src/pos/outbox.js";

const cart = [
  {
    productVariantId: "variant-medium",
    productName: "Minuman Uji",
    variantName: "Medium",
    variantPrice: "12000.00",
    quantity: 2,
    addOns: [{ addOnId: "addon-1", name: "Topping Uji", unitPrice: "3000", quantity: 1 }],
  },
];

test("POS preview and payload preserve catalog price snapshots without sending totals", () => {
  assert.equal(calculateCartTotalMinor(cart), 3000000);

  const payload = buildOrderPayload({
    clientTransactionId: "e75f8268-4ed1-4f5c-b853-b4c25178a107",
    paymentMethod: "CASH",
    recordedOffline: false,
    cart,
  });

  assert.equal(payload.items[0].expectedVariantPrice, "12000.00");
  assert.equal(payload.items[0].addOns[0].expectedUnitPrice, "3000");
  assert.equal("total" in payload, false);
  assert.equal("role" in payload, false);
});

test("network and sync failure states distinguish retryable failures", () => {
  assert.equal(canReachInternet({ isConnected: true, isInternetReachable: true }), true);
  assert.equal(canReachInternet({ isConnected: true, isInternetReachable: false }), false);
  assert.equal(canReachInternet(null), false);
  assert.equal(classifyOutboxFailure({ status: 0 }), "retryable_failure");
  assert.equal(classifyOutboxFailure({ status: 503 }), "retryable_failure");
  assert.equal(classifyOutboxFailure({ status: 409 }), "needs_review");
  assert.equal(retryDelayMs(0), 2000);
  assert.equal(retryDelayMs(8), 300000);
  assert.equal(retryDelayMs(20), 300000);
});

test("POS API uses authenticated request and returns server response", async () => {
  const calls = [];
  const api = createPosApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        order: {
          id: "server-order-1",
          orderNumber: "server-number-1",
          total: "30000",
          items: [],
        },
        replayed: false,
      };
    },
  });
  const payload = {
    clientTransactionId: "e75f8268-4ed1-4f5c-b853-b4c25178a107",
  };
  const result = await api.createOrder("outlet / a", payload);

  assert.equal(calls[0].path, "/api/v1/outlets/outlet%20%2F%20a/orders");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body, payload);
  assert.equal(result.order.id, "server-order-1");
});

test("outbox keeps IDs and payloads immutable and scopes records by user and outlet", async () => {
  const records = new Map();
  const repository = {
    async initialize() {},
    async insert(record) {
      if (!records.has(record.clientTransactionId)) {
        records.set(record.clientTransactionId, record);
      }
    },
    async find(clientTransactionId) {
      return records.get(clientTransactionId) ?? null;
    },
    async list({ ownerUserId, outletId }) {
      return [...records.values()].filter(
        (record) =>
          record.ownerUserId === ownerUserId && record.outletId === outletId,
      );
    },
    async update(update) {
      const current = records.get(update.clientTransactionId);
      if (
        !current ||
        current.ownerUserId !== update.ownerUserId ||
        current.outletId !== update.outletId
      ) {
        throw new Error("record not found");
      }
      Object.assign(current, update);
    },
  };
  const outbox = createPosOutbox(repository, () => new Date("2026-11-13T10:00:00.000Z"));
  const recordInput = {
    ownerUserId: "user-1",
    outletId: "outlet-a",
    payload: {
      clientTransactionId: "e75f8268-4ed1-4f5c-b853-b4c25178a107",
      paymentMethod: "QRIS",
    },
  };

  await outbox.enqueue(recordInput);
  await outbox.enqueue(recordInput);
  assert.equal((await outbox.listPending(recordInput)).length, 1);
  await assert.rejects(
    outbox.enqueue({
      ...recordInput,
      payload: { ...recordInput.payload, paymentMethod: "CASH" },
    }),
    OutboxConflictError,
  );
  assert.equal(
    (await outbox.listRecent({ ownerUserId: "another-user", outletId: "outlet-a" }))
      .length,
    0,
  );

  await outbox.setStatus({
    ...recordInput,
    clientTransactionId: recordInput.payload.clientTransactionId,
    status: "synced",
    serverOrder: { id: "server-order-1" },
  });
  assert.equal((await outbox.listPending(recordInput)).length, 0);
  assert.equal((await outbox.listRecent(recordInput))[0].serverOrder.id, "server-order-1");
});

test("POS outbox marks only the owner's pending records for review before logout", async () => {
  const records = new Map();
  const repository = {
    async initialize() {},
    async insert(record) { records.set(record.clientTransactionId, record); },
    async find(id) { return records.get(id) ?? null; },
    async list({ ownerUserId, outletId }) {
      return [...records.values()].filter((r) => r.ownerUserId === ownerUserId && r.outletId === outletId);
    },
    async update(update) { Object.assign(records.get(update.clientTransactionId), update); },
    async markNeedsReview({ ownerUserId }) {
      let count = 0;
      for (const record of records.values()) {
        if (record.ownerUserId === ownerUserId && ["queued", "retryable_failure"].includes(record.status)) {
          record.status = "needs_review";
          record.errorCode = "SESSION_ENDED_REVIEW";
          count += 1;
        }
      }
      return count;
    },
  };
  const outbox = createPosOutbox(repository);
  await outbox.enqueue({ ownerUserId: "user-1", outletId: "outlet-a", payload: { clientTransactionId: "logout-review-1" } });
  await outbox.enqueue({ ownerUserId: "user-2", outletId: "outlet-a", payload: { clientTransactionId: "logout-review-2" } });
  await outbox.setStatus({ clientTransactionId: "logout-review-2", ownerUserId: "user-2", outletId: "outlet-a", status: "synced", serverOrder: { id: "server-2" } });
  await outbox.markNeedsReview({ ownerUserId: "user-1" });
  assert.equal((await outbox.listRecent({ ownerUserId: "user-1", outletId: "outlet-a" }))[0].status, "needs_review");
  assert.equal((await outbox.listRecent({ ownerUserId: "user-2", outletId: "outlet-a" }))[0].status, "synced");
});

test("POS split payment: buildOrderPayload menyertakan payments array dan method SPLIT", () => {
  const splitPayments = [
    { paymentMethod: "CASH", amount: "20000.00" },
    { paymentMethod: "QRIS", amount: "15000.00" },
  ];

  const payload = buildOrderPayload({
    clientTransactionId: "split-uuid-001",
    paymentMethod: "SPLIT",
    payments: splitPayments,
    recordedOffline: false,
    cart,
  });

  assert.equal(payload.paymentMethod, "SPLIT");
  assert.equal(Array.isArray(payload.payments), true);
  assert.equal(payload.payments.length, 2);
  assert.equal(payload.payments[0].paymentMethod, "CASH");
  assert.equal(payload.payments[0].amount, "20000.00");
  assert.equal(payload.payments[1].paymentMethod, "QRIS");
  assert.equal(payload.payments[1].amount, "15000.00");
  assert.equal("total" in payload, false);
});

test("POS split payment: buildOrderPayload tanpa payments menghasilkan payload biasa", () => {
  const payload = buildOrderPayload({
    clientTransactionId: "single-uuid-001",
    paymentMethod: "CASH",
    recordedOffline: false,
    cart,
  });

  assert.equal(payload.paymentMethod, "CASH");
  assert.equal("payments" in payload, false);
});

test("POS API verifyQris memanggil endpoint verify-qris dengan orderId ter-encode", async () => {
  const calls = [];
  const api = createPosApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        order: {
          id: "ord-123",
          orderNumber: "ORD-001",
          total: "35000",
          paymentStatus: "LUNAS",
          items: [],
        },
      };
    },
  });

  const result = await api.verifyQris("outlet / a", "ord / 123", { notes: "Mutasi BCA" });

  assert.equal(calls[0].path, "/api/v1/outlets/outlet%20%2F%20a/orders/ord%20%2F%20123/verify-qris");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.body, { notes: "Mutasi BCA" });
  assert.equal(result.order.paymentStatus, "LUNAS");
});

test("POS API listOrders memanggil endpoint orders dengan query parameters", async () => {
  const calls = [];
  const api = createPosApi({
    request: async (path) => {
      calls.push({ path });
      return {
        orders: [
          {
            id: "ord-1",
            orderNumber: "ORD-001",
            total: "15000",
            paymentStatus: "PENDING_RECONCILIATION",
          },
        ],
        pagination: { page: 1, pageSize: 20, hasNextPage: false },
      };
    },
  });

  const result = await api.listOrders("outlet-a", {
    paymentStatus: "PENDING_RECONCILIATION",
    limit: 10,
  });

  assert.equal(
    calls[0].path,
    "/api/v1/outlets/outlet-a/orders?paymentStatus=PENDING_RECONCILIATION&limit=10",
  );
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].paymentStatus, "PENDING_RECONCILIATION");
});

test("POS API cancelOrder memanggil endpoint cancel dan memvalidasi respons status CANCELLED", async () => {
  const calls = [];
  const api = createPosApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        order: {
          id: "ord-1",
          orderNumber: "SR-001",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          total: "18000.00",
          items: [],
          statusHistory: [
            {
              fromStatus: "COMPLETED",
              toStatus: "CANCELLED",
              reason: "Pelanggan membatalkan",
            },
          ],
        },
      };
    },
  });

  const result = await api.cancelOrder("outlet-a", "ord-1", {
    reason: "Pelanggan membatalkan pesanan",
    recordWaste: true,
  });

  assert.equal(calls[0].path, "/api/v1/outlets/outlet-a/orders/ord-1/cancel");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.reason, "Pelanggan membatalkan pesanan");
  assert.equal(calls[0].options.body.recordWaste, true);
  assert.equal(result.order.status, "CANCELLED");
  assert.equal(result.order.paymentStatus, "REFUNDED");
});

test("POS API getOrder mengambil detail pesanan tunggal beserta riwayat status", async () => {
  const calls = [];
  const api = createPosApi({
    request: async (path) => {
      calls.push({ path });
      return {
        order: {
          id: "ord-1",
          orderNumber: "SR-001",
          status: "COMPLETED",
          total: "18000.00",
          items: [],
        },
      };
    },
  });

  const result = await api.getOrder("outlet-a", "ord-1");
  assert.equal(calls[0].path, "/api/v1/outlets/outlet-a/orders/ord-1");
  assert.equal(result.order.id, "ord-1");
});



