import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuditQuery,
  describeAction,
  formatAuditDay,
  formatAuditTime,
  metadataSummary,
  moduleLabel,
} from "../src/audit/query.js";

const NOW = new Date("2026-11-15T03:00:00.000Z");

test("periode audit dipetakan ke tanggal Asia/Jakarta", () => {
  assert.deepEqual(buildAuditQuery({ period: "TODAY", now: NOW }), {
    page: 1,
    pageSize: 20,
    from: "2026-11-15",
    to: "2026-11-16",
  });
  assert.deepEqual(buildAuditQuery({ period: "7D", now: NOW }), {
    page: 1,
    pageSize: 20,
    from: "2026-11-09",
    to: "2026-11-16",
  });
  assert.deepEqual(buildAuditQuery({ period: "30D", now: NOW }), {
    page: 1,
    pageSize: 20,
    from: "2026-10-17",
    to: "2026-11-16",
  });
  assert.deepEqual(buildAuditQuery({ period: "ALL", now: NOW }), {
    page: 1,
    pageSize: 20,
  });
});

test("filter modul, pengguna, status, dan halaman diteruskan", () => {
  assert.deepEqual(
    buildAuditQuery({
      period: "ALL",
      module: "Order",
      actorUserId: "crew-a",
      outcome: "FAILURE",
      page: 3,
      pageSize: 50,
      now: NOW,
    }),
    {
      page: 3,
      pageSize: 50,
      resourceType: "Order",
      actorUserId: "crew-a",
      outcome: "FAILURE",
    },
  );
});

test("label aksi, modul, waktu, dan ringkasan metadata", () => {
  assert.equal(describeAction("ORDER_CREATED"), "Transaksi baru dicatat");
  assert.equal(describeAction("UNKNOWN_ACTION"), "unknown action");
  assert.equal(moduleLabel("Expense"), "Pengeluaran");
  assert.equal(moduleLabel("UnknownThing"), "UnknownThing");
  assert.equal(formatAuditDay(NOW, NOW), "HARI INI");
  assert.equal(
    formatAuditDay(new Date("2026-11-14T03:00:00.000Z"), NOW),
    "KEMARIN",
  );
  assert.equal(formatAuditTime(new Date("2026-11-15T03:42:00.000Z")), "10.42");
  assert.equal(
    metadataSummary({ role: "CREW", quantity: 3, nested: { a: 1 } }),
    "Jumlah: 3 · Role: CREW",
  );
});
