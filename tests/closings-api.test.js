import assert from "node:assert/strict";
import test from "node:test";
import { createClosingsApi } from "../src/api/closings.js";

function createRequest() {
  const calls = [];
  return {
    calls,
    request: {
      async get(path) {
        calls.push({ method: "get", path });
        return { data: { closings: [] } };
      },
      async patch(path, body) {
        calls.push({ method: "patch", path, body });
        return { data: { closing: { id: "closing-1" } } };
      },
      async post(path, body) {
        calls.push({ method: "post", path, body });
        return { data: {} };
      },
    },
  };
}

test("updateCashDifference memakai route dan payload yang sama dengan backend", async () => {
  const { request, calls } = createRequest();
  const api = createClosingsApi({ request });

  const result = await api.updateCashDifference("outlet-a", "closing-1", {
    status: "SUDAH_DIKETAHUI",
    note: "Sudah dihitung ulang",
  });

  assert.deepEqual(calls[0], {
    method: "patch",
    path: "/outlets/outlet-a/closings/closing-1/cash-difference",
    body: { status: "SUDAH_DIKETAHUI", note: "Sudah dihitung ulang" },
  });
  assert.equal(result.closing.id, "closing-1");
});

test("listClosings meneruskan filter tipe closing", async () => {
  const { request, calls } = createRequest();
  const api = createClosingsApi({ request });

  await api.listClosings("outlet-a", { type: "DAILY" });

  assert.equal(calls[0].method, "get");
  assert.equal(calls[0].path, "/outlets/outlet-a/closings?type=DAILY");
});

test("listClosings tanpa parameter memakai path dasar", async () => {
  const { request, calls } = createRequest();
  const api = createClosingsApi({ request });

  await api.listClosings("outlet-a");

  assert.equal(calls[0].path, "/outlets/outlet-a/closings");
});
