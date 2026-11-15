import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminAccountApiError,
  createAdminAccountApi,
} from "../src/accounts/api.js";

test("Admin account API covers paginated reads, creation, and status changes", async () => {
  const requests = [];
  const api = createAdminAccountApi({
    async request(path, options) {
      requests.push({ path, options });
      if (path.startsWith("/api/v1/admin/accounts?")) {
        return { accounts: [], page: 1, pageSize: 50, total: 0, hasNextPage: false };
      }
      if (path === "/api/v1/admin/outlets") {
        return { outlets: [{ id: "outlet-a", name: "Rumbai", code: "RMB" }] };
      }
      if (path.endsWith("/reset-password")) {
        return {
          temporaryPassword: "random-password-from-server",
          mustChangePassword: true,
        };
      }
      if (options?.method === "POST") {
        return { account: { id: "user-1", isActive: true } };
      }
      return { account: { id: "user-1", isActive: false } };
    },
  });

  const accounts = await api.getAccounts(2, 25);
  assert.equal(accounts.accounts.length, 0);
  assert.equal(
    requests[0].path,
    "/api/v1/admin/accounts?page=2&pageSize=25",
  );

  const outlets = await api.getOutlets();
  assert.equal(outlets.outlets[0].id, "outlet-a");
  assert.equal(requests[1].path, "/api/v1/admin/outlets");

  const payload = {
    name: "Crew",
    email: "crew@seroo.id",
    password: "password-awal-kuat",
    role: "CREW",
    outletId: "outlet-a",
  };
  await api.createAccount(payload);
  assert.equal(requests[2].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[2].options.body), payload);

  const status = await api.setAccountActive("user/1", false);
  assert.equal(status.account.isActive, false);
  assert.equal(
    requests[3].path,
    "/api/v1/admin/accounts/user%2F1/status",
  );
  assert.deepEqual(JSON.parse(requests[3].options.body), { isActive: false });

  const reset = await api.resetPassword("user/1");
  assert.equal(reset.temporaryPassword, "random-password-from-server");
  assert.equal(
    requests[4].path,
    "/api/v1/admin/accounts/user%2F1/reset-password",
  );
  assert.equal(requests[4].options.method, "POST");
  assert.equal(requests[4].options.body, undefined);
});

test("Admin account API rejects malformed server responses", async () => {
  const api = createAdminAccountApi({
    async request() {
      return { invalid: true };
    },
  });

  await assert.rejects(
    () => api.getAccounts(),
    (error) =>
      error instanceof AdminAccountApiError &&
      error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    () => api.getOutlets(),
    (error) =>
      error instanceof AdminAccountApiError &&
      error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    () => api.resetPassword("user-1"),
    (error) =>
      error instanceof AdminAccountApiError &&
      error.code === "INVALID_RESPONSE",
  );
});
