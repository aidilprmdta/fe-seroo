import assert from "node:assert/strict";
import test from "node:test";
import { createAuthClient } from "../src/auth/sessionClient.js";
import { createAdminAccountApi } from "../src/accounts/api.js";
import { createCatalogAdminApi } from "../src/catalog/api.js";
import { createOutletAccessApi } from "../src/outlets/api.js";
import { createClosingApi } from "../src/closings/api.js";

test("REGRESSION (Mobile): sessionClient never double-encodes JSON payloads", async () => {
  const sentRequests = [];
  const mockStorage = {
    getItemAsync: async () => "mock-refresh-token",
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
  };

  const client = createAuthClient({
    apiBaseUrl: "http://localhost:3000",
    allowInsecureHttp: true,
    secureStorage: mockStorage,
    fetchImpl: async (url, options) => {
      sentRequests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { receivedBody: options.body },
        }),
      };
    },
  });

  // 1. Sending an Object payload
  const objectPayload = { name: "Produk Baru", price: 15000 };
  const res1 = await client.request("/api/test-object", {
    method: "POST",
    body: objectPayload,
    authenticated: false,
  });

  // Ensure the body sent across the network is a valid single-level JSON string
  assert.equal(typeof sentRequests[0].options.body, "string");
  assert.deepEqual(JSON.parse(sentRequests[0].options.body), objectPayload);
  // Verify it is NOT double-stringified (i.e. parsing once gives an object, not a string)
  assert.equal(typeof JSON.parse(sentRequests[0].options.body), "object");

  // 2. Sending a pre-stringified payload (defensive guarantee)
  const preStringified = JSON.stringify({ name: "Produk Stringified", price: 20000 });
  const res2 = await client.request("/api/test-string", {
    method: "POST",
    body: preStringified,
    authenticated: false,
  });

  assert.equal(typeof sentRequests[1].options.body, "string");
  // If it were double-stringified, JSON.parse would return a string. It must parse directly to an object:
  assert.deepEqual(JSON.parse(sentRequests[1].options.body), { name: "Produk Stringified", price: 20000 });
});

test("REGRESSION (Mobile): API clients pass plain objects to request() without double-stringifying", async () => {
  const calls = [];
  const mockRequest = async (path, options) => {
    calls.push({ path, options });
    if (path.includes("/admin/accounts") && options?.method === "POST") {
      return { account: { id: "acc-1", name: options.body.name } };
    }
    if (path.includes("/status")) {
      return { account: { id: "acc-1", isActive: options.body.isActive } };
    }
    if (path.includes("/admin/catalog/products")) {
      return { product: { id: "p-1", name: options.body.name } };
    }
    if (path.includes("/admin/catalog/variants")) {
      return { variant: { id: "v-1", price: options.body.price } };
    }
    if (path.includes("/admin/catalog/add-ons")) {
      return { addOn: { id: "a-1", name: options.body.name } };
    }
    if (path.includes("/members")) {
      return { membership: { id: "m-1", role: options.body.role } };
    }
    if (path.includes("/closings/reopen")) {
      return { record: { id: "c-1", status: "REOPENED" } };
    }
    if (path.includes("/closings")) {
      return { record: { id: "c-1", status: "CLOSED" } };
    }
    if (path.includes("/cash-openings")) {
      return { id: "co-1", openingCash: options.body.openingCash };
    }
    return { success: true };
  };

  // 1. Account API
  const accountApi = createAdminAccountApi({ request: mockRequest });
  await accountApi.createAccount({ name: "Test User", email: "test@seroo.id", role: "CREW", outletId: "out-1" });
  assert.equal(typeof calls[0].options.body, "object");
  assert.equal(calls[0].options.body.name, "Test User");

  await accountApi.setAccountActive("acc-1", false);
  assert.equal(typeof calls[1].options.body, "object");
  assert.equal(calls[1].options.body.isActive, false);

  // 2. Catalog API
  const catalogApi = createCatalogAdminApi({ request: mockRequest });
  await catalogApi.createProduct({ name: "Kopi Gula Aren", variants: [{ name: "Reg", price: "15000" }] });
  assert.equal(typeof calls[2].options.body, "object");
  assert.equal(calls[2].options.body.name, "Kopi Gula Aren");

  await catalogApi.updateVariant("v-1", { price: "18000" });
  assert.equal(typeof calls[3].options.body, "object");
  assert.equal(calls[3].options.body.price, "18000");

  await catalogApi.createAddOn({ name: "Boba", price: "4000" });
  assert.equal(typeof calls[4].options.body, "object");
  assert.equal(calls[4].options.body.name, "Boba");

  // 3. Outlet Access API
  const outletApi = createOutletAccessApi({ request: mockRequest });
  await outletApi.assignMember("out-1", { email: "crew@seroo.id", role: "CREW" });
  assert.equal(typeof calls[5].options.body, "object");
  assert.equal(calls[5].options.body.role, "CREW");

  // 4. Closing API
  const closingApi = createClosingApi({ request: mockRequest });
  await closingApi.performClosing("out-1", { type: "DAILY", periodKey: "2026-11-19" });
  assert.equal(typeof calls[6].options.body, "object");

  await closingApi.recordCashOpening("out-1", { periodKey: "2026-11-19", openingCash: "100000" });
  assert.equal(typeof calls[7].options.body, "object");

  await closingApi.reopenClosing("out-1", { closingId: "c-1", reopenReason: "Koreksi" });
  assert.equal(typeof calls[8].options.body, "object");
});
