import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotificationsApi } from "../src/notifications/api.js";

test("notifications API scopes request to encoded outlet id", async () => {
  const calls = [];
  const api = createNotificationsApi({
    request: async (path) => {
      calls.push(path);
      return { data: { outletId: "outlet a", notifications: [], count: 0, unreadCount: 0 } };
    },
  });

  const data = await api.getNotifications("outlet a");

  assert.deepEqual(calls, ["/api/v1/outlets/outlet%20a/notifications"]);
  assert.equal(data.count, 0);
});

test("notifications API rejects malformed server response", async () => {
  const api = createNotificationsApi({
    request: async () => ({ data: { notifications: "not-an-array" } }),
  });

  await assert.rejects(api.getNotifications("outlet-a"), /tidak sesuai kontrak/);
});
