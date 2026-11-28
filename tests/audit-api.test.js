import assert from "node:assert/strict";
import test from "node:test";
import { createAuditApi } from "../src/api/audit.js";

test("listOutletAuditLogs memakai path outlet dan query parameter", async () => {
  const calls = [];
  const api = createAuditApi({
    request: {
      async get(path) {
        calls.push(path);
        return { data: { auditLogs: [], pagination: {} } };
      },
    },
  });

  const result = await api.listOutletAuditLogs("outlet-a", {
    page: 2,
    pageSize: 10,
    resourceType: "Order",
  });

  assert.equal(
    calls[0],
    "/outlets/outlet-a/audit-logs?page=2&pageSize=10&resourceType=Order",
  );
  assert.deepEqual(result.data.auditLogs, []);
});

test("listOutletAuditLogs tanpa parameter memakai path dasar", async () => {
  const calls = [];
  const api = createAuditApi({
    request: {
      async get(path) {
        calls.push(path);
        return { data: {} };
      },
    },
  });

  await api.listOutletAuditLogs("outlet-a");

  assert.equal(calls[0], "/outlets/outlet-a/audit-logs");
});
