const DATABASE_NAME = "seroo-pos.db";

const CREATE_TABLES = `
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

function mapRow(row) {
  if (!row) return null;
  return {
    clientTransactionId: row.client_transaction_id,
    ownerUserId: row.owner_user_id,
    outletId: row.outlet_id,
    payloadJson: row.payload_json,
    status: row.status,
    serverOrderJson: row.server_order_json,
    errorCode: row.error_code,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSqliteRepository(openDatabaseAsync) {
  let databasePromise;

  async function getDatabase() {
    if (!databasePromise) {
      databasePromise = openDatabaseAsync(DATABASE_NAME)
        .then(async (database) => {
          await database.execAsync(CREATE_TABLES);
        const columns = await database.getAllAsync(
          `PRAGMA table_info(pos_order_outbox)`,
        );
        if (!columns.some((column) => column.name === "retry_count")) {
          await database.execAsync(
            `ALTER TABLE pos_order_outbox ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`,
          );
        }
        if (!columns.some((column) => column.name === "next_retry_at")) {
          await database.execAsync(
            `ALTER TABLE pos_order_outbox ADD COLUMN next_retry_at TEXT`,
          );
        }
          return database;
        })
        .catch((error) => {
          databasePromise = null;
          throw error;
        });
    }
    return databasePromise;
  }

  return {
    async initialize() {
      await getDatabase();
    },

    async insert(record) {
      const database = await getDatabase();
      await database.runAsync(
        `INSERT OR IGNORE INTO pos_order_outbox
          (client_transaction_id, owner_user_id, outlet_id, payload_json,
           status, server_order_json, error_code, retry_count, next_retry_at,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        record.clientTransactionId,
        record.ownerUserId,
        record.outletId,
        record.payloadJson,
        record.status,
        record.serverOrderJson,
        record.errorCode,
        record.retryCount,
        record.nextRetryAt,
        record.createdAt,
        record.updatedAt,
      );
    },

    async find(clientTransactionId) {
      const database = await getDatabase();
      const row = await database.getFirstAsync(
        `SELECT * FROM pos_order_outbox WHERE client_transaction_id = ?`,
        clientTransactionId,
      );
      return mapRow(row);
    },

    async list({ ownerUserId, outletId }) {
      const database = await getDatabase();
      const rows = await database.getAllAsync(
        `SELECT * FROM pos_order_outbox
         WHERE owner_user_id = ? AND outlet_id = ?
         ORDER BY created_at DESC`,
        ownerUserId,
        outletId,
      );
      return rows.map(mapRow);
    },

    async markNeedsReview({ ownerUserId }) {
      const database = await getDatabase();
      const result = await database.runAsync(
        `UPDATE pos_order_outbox
         SET status = 'needs_review', error_code = ?, next_retry_at = NULL,
             updated_at = ?
         WHERE owner_user_id = ? AND status IN ('queued', 'syncing', 'retryable_failure')`,
        "SESSION_ENDED_REVIEW",
        new Date().toISOString(),
        ownerUserId,
      );
      return result.changes ?? 0;
    },

    async update(record) {
      const database = await getDatabase();
      const result = await database.runAsync(
        `UPDATE pos_order_outbox
         SET status = ?, server_order_json = ?, error_code = ?, retry_count = ?,
             next_retry_at = ?, updated_at = ?
         WHERE client_transaction_id = ? AND owner_user_id = ? AND outlet_id = ?`,
        record.status,
        record.serverOrderJson,
        record.errorCode,
        record.retryCount,
        record.nextRetryAt,
        record.updatedAt,
        record.clientTransactionId,
        record.ownerUserId,
        record.outletId,
      );
      if (result.changes !== 1) {
        throw new Error("Transaksi antrean POS tidak ditemukan.");
      }
    },
  };
}
