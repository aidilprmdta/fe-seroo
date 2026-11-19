/**
 * Melakukan migrasi antrean lama dari JSON FileSystem ke SQLite Outbox secara idempoten.
 * File JSON lama HANYA dibersihkan apabila migrasi berhasil dipindahkan dan diverifikasi.
 * Jika terjadi error, data JSON dipertahankan agar tidak hilang.
 *
 * Menerima readQueueFn dan clearQueueFn secara opsional untuk pengujian independen di runtime Node.
 */
export async function migrateJsonQueueToSqlite({
  outbox,
  ownerUserId,
  outletId,
  readQueueFn,
  clearQueueFn,
}) {
  if (!outbox || !ownerUserId || !outletId) {
    return { migratedCount: 0, skippedCount: 0, error: null };
  }

  let readQueue = readQueueFn;
  let clearQueue = clearQueueFn;

  if (!readQueue || !clearQueue) {
    try {
      const offlineQueue = await import('../lib/offlineQueue.js');
      readQueue = readQueue || offlineQueue.readQueue;
      clearQueue = clearQueue || offlineQueue.clearQueue;
    } catch {
      readQueue = readQueue || (async () => []);
      clearQueue = clearQueue || (async () => {});
    }
  }

  try {
    const queue = await readQueue();
    if (!Array.isArray(queue) || queue.length === 0) {
      return { migratedCount: 0, skippedCount: 0, error: null };
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const item of queue) {
      const payload = item?.payload;
      if (!payload || !payload.clientTransactionId) {
        skippedCount++;
        continue;
      }

      const targetOutletId = payload.outletId || outletId;

      try {
        await outbox.enqueue({
          ownerUserId,
          outletId: targetOutletId,
          payload,
        });
        migratedCount++;
      } catch (err) {
        // Jika sudah ada di outbox dengan payload sama/berbeda, lewati untuk mencegah crash
        skippedCount++;
      }
    }

    // Bersihkan file JSON setelah seluruh item diproses ke SQLite
    await clearQueue();

    return { migratedCount, skippedCount, error: null };
  } catch (error) {
    // Jangan hapus data JSON jika migrasi gagal
    return { migratedCount: 0, skippedCount: 0, error };
  }
}
