import { classifyOutboxFailure, retryDelayMs } from './cart.js';

let activeSyncPromise = null;

export function createPosSyncService({ outbox, ordersApi, now = () => new Date() }) {
  return {
    isSyncing() {
      return activeSyncPromise !== null;
    },

    async syncQueue({ ownerUserId, outletId, force = false }) {
      if (!ownerUserId || !outletId) {
        return { success: false, reason: 'INVALID_SCOPE', processed: 0 };
      }

      // Single-flight: jika sedang ada proses sinkronisasi, gabungkan atau return promise yang sedang berjalan
      if (activeSyncPromise) {
        return activeSyncPromise;
      }

      activeSyncPromise = (async () => {
        try {
          await outbox.initialize();
          const pending = await outbox.listPending({ ownerUserId, outletId, force });

          let processedCount = 0;
          let hasHalted = false;

          // Proses FIFO satu per satu
          for (const record of pending) {
            // Tandai sedang syncing
            try {
              await outbox.setStatus({
                clientTransactionId: record.clientTransactionId,
                ownerUserId,
                outletId,
                status: 'syncing',
                retryCount: record.retryCount,
              });
            } catch {
              // Jika record tidak dapat diupdate, lewati
              continue;
            }

            try {
              const res = await ordersApi.createOrder(outletId, record.payload);
              const serverOrder = res?.data?.order || res?.order || res;

              // Berhasil disinkronkan ke server
              await outbox.setStatus({
                clientTransactionId: record.clientTransactionId,
                ownerUserId,
                outletId,
                status: 'synced',
                serverOrder,
                errorCode: null,
                retryCount: record.retryCount,
              });
              processedCount++;
            } catch (err) {
              const status = err?.status ?? err?.statusCode ?? 0;
              const code = err?.code || (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`);
              const failureType = classifyOutboxFailure({ status });

              if (status === 401) {
                // Sesi tidak valid / kedaluwarsa: hentikan proses agar tidak mengirim request gagal berulang
                await outbox.setStatus({
                  clientTransactionId: record.clientTransactionId,
                  ownerUserId,
                  outletId,
                  status: 'retryable_failure',
                  errorCode: 'UNAUTHORIZED_HALTED',
                  retryCount: record.retryCount,
                  nextRetryAt: null,
                });
                hasHalted = true;
                break;
              }

              if (failureType === 'needs_review' || status === 409 || status === 400) {
                // Masalah bisnis (misal menu tidak tersedia atau validasi): JANGAN DIHAPUS, tandai needs_review
                await outbox.setStatus({
                  clientTransactionId: record.clientTransactionId,
                  ownerUserId,
                  outletId,
                  status: 'needs_review',
                  errorCode: code,
                  retryCount: record.retryCount + 1,
                  nextRetryAt: null,
                });
              } else {
                // Network error atau 5xx: retryable_failure dengan exponential backoff
                const nextRetryMs = retryDelayMs(record.retryCount);
                const nextRetryDate = new Date(now().getTime() + nextRetryMs).toISOString();

                await outbox.setStatus({
                  clientTransactionId: record.clientTransactionId,
                  ownerUserId,
                  outletId,
                  status: 'retryable_failure',
                  errorCode: code,
                  retryCount: record.retryCount + 1,
                  nextRetryAt: nextRetryDate,
                });
                // Hentikan antrean saat koneksi jaringan terputus agar tidak membebani
                hasHalted = true;
                break;
              }
            }
          }

          return { success: true, processed: processedCount, halted: hasHalted };
        } finally {
          activeSyncPromise = null;
        }
      })();

      return activeSyncPromise;
    },

    async getQueueSummary({ ownerUserId, outletId }) {
      if (!ownerUserId || !outletId) {
        return { total: 0, pending: 0, syncing: 0, synced: 0, needsReview: 0, items: [] };
      }
      try {
        await outbox.initialize();
        const records = await outbox.listRecent({ ownerUserId, outletId });
        const summary = {
          total: records.length,
          pending: 0,
          syncing: 0,
          synced: 0,
          needsReview: 0,
          items: records,
        };

        for (const r of records) {
          if (r.status === 'queued' || r.status === 'retryable_failure') {
            summary.pending++;
          } else if (r.status === 'syncing') {
            summary.syncing++;
          } else if (r.status === 'synced') {
            summary.synced++;
          } else if (r.status === 'needs_review') {
            summary.needsReview++;
          }
        }
        return summary;
      } catch {
        return { total: 0, pending: 0, syncing: 0, synced: 0, needsReview: 0, items: [] };
      }
    },
  };
}
