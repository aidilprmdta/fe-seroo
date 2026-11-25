import assert from "node:assert/strict";
import { test } from "node:test";
import { createShiftHandoverApi } from "../src/shift-handover/api.js";

test("request handover posts to outlet-scoped request endpoint", async () => {
  const calls = [];
  const api = createShiftHandoverApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return { success: true, data: { handover: { id: "h-1", status: "PENDING" } } };
    },
  });

  await api.requestHandover("outlet a", {
    currentOutlet: "outlet a",
    nextOutlet: "outlet a",
    notes: "Ringkasan: shift lancar",
  });

  assert.deepEqual(calls, [
    {
      path: "/api/v1/outlets/outlet%20a/request",
      options: {
        method: "POST",
        body: { currentOutlet: "outlet a", nextOutlet: "outlet a", notes: "Ringkasan: shift lancar" },
      },
    },
  ]);
});

test("list pending reads handovers array and decide patches status", async () => {
  const calls = [];
  const api = createShiftHandoverApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (options?.method === "PATCH") {
        return { success: true, data: { handover: { id: "h-1", status: "ACCEPTED" } } };
      }
      return { data: { handovers: [{ id: "h-1", status: "PENDING" }] } };
    },
  });

  const handovers = await api.listPending("outlet-a");
  assert.deepEqual(calls[0].path, "/api/v1/outlets/outlet-a/requests?status=PENDING");
  assert.equal(handovers[0].id, "h-1");

  await api.decide("outlet-a", "h-1", { status: "ACCEPTED" });
  assert.equal(calls[1].path, "/api/v1/outlets/outlet-a/requests/h-1");
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(calls[1].options.body, { status: "ACCEPTED" });
});

test("malformed handover list is rejected", async () => {
  const api = createShiftHandoverApi({ request: async () => ({ data: { handovers: "nope" } }) });
  await assert.rejects(api.listPending("outlet-a"), /tidak sesuai kontrak/);
});
