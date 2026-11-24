import test from "node:test";
import assert from "node:assert/strict";
import { createWebRepository } from "../src/pos/webRepository.js";

function createMockStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

test("webRepository: handles insert, find, list, and update with storage", async () => {
  const storage = createMockStorage();
  const repo = createWebRepository(storage);

  await repo.initialize();

  const record1 = {
    clientTransactionId: "tx-1",
    ownerUserId: "user-crew",
    outletId: "outlet-rumbai",
    payloadJson: JSON.stringify({ amount: 1000 }),
    status: "queued",
    serverOrderJson: null,
    errorCode: null,
    retryCount: 0,
    nextRetryAt: null,
    createdAt: "2026-11-24T10:00:00.000Z",
    updatedAt: "2026-11-24T10:00:00.000Z",
  };

  await repo.insert(record1);

  // Re-inserting same ID should ignore (no duplicate)
  await repo.insert(record1);

  const found = await repo.find("tx-1");
  assert.equal(found.clientTransactionId, "tx-1");
  assert.equal(found.status, "queued");

  const list = await repo.list({ ownerUserId: "user-crew", outletId: "outlet-rumbai" });
  assert.equal(list.length, 1);
  assert.equal(list[0].clientTransactionId, "tx-1");

  // Other user/outlet returns empty
  const emptyList = await repo.list({ ownerUserId: "user-other", outletId: "outlet-rumbai" });
  assert.equal(emptyList.length, 0);

  // Update
  await repo.update({
    clientTransactionId: "tx-1",
    ownerUserId: "user-crew",
    outletId: "outlet-rumbai",
    status: "synced",
    serverOrderJson: JSON.stringify({ id: "server-order-1" }),
    errorCode: null,
    retryCount: 0,
    nextRetryAt: null,
    updatedAt: "2026-11-24T10:05:00.000Z",
  });

  const updated = await repo.find("tx-1");
  assert.equal(updated.status, "synced");
  assert.equal(updated.serverOrderJson, JSON.stringify({ id: "server-order-1" }));
});

test("webRepository: markNeedsReview and requeueSessionOrders", async () => {
  const repo = createWebRepository(createMockStorage());

  await repo.insert({
    clientTransactionId: "tx-queued",
    ownerUserId: "user-crew-1",
    outletId: "outlet-rumbai",
    payloadJson: "{}",
    status: "queued",
    createdAt: "2026-11-24T10:00:00.000Z",
    updatedAt: "2026-11-24T10:00:00.000Z",
  });

  await repo.insert({
    clientTransactionId: "tx-synced",
    ownerUserId: "user-crew-1",
    outletId: "outlet-rumbai",
    payloadJson: "{}",
    status: "synced",
    createdAt: "2026-11-24T10:01:00.000Z",
    updatedAt: "2026-11-24T10:01:00.000Z",
  });

  // Mark needs review
  const changes = await repo.markNeedsReview({ ownerUserId: "user-crew-1" });
  assert.equal(changes, 1);

  const queuedNow = await repo.find("tx-queued");
  assert.equal(queuedNow.status, "needs_review");
  assert.equal(queuedNow.errorCode, "SESSION_ENDED_REVIEW");

  const syncedNow = await repo.find("tx-synced");
  assert.equal(syncedNow.status, "synced"); // Should not change synced

  // Requeue session orders
  const restored = await repo.requeueSessionOrders({
    ownerUserId: "user-crew-1",
    outletId: "outlet-rumbai",
  });
  assert.equal(restored, 1);

  const requeued = await repo.find("tx-queued");
  assert.equal(requeued.status, "queued");
  assert.equal(requeued.errorCode, null);
});

test("webRepository: throws error when updating non-existent record", async () => {
  const repo = createWebRepository(createMockStorage());

  await assert.rejects(
    () =>
      repo.update({
        clientTransactionId: "non-existent",
        ownerUserId: "user-crew",
        outletId: "outlet-rumbai",
        status: "synced",
      }),
    /Transaksi antrean POS tidak ditemukan/,
  );
});
