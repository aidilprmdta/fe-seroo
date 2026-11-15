const OUTBOX_STATUSES = new Set([
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
    serverOrder: record.serverOrderJson
      ? JSON.parse(record.serverOrderJson)
      : null,
  };
}

export class OutboxConflictError extends Error {
  constructor() {
    super("ID transaksi lokal sudah digunakan dengan data berbeda.");
    this.name = "OutboxConflictError";
  }
}

export function createPosOutbox(repository, now = () => new Date()) {
  return {
    async initialize() {
      await repository.initialize();
    },

    async enqueue({ ownerUserId, outletId, payload }) {
      if (
        typeof ownerUserId !== "string" ||
        typeof outletId !== "string" ||
        payload?.clientTransactionId === undefined
      ) {
        throw new Error("Konteks antrean POS tidak lengkap.");
      }

      const record = {
        clientTransactionId: payload.clientTransactionId,
        ownerUserId,
        outletId,
        payloadJson: JSON.stringify(payload),
        status: "queued",
        serverOrderJson: null,
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
        throw new OutboxConflictError();
      }
      return parseRecord(saved);
    },

    async listRecent({ ownerUserId, outletId }) {
      const records = await repository.list({ ownerUserId, outletId });
      return records.map(parseRecord);
    },

    async markNeedsReview({ ownerUserId }) {
      if (typeof ownerUserId !== "string") {
        throw new Error("Pemilik antrean POS tidak valid.");
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
      serverOrder = null,
      errorCode = null,
      retryCount,
      nextRetryAt = null,
    }) {
      if (!OUTBOX_STATUSES.has(status)) {
        throw new Error("Status antrean POS tidak valid.");
      }
      const current = await repository.find(clientTransactionId);
      if (
        !current ||
        current.ownerUserId !== ownerUserId ||
        current.outletId !== outletId
      ) {
        throw new Error("Transaksi antrean POS tidak ditemukan.");
      }
      await repository.update({
        clientTransactionId,
        ownerUserId,
        outletId,
        status,
        serverOrderJson: serverOrder ? JSON.stringify(serverOrder) : null,
        errorCode,
        retryCount: retryCount ?? current.retryCount,
        nextRetryAt:
          status === "retryable_failure" ? nextRetryAt : null,
        updatedAt: now().toISOString(),
      });
    },
  };
}
