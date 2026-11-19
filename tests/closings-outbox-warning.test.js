import assert from "node:assert/strict";
import test from "node:test";

test("Closing Outbox Warning Logic: Membedakan transaksi menunggu sinkronisasi, perlu review, dan mengabaikan synced", () => {
  const sampleRecords = [
    { clientTransactionId: "tx-1", status: "queued", paymentMethod: "CASH" },
    { clientTransactionId: "tx-2", status: "syncing", paymentMethod: "CASH" },
    { clientTransactionId: "tx-3", status: "retryable_failure", paymentMethod: "CASH" },
    { clientTransactionId: "tx-4", status: "needs_review", errorCode: "CATALOG_ITEM_UNAVAILABLE", paymentMethod: "CASH" },
    { clientTransactionId: "tx-5", status: "needs_review", errorCode: "PRICE_CHANGED", paymentMethod: "CASH" },
    { clientTransactionId: "tx-6", status: "synced", serverOrder: { id: "srv-6" }, paymentMethod: "CASH" },
    { clientTransactionId: "tx-7", status: "synced", serverOrder: { id: "srv-7" }, paymentMethod: "CASH" },
  ];

  const waitingSync = sampleRecords.filter((r) =>
    ["queued", "syncing", "retryable_failure"].includes(r.status),
  );
  const needsReview = sampleRecords.filter((r) => r.status === "needs_review");
  const synced = sampleRecords.filter((r) => r.status === "synced");

  const summary = {
    waitingSyncCount: waitingSync.length,
    needsReviewCount: needsReview.length,
    syncedCount: synced.length,
    totalUnresolved: waitingSync.length + needsReview.length,
  };

  // 1. Validasi perhitungan
  assert.equal(summary.waitingSyncCount, 3, "queued, syncing, retryable_failure harus terhitung sebagai waitingSync");
  assert.equal(summary.needsReviewCount, 2, "needs_review harus terhitung sebagai needsReviewCount");
  assert.equal(summary.syncedCount, 2, "synced diidentifikasi");
  assert.equal(summary.totalUnresolved, 5, "total unresolved harus 5 (3 waiting + 2 review)");

  // 2. Order synced tidak dihitung dalam totalUnresolved
  assert.equal(summary.totalUnresolved, sampleRecords.length - summary.syncedCount);

  // 3. Formulasi pesan peringatan
  let message = "";
  if (summary.waitingSyncCount > 0 && summary.needsReviewCount > 0) {
    message = `Perhatian: Terdapat ${summary.waitingSyncCount} pesanan menunggu sinkronisasi dan ${summary.needsReviewCount} pesanan memerlukan peninjauan di antrean lokal. Rekap kas server belum mencakup transaksi tersebut. Pastikan kasir menyinkronkan atau meninjau transaksi sebelum closing.`;
  } else if (summary.waitingSyncCount > 0) {
    message = `Perhatian: Terdapat ${summary.waitingSyncCount} pesanan di antrean lokal yang belum disinkronkan ke server. Rekap kas server belum mencakup transaksi ini.`;
  } else if (summary.needsReviewCount > 0) {
    message = `Perhatian: Terdapat ${summary.needsReviewCount} pesanan di antrean lokal berstatus perlu peninjauan (needs_review). Transaksi belum tercatat di server namun uang fisik kasir mungkin sudah diterima.`;
  }

  assert.ok(message.includes("3 pesanan menunggu sinkronisasi"));
  assert.ok(message.includes("2 pesanan memerlukan peninjauan"));
});
