import assert from "node:assert/strict";
import test from "node:test";
import { formatManagerMetadata } from "../src/audit/query.js";

test("email di field bebas tidak ditampilkan", () => {
  const rows = formatManagerMetadata({
    note: "hubungi crew@seroo.test",
    quantity: 3,
  });

  assert.deepEqual(rows, [{ key: "quantity", label: "Jumlah", value: "3" }]);
  assert.equal(JSON.stringify(rows).includes("@"), false);
  assert.equal(JSON.stringify(rows).includes("crew@seroo.test"), false);
});

test("nomor telepon di field bebas tidak ditampilkan", () => {
  const rows = formatManagerMetadata({
    note: "081234567890",
    role: "MANAGER",
  });

  assert.deepEqual(rows, [{ key: "role", label: "Role", value: "MANAGER" }]);
  assert.equal(JSON.stringify(rows).includes("081234567890"), false);
});

test("field operasional aman tetap ditampilkan", () => {
  const rows = formatManagerMetadata({
    quantity: 3,
    role: "MANAGER",
    status: "CLOSED",
    isAvailable: true,
    replayed: false,
  });

  assert.deepEqual(rows, [
    { key: "quantity", label: "Jumlah", value: "3" },
    { key: "role", label: "Role", value: "MANAGER" },
    { key: "status", label: "Status", value: "CLOSED" },
    { key: "isAvailable", label: "Tersedia", value: "Ya" },
    { key: "replayed", label: "Dikirim ulang", value: "Tidak" },
  ]);
});

test("field tidak dikenal dan field bebas tidak ditampilkan", () => {
  const rows = formatManagerMetadata({
    unknownField: "rahasia",
    reason: "customer minta hubungi 0812",
    description: "catatan bebas",
    Email: "crew@seroo.test",
    quantity: 1,
  });

  assert.deepEqual(rows, [{ key: "quantity", label: "Jumlah", value: "1" }]);
});

test("metadata bersarang tidak ditampilkan seluruhnya", () => {
  const rows = formatManagerMetadata({
    nested: { email: "crew@seroo.test", role: "MANAGER" },
    list: [{ phone: "0812" }],
  });

  assert.deepEqual(rows, []);
});

test("metadata kosong atau null menghasilkan daftar kosong", () => {
  assert.deepEqual(formatManagerMetadata(null), []);
  assert.deepEqual(formatManagerMetadata(undefined), []);
  assert.deepEqual(formatManagerMetadata({}), []);
  assert.deepEqual(formatManagerMetadata([]), []);
});

test("formatter tidak memutasi objek input", () => {
  const input = {
    note: "081234567890",
    quantity: 2,
    nested: { email: "crew@seroo.test" },
    status: "CANCELLED",
  };
  const snapshot = JSON.parse(JSON.stringify(input));

  formatManagerMetadata(input);

  assert.deepEqual(input, snapshot);
  assert.equal(input.note, "081234567890");
  assert.equal(input.nested.email, "crew@seroo.test");
});
