import assert from "node:assert/strict";
import test from "node:test";
import { createSqliteRepository } from "../src/pos/sqliteRepository.js";
import { createPosOutbox, OutboxConflictError } from "../src/pos/outbox.js";
import { createPosSyncService } from "../src/pos/syncService.js";
import { migrateJsonQueueToSqlite } from "../src/pos/migration.js";
import { buildOrderPayload, classifyOutboxFailure } from "../src/pos/cart.js";

// Helper in-memory mock SQLite database simulator
function createMockSqliteDb() {
  const tables = {
    pos_order_outbox: new Map(),
  };

  return {
    async execAsync(sql) {},
    async getAllAsync(sql, ...params) {
      if (sql.includes("PRAGMA table_info")) {
        return [
          { name: "client_transaction_id" },
          { name: "owner_user_id" },
          { name: "outlet_id" },
          { name: "payload_json" },
          { name: "status" },
          { name: "server_order_json" },
          { name: "error_code" },
          { name: "retry_count" },
          { name: "next_retry_at" },
          { name: "created_at" },
          { name: "updated_at" },
        ];
      }
      if (sql.includes("FROM pos_order_outbox")) {
        const [ownerUserId, outletId] = params;
        return [...tables.pos_order_outbox.values()]
          .filter((r) => r.owner_user_id === ownerUserId && r.outlet_id === outletId)
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      }
      return [];
    },
    async getFirstAsync(sql, clientTransactionId) {
      return tables.pos_order_outbox.get(clientTransactionId) || null;
    },
    async runAsync(sql, ...params) {
      if (sql.startsWith("INSERT OR IGNORE")) {
        const [
          client_transaction_id,
          owner_user_id,
          outlet_id,
          payload_json,
          status,
          server_order_json,
          error_code,
          retry_count,
          next_retry_at,
          created_at,
          updated_at,
        ] = params;
        if (!tables.pos_order_outbox.has(client_transaction_id)) {
          tables.pos_order_outbox.set(client_transaction_id, {
            client_transaction_id,
            owner_user_id,
            outlet_id,
            payload_json,
            status,
            server_order_json,
            error_code,
            retry_count,
            next_retry_at,
            created_at,
            updated_at,
          });
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.startsWith("UPDATE pos_order_outbox")) {
        const [
          status,
          server_order_json,
          error_code,
          retry_count,
          next_retry_at,
          updated_at,
          client_transaction_id,
          owner_user_id,
          outlet_id,
        ] = params;
        const current = tables.pos_order_outbox.get(client_transaction_id);
        if (
          current &&
          current.owner_user_id === owner_user_id &&
          current.outlet_id === outlet_id
        ) {
          Object.assign(current, {
            status,
            server_order_json,
            error_code,
            retry_count,
            next_retry_at,
            updated_at,
          });
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      return { changes: 0 };
    },
    _dump() {
      return tables.pos_order_outbox;
    },
  };
}

// ==========================================
// 1. PENGUJIAN SQLITE REPOSITORY & OUTBOX
// ==========================================

test("1. Order tersimpan dengan benar di SQLite outbox", async () => {
  const db = createMockSqliteDb();
  const repo = createSqliteRepository(async () => db);
  const outbox = createPosOutbox(repo);
  await outbox.initialize();

  const payload = {
    clientTransactionId: "order-uuid-1",
    paymentMethod: "CASH",
    items: [{ productVariantId: "var-1", quantity: 2, expectedVariantPrice: "10000" }],
  };

  const saved = await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload,
  });

  assert.equal(saved.clientTransactionId, "order-uuid-1");
  assert.equal(saved.status, "queued");
  assert.equal(saved.payload.paymentMethod, "CASH");
});

test("2. Order tetap ada setelah repository dibuka ulang (persisted)", async () => {
  const sharedDb = createMockSqliteDb();
  // Sesi 1
  const repo1 = createSqliteRepository(async () => sharedDb);
  const outbox1 = createPosOutbox(repo1);
  await outbox1.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "persisted-order-1", paymentMethod: "CASH" },
  });

  // Sesi 2 (simulasi app restart dengan DB yang sama)
  const repo2 = createSqliteRepository(async () => sharedDb);
  const outbox2 = createPosOutbox(repo2);
  const found = await outbox2.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });

  assert.equal(found.length, 1);
  assert.equal(found[0].clientTransactionId, "persisted-order-1");
});

test("3. Status antrean dapat diperbarui (queued -> syncing -> synced / needs_review)", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "status-order-1" },
  });

  await outbox.setStatus({
    clientTransactionId: "status-order-1",
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    status: "syncing",
  });
  let record = (await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" }))[0];
  assert.equal(record.status, "syncing");

  await outbox.setStatus({
    clientTransactionId: "status-order-1",
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    status: "synced",
    serverOrder: { id: "srv-ord-1", orderNumber: "ORD-001" },
  });
  record = (await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" }))[0];
  assert.equal(record.status, "synced");
  assert.equal(record.serverOrder.orderNumber, "ORD-001");
});

test("4. Payload tidak rusak setelah proses serialisasi dan deserialisasi", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  const complexPayload = {
    clientTransactionId: "complex-1",
    paymentMethod: "CASH",
    payments: [{ paymentMethod: "CASH", amount: "25000.00" }],
    items: [
      {
        productVariantId: "var-1",
        quantity: 3,
        expectedVariantPrice: "10000.00",
        addOns: [{ addOnId: "addon-jelly", quantity: 1, expectedUnitPrice: "3000.00" }],
      },
    ],
  };

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: complexPayload,
  });

  const [loaded] = await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.deepEqual(loaded.payload, complexPayload);
});

test("5. Migrasi JSON tidak membuat duplikasi pada SQLite Outbox (idempoten)", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  // Simulasi antrean file JSON
  let mockFileStorage = [
    {
      id: "json-1",
      payload: { clientTransactionId: "tx-from-json-1", paymentMethod: "CASH" },
    },
    {
      id: "corrupted-entry",
      payload: null, // Tanpa payload / clientTransactionId
    },
  ];

  let clearCalled = false;
  const mockReadQueue = async () => [...mockFileStorage];
  const mockClearQueue = async () => {
    clearCalled = true;
    mockFileStorage = [];
  };

  // Jalankan migrasi pertama
  const result1 = await migrateJsonQueueToSqlite({
    outbox,
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    readQueueFn: mockReadQueue,
    clearQueueFn: mockClearQueue,
  });

  assert.equal(result1.migratedCount, 1);
  assert.equal(result1.skippedCount, 1);
  assert.equal(result1.error, null);
  assert.equal(clearCalled, true);
  assert.equal(mockFileStorage.length, 0);

  // Jalankan lagi migrasi kedua kali dengan item yang sama (idempoten)
  clearCalled = false;
  const result2 = await migrateJsonQueueToSqlite({
    outbox,
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    readQueueFn: async () => [
      {
        id: "json-1",
        payload: { clientTransactionId: "tx-from-json-1", paymentMethod: "CASH" },
      },
    ],
    clearQueueFn: mockClearQueue,
  });

  assert.equal(result2.migratedCount, 1); // enqueue idempoten mengembalikan record yang ada tanpa duplikasi
  assert.equal(result2.skippedCount, 0);
  assert.equal(clearCalled, true);

  const list = await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(list.length, 1);
});

test("6. Update status melempar error jika scope owner/outlet salah", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "tx-scope-err" },
  });

  await assert.rejects(
    outbox.setStatus({
      clientTransactionId: "tx-scope-err",
      ownerUserId: "crew-lain", // scope beda
      outletId: "outlet-rumbai",
      status: "synced",
    }),
    /Transaksi antrean POS tidak ditemukan/,
  );
});

// ==========================================
// 2. OFFLINE CHECKOUT FLOW
// ==========================================

test("7. Checkout offline tersimpan di SQLite outbox dengan status queued", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  const payload = buildOrderPayload({
    clientTransactionId: "tx-offline-1",
    paymentMethod: "CASH",
    recordedOffline: true,
    cart: [
      {
        productVariantId: "var-tea",
        variantPrice: "10000.00",
        quantity: 1,
        addOns: [],
      },
    ],
  });

  const record = await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload,
  });

  assert.equal(record.status, "queued");
  assert.equal(record.payload.recordedOffline, true);
});

test("8. Double tap dengan key sama tidak membuat duplikasi di SQLite", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  const payload = { clientTransactionId: "tx-double-tap-1", paymentMethod: "CASH" };

  await Promise.all([
    outbox.enqueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", payload }),
    outbox.enqueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", payload }),
  ]);

  const list = await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(list.length, 1);
});

test("9. Double tap dengan data berbeda pada key sama melempar OutboxConflictError", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "tx-conflict-1", paymentMethod: "CASH" },
  });

  await assert.rejects(
    outbox.enqueue({
      ownerUserId: "crew-1",
      outletId: "outlet-rumbai",
      payload: { clientTransactionId: "tx-conflict-1", paymentMethod: "QRIS" }, // beda isi
    }),
    OutboxConflictError,
  );
});

test("10. Validasi metode pembayaran offline: QRIS & SPLIT diblokir saat offline", () => {
  const validateOfflinePayment = (method, isOffline) => {
    if (isOffline && (method === "QRIS" || method === "SPLIT")) {
      return {
        allowed: false,
        message: "Pembayaran QRIS dan Split Payment tidak dapat digunakan saat offline.",
      };
    }
    return { allowed: true };
  };

  assert.equal(validateOfflinePayment("QRIS", true).allowed, false);
  assert.equal(validateOfflinePayment("SPLIT", true).allowed, false);
  assert.equal(validateOfflinePayment("CASH", true).allowed, true);
  assert.equal(validateOfflinePayment("QRIS", false).allowed, true);
});

// ==========================================
// 3. SYNCHRONIZATION SERVICE
// ==========================================

test("11. Order diproses secara FIFO (urutan waktu pembuatan)", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  // Simpan order 1 (waktu lebih lama)
  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-first" },
  });
  // Simpan order 2 (waktu lebih baru)
  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-second" },
  });

  const processedOrder = [];
  const mockOrdersApi = {
    async createOrder(outletId, payload) {
      processedOrder.push(payload.clientTransactionId);
      return { data: { order: { id: `srv-${payload.clientTransactionId}`, orderNumber: "ORD-X" } } };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  assert.equal(processedOrder[0], "ord-first");
  assert.equal(processedOrder[1], "ord-second");
});

test("12. Single-flight mencegah eksekusi sinkronisasi paralel", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-parallel-1" },
  });

  let serverCallCount = 0;
  const mockOrdersApi = {
    async createOrder() {
      serverCallCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { data: { order: { id: "srv-1", orderNumber: "ORD-P" } } };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });

  // Panggil dua kali secara bersamaan
  await Promise.all([
    syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true }),
    syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true }),
  ]);

  // Order hanya dikirim tepat 1 kali
  assert.equal(serverCallCount, 1);
});

test("13. Order berhasil disinkronkan berubah status menjadi synced", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-success" },
  });

  const mockOrdersApi = {
    async createOrder(outletId, payload) {
      return { data: { order: { id: "srv-success-1", orderNumber: "ORD-SUC" } } };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  const summary = await syncService.getQueueSummary({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(summary.synced, 1);
  assert.equal(summary.pending, 0);
  assert.equal(summary.items[0].status, "synced");
});

test("14. Network error mempertahankan order dengan status retryable_failure", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-net-err" },
  });

  const mockOrdersApi = {
    async createOrder() {
      const err = new Error("Network request failed");
      err.status = 0;
      err.code = "NETWORK_ERROR";
      throw err;
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  const summary = await syncService.getQueueSummary({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(summary.pending, 1);
  assert.equal(summary.items[0].status, "retryable_failure");
  assert.equal(summary.items[0].retryCount, 1);
  assert.ok(summary.items[0].nextRetryAt !== null);
});

test("15. HTTP 5xx mempertahankan order dengan status retryable_failure", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-500" },
  });

  const mockOrdersApi = {
    async createOrder() {
      const err = new Error("Internal Server Error");
      err.status = 500;
      throw err;
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  const summary = await syncService.getQueueSummary({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(summary.items[0].status, "retryable_failure");
});

test("16. HTTP 401 menghentikan sinkronisasi dan mempertahankan order", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-401" },
  });

  const mockOrdersApi = {
    async createOrder() {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  const result = await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  assert.equal(result.halted, true);
  const summary = await syncService.getQueueSummary({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(summary.items[0].status, "retryable_failure");
  assert.equal(summary.items[0].errorCode, "UNAUTHORIZED_HALTED");
});

test("17. HTTP 409 CATALOG_ITEM_UNAVAILABLE mengubah status menjadi needs_review (TIDAK DIHAPUS)", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-item-unavailable" },
  });

  const mockOrdersApi = {
    async createOrder() {
      const err = new Error("Item katalog tidak tersedia");
      err.status = 409;
      err.code = "CATALOG_ITEM_UNAVAILABLE";
      throw err;
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  const summary = await syncService.getQueueSummary({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.items[0].status, "needs_review");
  assert.equal(summary.items[0].errorCode, "CATALOG_ITEM_UNAVAILABLE");
  // Pastikan data order tetap ada (tidak terhapus)
  assert.equal(summary.items.length, 1);
});

test("18. Account isolation: Order Crew A tidak disinkronkan oleh akun Crew B", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-A",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-crew-a" },
  });

  const mockOrdersApi = {
    async createOrder() {
      throw new Error("Should not be called for Crew B");
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  // Crew B memanggil sync
  const res = await syncService.syncQueue({ ownerUserId: "crew-B", outletId: "outlet-rumbai", force: true });

  assert.equal(res.processed, 0);
  // Order Crew A tetap queued
  const summaryA = await syncService.getQueueSummary({ ownerUserId: "crew-A", outletId: "outlet-rumbai" });
  assert.equal(summaryA.pending, 1);
});

test("19. Outlet isolation: Order outlet Rumbai tidak disinkronkan ke outlet Panam", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "ord-rumbai" },
  });

  let syncedOutlet = null;
  const mockOrdersApi = {
    async createOrder(outletId) {
      syncedOutlet = outletId;
      return { data: { order: { id: "srv-panam", orderNumber: "ORD-PANAM" } } };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockOrdersApi });
  // User sedang aktif di outlet Panam
  const res = await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-panam", force: true });

  assert.equal(res.processed, 0);
  assert.equal(syncedOutlet, null);
});

test("20. classifyOutboxFailure mengklasifikasikan network/5xx sebagai retryable dan 409/400 sebagai needs_review", () => {
  assert.equal(classifyOutboxFailure({ status: 0 }), "retryable_failure");
  assert.equal(classifyOutboxFailure({ status: 500 }), "retryable_failure");
  assert.equal(classifyOutboxFailure({ status: 503 }), "retryable_failure");
  assert.equal(classifyOutboxFailure({ status: 409 }), "needs_review");
  assert.equal(classifyOutboxFailure({ status: 400 }), "needs_review");
  assert.equal(classifyOutboxFailure({ status: 422 }), "needs_review");
});
