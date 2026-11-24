const STORAGE_KEY = "seroo_waste_outbox";

function getStorage() {
  if (
    typeof window !== "undefined" &&
    window.localStorage &&
    typeof window.localStorage.getItem === "function"
  ) {
    return window.localStorage;
  }
  return null;
}

export function createWasteWebRepository(customStorage = null) {
  let memoryStore = new Map();

  function loadAll() {
    const storage = customStorage || getStorage();
    if (!storage) {
      return Array.from(memoryStore.values());
    }
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return Array.from(memoryStore.values());
    }
  }

  function saveAll(items) {
    const storage = customStorage || getStorage();
    if (!storage) {
      memoryStore = new Map(items.map((item) => [item.clientTransactionId, item]));
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      memoryStore = new Map(items.map((item) => [item.clientTransactionId, item]));
    }
  }

  return {
    async initialize() {
      // No-op on web
    },

    async insert(record) {
      const items = loadAll();
      const existing = items.find(
        (it) => it.clientTransactionId === record.clientTransactionId,
      );
      if (!existing) {
        items.push({ ...record });
        saveAll(items);
      }
    },

    async find(clientTransactionId) {
      const items = loadAll();
      const item = items.find((it) => it.clientTransactionId === clientTransactionId);
      return item ? { ...item } : null;
    },

    async list({ ownerUserId, outletId }) {
      const items = loadAll();
      return items
        .filter(
          (it) => it.ownerUserId === ownerUserId && it.outletId === outletId,
        )
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    },

    async markNeedsReview({ ownerUserId }) {
      const items = loadAll();
      const eligibleStatuses = new Set(["queued", "syncing", "retryable_failure"]);
      let changes = 0;
      const nowIso = new Date().toISOString();

      const updated = items.map((it) => {
        if (it.ownerUserId === ownerUserId && eligibleStatuses.has(it.status)) {
          changes++;
          return {
            ...it,
            status: "needs_review",
            errorCode: "SESSION_ENDED_REVIEW",
            nextRetryAt: null,
            updatedAt: nowIso,
          };
        }
        return it;
      });

      if (changes > 0) {
        saveAll(updated);
      }
      return changes;
    },

    async update(record) {
      const items = loadAll();
      const index = items.findIndex(
        (it) =>
          it.clientTransactionId === record.clientTransactionId &&
          it.ownerUserId === record.ownerUserId &&
          it.outletId === record.outletId,
      );

      if (index === -1) {
        throw new Error("Transaksi antrean waste tidak ditemukan.");
      }

      items[index] = {
        ...items[index],
        status: record.status,
        serverWasteJson: record.serverWasteJson,
        errorCode: record.errorCode,
        retryCount: record.retryCount,
        nextRetryAt: record.nextRetryAt,
        updatedAt: record.updatedAt,
      };

      saveAll(items);
    },
  };
}
