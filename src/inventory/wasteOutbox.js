const STATUSES = new Set([
  "queued",
  "syncing",
  "synced",
  "retryable_failure",
  "needs_review",
]);

function parseRecord(record) {
  return {
    ...record,
    payload: JSON.parse(record.payloadJson),
    serverWaste: record.serverWasteJson
      ? JSON.parse(record.serverWasteJson)
      : null,
  };
}

export class WasteOutboxConflictError extends Error {
  constructor() {
    super("ID transaksi waste lokal sudah digunakan dengan data berbeda.");
    this.name = "WasteOutboxConflictError";
  }
}

export function createWasteOutbox(repository, now = () => new Date()) {
  return {
    async initialize() {
      await repository.initialize();
    },

    async enqueue({ ownerUserId, outletId, payload }) {
      if (
        typeof ownerUserId !== "string" ||
        typeof outletId !== "string" ||
        typeof payload?.clientTransactionId !== "string"
      ) {
        throw new Error("Konteks antrean waste tidak lengkap.");
      }

      const record = {
        clientTransactionId: payload.clientTransactionId,
        ownerUserId,
        outletId,
        payloadJson: JSON.stringify(payload),
        status: "queued",
        serverWasteJson: null,
        errorCode: null,
        retryCount: 0,
        nextRetryAt: null,
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };
      await repository.insert(record);
      const saved = await repository.find(record.clientTransactionId);
      if (
        !saved ||
        saved.ownerUserId !== ownerUserId ||
        saved.outletId !== outletId ||
        saved.payloadJson !== record.payloadJson
      ) {
        throw new WasteOutboxConflictError();
      }
      return parseRecord(saved);
    },

    async listRecent({ ownerUserId, outletId }) {
      const records = await repository.list({ ownerUserId, outletId });
      return records.map(parseRecord);
    },

    async markNeedsReview({ ownerUserId }) {
      if (typeof ownerUserId !== "string") {
        throw new Error("Pemilik antrean waste tidak valid.");
      }
      if (!repository.markNeedsReview) return 0;
      return repository.markNeedsReview({ ownerUserId });
    },

    async listPending({ ownerUserId, outletId, force = false }) {
      const records = await repository.list({ ownerUserId, outletId });
      return records
        .filter((record) =>
          ["queued", "syncing", "retryable_failure"].includes(record.status),
        )
        .filter(
          (record) =>
            force ||
            !record.nextRetryAt ||
            Date.parse(record.nextRetryAt) <= now().getTime(),
        )
        .map(parseRecord);
    },

    async setStatus({
      clientTransactionId,
      ownerUserId,
      outletId,
      status,
      serverWaste = null,
      errorCode = null,
      retryCount,
      nextRetryAt = null,
    }) {
      if (!STATUSES.has(status)) {
        throw new Error("Status antrean waste tidak valid.");
      }
      const current = await repository.find(clientTransactionId);
      if (
        !current ||
        current.ownerUserId !== ownerUserId ||
        current.outletId !== outletId
      ) {
        throw new Error("Transaksi antrean waste tidak ditemukan.");
      }
      await repository.update({
        clientTransactionId,
        ownerUserId,
        outletId,
        status,
        serverWasteJson: serverWaste ? JSON.stringify(serverWaste) : null,
        errorCode,
        retryCount: retryCount ?? current.retryCount,
        nextRetryAt:
          status === "retryable_failure" ? nextRetryAt : null,
        updatedAt: now().toISOString(),
      });
    },
  };
}
