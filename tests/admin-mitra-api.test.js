import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogAdminApi, CatalogAdminApiError } from "../src/catalog/api.js";
import { createOutletAccessApi, OutletAccessApiError } from "../src/outlets/api.js";

test("catalog admin API scopes requests and validates response contracts", async () => {
  const requests = [];
  const mockCatalog = {
    products: [
      { id: "p1", name: "Teh Tarik", variants: [{ id: "v1", name: "Regular", price: "10000" }] },
    ],
    addOns: [{ id: "a1", name: "Grass Jelly", price: "3000" }],
  };

  const api = createCatalogAdminApi({
    async request(path, options) {
      requests.push({ path, options });
      return mockCatalog;
    },
  });

  const res = await api.getCatalog();
  assert.equal(requests[0].path, "/api/v1/admin/catalog/products");
  assert.equal(res.products.length, 1);
  assert.equal(res.addOns.length, 1);
});

test("catalog admin API rejects malformed server response", async () => {
  const api = createCatalogAdminApi({
    async request() {
      return { invalid: true };
    },
  });

  await assert.rejects(
    () => api.getCatalog(),
    (err) => err instanceof CatalogAdminApiError && err.code === "INVALID_RESPONSE",
  );
});

test("outlet access API scopes requests and manages members", async () => {
  const requests = [];
  const mockMembers = {
    outletId: "outlet-rumbai",
    members: [{ membershipId: "m1", userId: "u1", name: "Budi", email: "budi@seroo.id", role: "CREW" }],
  };

  const api = createOutletAccessApi({
    async request(path, options) {
      requests.push({ path, options });
      if (options?.method === "POST") {
        return { membership: { membershipId: "m2", role: "CREW" } };
      }
      if (options?.method === "DELETE") {
        return { success: true };
      }
      return mockMembers;
    },
  });

  // 1. Get members
  const list = await api.getMembers("outlet-rumbai");
  assert.equal(requests[0].path, "/api/v1/outlets/outlet-rumbai/members");
  assert.equal(list.members.length, 1);

  // 2. Assign member
  const assigned = await api.assignMember("outlet-rumbai", { email: "doni@seroo.id", role: "CREW" });
  assert.equal(requests[1].path, "/api/v1/outlets/outlet-rumbai/members");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(assigned.membership.role, "CREW");

  // 3. Revoke member
  await api.revokeMember("outlet-rumbai", "u1");
  assert.equal(requests[2].path, "/api/v1/outlets/outlet-rumbai/members/u1");
  assert.equal(requests[2].options.method, "DELETE");
});

test("outlet access API rejects malformed server response", async () => {
  const api = createOutletAccessApi({
    async request() {
      return { broken: true };
    },
  });

  await assert.rejects(
    () => api.getMembers("outlet-rumbai"),
    (err) => err instanceof OutletAccessApiError && err.code === "INVALID_RESPONSE",
  );
});

