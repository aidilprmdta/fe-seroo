import assert from "node:assert/strict";
import test from "node:test";
import { createSqliteRepository } from "../src/pos/sqliteRepository.js";
import { createPosOutbox, OutboxConflictError } from "../src/pos/outbox.js";
import { createPosSyncService } from "../src/pos/syncService.js";
import { createNetworkMonitor } from "../src/pos/networkMonitor.js";
import { buildOrderPayload } from "../src/pos/cart.js";

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
        if (sql.includes("SET status = 'needs_review'")) {
          const [errorCode, updatedAt, ownerUserId] = params;
          let changes = 0;
          for (const item of tables.pos_order_outbox.values()) {
            if (
              item.owner_user_id === ownerUserId &&
              ["queued", "syncing", "retryable_failure"].includes(item.status)
            ) {
              item.status = "needs_review";
              item.error_code = errorCode;
              item.updated_at = updatedAt;
              changes++;
            }
          }
          return { changes };
        }
        if (sql.includes("SET status = 'queued'")) {
          const [updatedAt, ownerUserId, outletId, matchCode] = params;
          let changes = 0;
          for (const item of tables.pos_order_outbox.values()) {
            if (
              item.owner_user_id === ownerUserId &&
              item.outlet_id === outletId &&
              item.status === "needs_review" &&
              item.error_code === matchCode
            ) {
              item.status = "queued";
              item.error_code = null;
              item.next_retry_at = null;
              item.updated_at = updatedAt;
              changes++;
            }
          }
          return { changes };
        }
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
// PENGUJIAN PENGUATAN TASK 05.1
// ==========================================

test("1. Event offline -> online memicu callback onReconnect pada network monitor", async () => {
  let isConnectedState = false;
  let reconnectedCalled = 0;
  let statusChangeCount = 0;

  const monitor = createNetworkMonitor({
    getNetworkStateAsync: async () => ({ isConnected: isConnectedState }),
    onReconnect: async () => {
      reconnectedCalled++;
    },
    onStatusChange: () => {
      statusChangeCount++;
    },
  });

  monitor.start();
  await monitor.triggerCheck(); // State awal: false
  assert.equal(reconnectedCalled, 0);

  // Koneksi berubah menjadi online
  isConnectedState = true;
  await monitor.triggerCheck();
  assert.equal(reconnectedCalled, 1, "onReconnect harus terpanggil ketika offline berubah ke online");

  // Masih online pada cek berikutnya -> jangan panggil onReconnect lagi
  await monitor.triggerCheck();
  assert.equal(reconnectedCalled, 1, "onReconnect tidak boleh dipanggil jika status sudah online");

  monitor.stop();
});

test("2. Event network reconnect berulang kali tidak membuat worker ganda (single-flight / anti-debounce)", async () => {
  let isConnectedState = false;
  let concurrentExecutions = 0;
  let maxConcurrent = 0;
  let triggerCount = 0;

  const monitor = createNetworkMonitor({
    getNetworkStateAsync: async () => ({ isConnected: isConnectedState }),
    onReconnect: async () => {
      triggerCount++;
      concurrentExecutions++;
      maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
      await new Promise((r) => setTimeout(r, 10));
      concurrentExecutions--;
    },
  });

  monitor.start();
  await monitor.triggerCheck();

  isConnectedState = true;
  // Trigger bersamaan 3 kali
  await Promise.all([
    monitor.triggerCheck(),
    monitor.triggerCheck(),
    monitor.triggerCheck(),
  ]);

  assert.equal(maxConcurrent, 1, "Worker sinkronisasi network monitor harus single-flight (tidak konkuren)");
  monitor.stop();
});

test("3. Logout menandai pending order sebagai needs_review (SESSION_ENDED_REVIEW) dan TIDAK menghapusnya", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "logout-tx-1", paymentMethod: "CASH" },
  });

  // Simulasi logout
  await outbox.markNeedsReview({ ownerUserId: "crew-1" });

  const rows = await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(rows.length, 1, "Order TIDAK boleh dihapus dari SQLite saat logout");
  assert.equal(rows[0].status, "needs_review");
  assert.equal(rows[0].errorCode, "SESSION_ENDED_REVIEW");
});

test("4. Pengguna login kembali memulihkan order SESSION_ENDED_REVIEW ke status queued", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "restore-tx-1", paymentMethod: "CASH" },
  });

  await outbox.markNeedsReview({ ownerUserId: "crew-1" });

  // Order saat ini needs_review
  let pending = await outbox.listPending({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(pending.length, 0);

  // Pengguna login kembali pada outlet yang sama
  const restored = await outbox.requeueSessionOrders({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(restored, 1);

  // Order kembali ke queued dan siap disinkronkan
  pending = await outbox.listPending({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].status, "queued");
  assert.equal(pending[0].errorCode, null);
});

test("5. Account isolation: Pengguna B login pada perangkat yang sama tidak dapat memulihkan antrean Pengguna A", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-A",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "isolated-tx-a", paymentMethod: "CASH" },
  });

  await outbox.markNeedsReview({ ownerUserId: "crew-A" });

  // Crew B login dan memanggil requeueSessionOrders
  const restoredForB = await outbox.requeueSessionOrders({ ownerUserId: "crew-B", outletId: "outlet-rumbai" });
  assert.equal(restoredForB, 0);

  // Antrean Crew A tetap aman dan tidak ikut queued untuk Crew B
  const pendingB = await outbox.listPending({ ownerUserId: "crew-B", outletId: "outlet-rumbai" });
  assert.equal(pendingB.length, 0);

  const recentA = await outbox.listRecent({ ownerUserId: "crew-A", outletId: "outlet-rumbai" });
  assert.equal(recentA[0].status, "needs_review");
});

test("6. Ambiguous network timeout mempertahankan clientTransactionId yang sama selama seluruh percobaan retry", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  const originalPayload = buildOrderPayload({
    clientTransactionId: "ambiguous-timeout-uuid-1",
    paymentMethod: "CASH",
    cart: [{ productVariantId: "var-1", variantPrice: "15000", quantity: 1, addOns: [] }],
  });

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: originalPayload,
  });

  let serverCallCount = 0;
  const receivedKeys = [];

  const flakyOrdersApi = {
    async createOrder(outletId, payload) {
      serverCallCount++;
      receivedKeys.push(payload.clientTransactionId);
      if (serverCallCount === 1) {
        // Request 1: Server sebenarnya mencatat transaksi, tetapi client terkena timeout/koneksi putus
        const timeoutErr = new Error("Gateway Timeout");
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      // Request 2: Retry dari client mengirimkan key yang sama
      return {
        data: {
          order: {
            id: "server-order-1",
            orderNumber: "ORD-001",
            clientTransactionId: payload.clientTransactionId,
          },
        },
      };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: flakyOrdersApi });

  // Percobaan 1: Gagal timeout
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });
  assert.equal(serverCallCount, 1);
  assert.equal(receivedKeys[0], "ambiguous-timeout-uuid-1");

  // Percobaan 2: Retry otomatis
  await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });
  assert.equal(serverCallCount, 2);
  assert.equal(receivedKeys[1], "ambiguous-timeout-uuid-1", "Client WAJIB menggunakan key yang sama persis");

  // Status berhasil disinkronkan tanpa membuat order ganda
  const [synced] = await outbox.listRecent({ ownerUserId: "crew-1", outletId: "outlet-rumbai" });
  assert.equal(synced.status, "synced");
  assert.equal(synced.serverOrder.id, "server-order-1");
});

test("7. Order needs_review tidak boleh disinkronkan otomatis oleh syncQueue", async () => {
  const db = createMockSqliteDb();
  const outbox = createPosOutbox(createSqliteRepository(async () => db));

  await outbox.enqueue({
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    payload: { clientTransactionId: "stuck-review-1" },
  });

  await outbox.setStatus({
    clientTransactionId: "stuck-review-1",
    ownerUserId: "crew-1",
    outletId: "outlet-rumbai",
    status: "needs_review",
    errorCode: "CATALOG_ITEM_UNAVAILABLE",
  });

  let called = false;
  const mockApi = {
    async createOrder() {
      called = true;
      return { data: { order: { id: "srv" } } };
    },
  };

  const syncService = createPosSyncService({ outbox, ordersApi: mockApi });
  const res = await syncService.syncQueue({ ownerUserId: "crew-1", outletId: "outlet-rumbai", force: true });

  assert.equal(res.processed, 0);
  assert.equal(called, false, "Order berstatus needs_review tidak boleh dikirim ulang ke backend secara otomatis");
});
