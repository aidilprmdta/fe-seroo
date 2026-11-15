import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryApi, InventoryApiError } from "../src/inventory/api.js";
import {
  createWasteOutbox,
  WasteOutboxConflictError,
} from "../src/inventory/wasteOutbox.js";

test("inventory API scopes requests to encoded outlet and preserves payload", async () => {
  const calls = [];
  const api = createInventoryApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (options?.method === "POST") {
        return {
          [path.endsWith("/waste") ? "waste" : "movement"]: {
            id: path.endsWith("/waste") ? "waste-1" : "movement-1",
            clientTransactionId: "client-id",
          },
          replayed: false,
        };
      }
      if (path.endsWith("/stocks")) {
        return { outletId: "outlet / a", stocks: [] };
      }
      if (path.endsWith("/stock-movements")) {
        return { outletId: "outlet / a", movements: [] };
      }
      if (path.endsWith("/waste")) {
        return { outletId: "outlet / a", waste: [] };
      }
      return {
        movement: { id: "movement-1", clientTransactionId: "client-id" },
        replayed: false,
      };
    },
  });
  const payload = {
    clientTransactionId: "client-id",
    quantity: "3.5",
  };

  await api.getStocks("outlet / a");
  await api.getMovements("outlet / a");
  await api.getWaste("outlet / a");
  await api.createMovement("outlet / a", payload);
  await api.createWaste("outlet / a", payload);

  assert.equal(calls[0].path, "/api/v1/outlets/outlet%20%2F%20a/stocks");
  assert.equal(calls[1].path, "/api/v1/outlets/outlet%20%2F%20a/stock-movements");
  assert.equal(calls[2].path, "/api/v1/outlets/outlet%20%2F%20a/waste");
  assert.equal(calls[3].options.body, payload);
  assert.equal(calls[4].options.body, payload);
});

test("inventory API rejects malformed server data", async () => {
  const api = createInventoryApi({
    request: async () => ({ outletId: "outlet-a", stocks: [{ quantity: -1 }] }),
  });
  await assert.rejects(api.getStocks("outlet-a"), InventoryApiError);
});

test("waste outbox preserves IDs and payloads and scopes by user and outlet", async () => {
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
  const outbox = createWasteOutbox(
    repository,
    () => new Date("2026-11-13T10:00:00.000Z"),
  );
  const input = {
    ownerUserId: "user-1",
    outletId: "outlet-a",
    payload: {
      clientTransactionId: "client-waste-1",
      quantity: "2.5",
      itemName: "Susu",
    },
  };

  await outbox.enqueue(input);
  await outbox.enqueue(input);
  assert.equal((await outbox.listPending(input)).length, 1);
  await assert.rejects(
    outbox.enqueue({
      ...input,
      payload: { ...input.payload, quantity: "3" },
    }),
    WasteOutboxConflictError,
  );
  assert.equal(
    (await outbox.listRecent({ ownerUserId: "user-2", outletId: "outlet-a" }))
      .length,
    0,
  );

  await outbox.setStatus({
    ...input,
    clientTransactionId: input.payload.clientTransactionId,
    status: "synced",
    serverWaste: { id: "server-waste-1" },
  });
  assert.equal((await outbox.listPending(input)).length, 0);
  assert.equal(
    (await outbox.listRecent(input))[0].serverWaste.id,
    "server-waste-1",
  );
});

test("waste outbox marks only the owner's pending records for review", async () => {
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
  const outbox = createWasteOutbox(repository);
  await outbox.enqueue({ ownerUserId: "user-1", outletId: "outlet-a", payload: { clientTransactionId: "waste-review-1" } });
  await outbox.enqueue({ ownerUserId: "user-2", outletId: "outlet-a", payload: { clientTransactionId: "waste-review-2" } });
  await outbox.markNeedsReview({ ownerUserId: "user-1" });
  assert.equal((await outbox.listRecent({ ownerUserId: "user-1", outletId: "outlet-a" }))[0].status, "needs_review");
  assert.equal((await outbox.listRecent({ ownerUserId: "user-2", outletId: "outlet-a" }))[0].status, "queued");
});
