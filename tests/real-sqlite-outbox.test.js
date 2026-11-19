import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const TEST_DB_FILE = path.join(process.cwd(), "test-real-outbox.db");

function cleanupTestDb() {
  try {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  } catch {}
}

const REAL_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS pos_order_outbox (
  client_transaction_id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'syncing', 'synced', 'retryable_failure', 'needs_review')
  ),
  server_order_json TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pos_order_outbox_scope
ON pos_order_outbox(owner_user_id, outlet_id, status, created_at);
`;

test("REAL SQLITE ENGINE VALIDATION (Menggunakan C-Engine SQLite Sebenarnya via node:sqlite)", async (t) => {
  cleanupTestDb();

  t.after(() => {
    cleanupTestDb();
  });

  // 1. Inisialisasi file database SQLite nyata di disk dan eksekusi DDL
  let db = new DatabaseSync(TEST_DB_FILE);
  db.exec(REAL_SQLITE_DDL);

  const samplePayload = {
    clientTransactionId: "real-sqlite-tx-001",
    paymentMethod: "CASH",
    items: [
      {
        productVariantId: "var-teh-manis",
        quantity: 2,
        expectedVariantPrice: "8000.00",
        addOns: [{ addOnId: "addon-extra-ice", quantity: 1, expectedUnitPrice: "2000.00" }],
      },
    ],
  };

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO pos_order_outbox
      (client_transaction_id, owner_user_id, outlet_id, payload_json,
       status, server_order_json, error_code, retry_count, next_retry_at,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Point 1: Insert order ke database SQLite sebenarnya
  insertStmt.run(
    samplePayload.clientTransactionId,
    "crew-real-user-1",
    "outlet-real-rumbai",
    JSON.stringify(samplePayload),
    "queued",
    null,
    null,
    0,
    null,
    new Date("2026-11-19T10:00:00Z").toISOString(),
    new Date("2026-11-19T10:00:00Z").toISOString(),
  );

  // Point 2: Tutup koneksi database secara penuh
  db.close();

  // Point 3: Buka kembali koneksi database dari file disk
  db = new DatabaseSync(TEST_DB_FILE);

  // Point 4: Order tetap tersedia setelah database ditutup dan dibuka ulang (Durable Persistence)
  const selectStmt = db.prepare(`SELECT * FROM pos_order_outbox WHERE client_transaction_id = ?`);
  const loadedRow = selectStmt.get("real-sqlite-tx-001");

  assert.ok(loadedRow, "Data order harus tetap ada di SQLite file disk setelah koneksi ditutup");
  assert.equal(loadedRow.client_transaction_id, "real-sqlite-tx-001");

  // Point 5: Payload tidak rusak atau terpotong setelah serialisasi/deserialisasi
  const parsedLoadedPayload = JSON.parse(loadedRow.payload_json);
  assert.deepEqual(parsedLoadedPayload, samplePayload);

  // Point 6: Status antrean tetap valid
  assert.equal(loadedRow.status, "queued");

  // Point 7: Unique constraint client_transaction_id bekerja di level database engine
  const strictInsertStmt = db.prepare(`
    INSERT INTO pos_order_outbox
      (client_transaction_id, owner_user_id, outlet_id, payload_json,
       status, server_order_json, error_code, retry_count, next_retry_at,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  assert.throws(
    () => {
      // Mencoba insert dengan primary key yang sama persis tanpa IGNORE
      strictInsertStmt.run(
        samplePayload.clientTransactionId,
        "crew-real-user-1",
        "outlet-real-rumbai",
        JSON.stringify(samplePayload),
        "queued",
        null,
        null,
        0,
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    },
    /UNIQUE constraint failed/,
    "SQLite native engine harus melempar UNIQUE constraint failed ketika key sama dimasukkan ulang",
  );

  // Point 8: Query terisolasi berdasarkan ownerUserId dan outletId
  // Insert order milik user lain dan outlet lain
  strictInsertStmt.run(
    "real-sqlite-tx-002",
    "crew-user-b",
    "outlet-real-rumbai",
    JSON.stringify({ clientTransactionId: "real-sqlite-tx-002" }),
    "queued",
    null,
    null,
    0,
    null,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  strictInsertStmt.run(
    "real-sqlite-tx-003",
    "crew-real-user-1",
    "outlet-panam",
    JSON.stringify({ clientTransactionId: "real-sqlite-tx-003" }),
    "queued",
    null,
    null,
    0,
    null,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  const queryScopedStmt = db.prepare(`
    SELECT * FROM pos_order_outbox
    WHERE owner_user_id = ? AND outlet_id = ?
    ORDER BY created_at DESC
  `);

  const crew1RumbaiRows = queryScopedStmt.all("crew-real-user-1", "outlet-real-rumbai");
  assert.equal(crew1RumbaiRows.length, 1);
  assert.equal(crew1RumbaiRows[0].client_transaction_id, "real-sqlite-tx-001");

  const crewBRows = queryScopedStmt.all("crew-user-b", "outlet-real-rumbai");
  assert.equal(crewBRows.length, 1);
  assert.equal(crewBRows[0].client_transaction_id, "real-sqlite-tx-002");

  // Point 9: Transaksi SQLite atomik untuk perubahan status
  const updateTxStmt = db.prepare(`
    UPDATE pos_order_outbox
    SET status = ?, server_order_json = ?, updated_at = ?
    WHERE client_transaction_id = ? AND owner_user_id = ? AND outlet_id = ?
  `);

  db.exec("BEGIN TRANSACTION;");
  updateTxStmt.run(
    "synced",
    JSON.stringify({ id: "srv-order-real-1", orderNumber: "ORD-001" }),
    new Date().toISOString(),
    "real-sqlite-tx-001",
    "crew-real-user-1",
    "outlet-real-rumbai",
  );
  db.exec("COMMIT;");

  const syncedRow = selectStmt.get("real-sqlite-tx-001");
  assert.equal(syncedRow.status, "synced");
  assert.equal(JSON.parse(syncedRow.server_order_json).orderNumber, "ORD-001");

  // Point 10: Rollback pada transaksi yang gagal tidak meninggalkan data setengah tersimpan
  db.exec("BEGIN TRANSACTION;");
  updateTxStmt.run(
    "needs_review",
    null,
    new Date().toISOString(),
    "real-sqlite-tx-001",
    "crew-real-user-1",
    "outlet-real-rumbai",
  );
  // Simulasikan kegagalan sebelum commit
  db.exec("ROLLBACK;");

  const rolledBackRow = selectStmt.get("real-sqlite-tx-001");
  assert.equal(rolledBackRow.status, "synced", "Status harus tetap 'synced' karena transaksi di-rollback");

  db.close();
});
