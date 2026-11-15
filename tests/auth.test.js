import assert from "node:assert/strict";
import test from "node:test";
import { AUTO_LOCK_TIMEOUT_MS, shouldAutoLock } from "../src/auth/autoLockPolicy.js";
import {
  getInitialOutletContext,
  getSelectedMembership,
  isAllowedRoute,
  resolveLandingRoute,
  ROUTES,
} from "../src/auth/routePolicy.js";
import {
  AuthApiError,
  createAuthClient,
} from "../src/auth/sessionClient.js";

const memberships = [
  {
    outletId: "outlet-a",
    outletCode: "RMB",
    outletName: "Outlet Rumbai",
    role: "MANAGER",
  },
  {
    outletId: "outlet-b",
    outletCode: "BGA",
    outletName: "Outlet Bangau",
    role: "MANAGER",
  },
];

const profile = {
  user: {
    id: "user-1",
    name: "Pengguna Uji",
    email: "uji@seroo.test",
    mustChangePassword: false,
    memberships,
  },
  session: {
    id: "session-1",
    expiresAt: "2026-12-12T10:00:00.000Z",
  },
};

function tokenData(accessToken, refreshToken) {
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    refreshToken,
    refreshExpiresAt: "2026-12-12T10:00:00.000Z",
    session: profile.session,
  };
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function success(data) {
  return response({ success: true, data });
}

function failure(code, message, status = 401) {
  return response({ success: false, error: { code, message } }, status);
}

function createStorage(initialToken = null) {
  const values = new Map();
  if (initialToken) {
    values.set("seroo.refreshToken", initialToken);
  }
  return {
    values,
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      values.delete(key);
    },
  };
}

function createClient({ fetchImpl, secureStorage = createStorage(), onSessionExpired }) {
  return {
    client: createAuthClient({
      apiBaseUrl: "https://api.seroo.test",
      secureStorage,
      fetchImpl,
      onSessionExpired,
    }),
    secureStorage,
  };
}

test("routing follows membership role and requires selection for mixed or Crew memberships", () => {
  assert.equal(resolveLandingRoute([], null), ROUTES.accessPending);
  assert.equal(
    resolveLandingRoute([{ ...memberships[0], role: "CREW" }], {
      activeOutletId: "outlet-a",
      activeRole: "CREW",
    }),
    ROUTES.crew,
  );
  assert.equal(
    resolveLandingRoute(memberships, getInitialOutletContext(memberships)),
    ROUTES.selectOutlet,
  );
  assert.deepEqual(getInitialOutletContext(memberships), {
    activeOutletId: null,
    activeRole: null,
  });

  const crewMemberships = memberships.map((membership) => ({
    ...membership,
    role: "CREW",
  }));
  assert.equal(
    resolveLandingRoute(crewMemberships, getInitialOutletContext(crewMemberships)),
    ROUTES.selectOutlet,
  );
  assert.equal(
    resolveLandingRoute(crewMemberships, {
      activeOutletId: "outlet-b",
      activeRole: "CREW",
    }),
    ROUTES.crew,
  );

  const mixedMemberships = [
    { ...memberships[0], role: "MANAGER" },
    { ...memberships[1], role: "OWNER" },
  ];
  assert.equal(
    resolveLandingRoute(mixedMemberships, getInitialOutletContext(mixedMemberships)),
    ROUTES.selectOutlet,
  );
  assert.equal(
    resolveLandingRoute(mixedMemberships, {
      activeOutletId: "outlet-b",
      activeRole: "OWNER",
    }),
    ROUTES.owner,
  );
});

test("multiple memberships require an explicit authorized outlet selection", () => {
  assert.equal(
    resolveLandingRoute(memberships, {
      activeOutletId: null,
      activeRole: "MANAGER",
    }),
    ROUTES.selectOutlet,
  );
  assert.equal(
    resolveLandingRoute(memberships, {
      activeOutletId: "outlet-a",
      activeRole: "MANAGER",
    }),
    ROUTES.manager,
  );
  assert.equal(
    resolveLandingRoute(memberships, {
      activeOutletId: "outside",
      activeRole: "MANAGER",
    }),
    ROUTES.selectOutlet,
  );
  assert.equal(getSelectedMembership(memberships, "outside"), null);
});

test("ADMIN_PUSAT lands on admin catalog and OWNER_MITRA lands on owner dashboard", () => {
  const adminMemberships = [{ outletId: "outlet-rumbai", role: "ADMIN_PUSAT" }];
  assert.equal(
    resolveLandingRoute(adminMemberships, { activeOutletId: "outlet-rumbai", activeRole: "ADMIN_PUSAT" }),
    ROUTES.adminCatalog,
  );
  assert.equal(
    isAllowedRoute(ROUTES.adminCatalog, adminMemberships, { activeOutletId: "outlet-rumbai", activeRole: "ADMIN_PUSAT" }),
    true,
  );
  assert.equal(
    isAllowedRoute(ROUTES.adminAccounts, adminMemberships, { activeOutletId: null, activeRole: null }),
    true,
  );

  const ownerMitraMemberships = [{ outletId: "outlet-rumbai", role: "OWNER_MITRA" }];
  assert.equal(
    resolveLandingRoute(ownerMitraMemberships, { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" }),
    ROUTES.owner,
  );
  assert.equal(
    isAllowedRoute(ROUTES.adminCatalog, ownerMitraMemberships, { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" }),
    false,
  );
  assert.equal(
    isAllowedRoute(ROUTES.adminAccounts, ownerMitraMemberships, { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" }),
    false,
  );
  assert.equal(
    isAllowedRoute(ROUTES.reports, ownerMitraMemberships, { activeOutletId: "outlet-rumbai", activeRole: "OWNER_MITRA" }),
    true,
  );
});

test("protected route policy blocks login after auth and blocks wrong role screens", () => {
  const managerContext = {
    activeOutletId: "outlet-a",
    activeRole: "MANAGER",
  };
  assert.equal(isAllowedRoute(ROUTES.manager, memberships, managerContext), true);
  assert.equal(isAllowedRoute(ROUTES.owner, memberships, managerContext), false);
  assert.equal(isAllowedRoute(ROUTES.crewPos, memberships, managerContext), false);
  assert.equal(isAllowedRoute(ROUTES.login, memberships, managerContext), false);
  assert.equal(isAllowedRoute(ROUTES.selectOutlet, memberships, managerContext), true);
  assert.equal(isAllowedRoute(ROUTES.accessPending, [], null), true);
  assert.equal(
    isAllowedRoute(
      ROUTES.crewPos,
      [{ ...memberships[0], role: "CREW" }],
      { activeOutletId: "outlet-a", activeRole: "CREW" },
    ),
    true,
  );
});

test("inventory and waste routes are limited to selected Crew and Manager membership", () => {
  const crewMembership = [{ ...memberships[0], role: "CREW" }];
  const crewContext = { activeOutletId: "outlet-a", activeRole: "CREW" };
  assert.equal(
    isAllowedRoute(ROUTES.inventory, crewMembership, crewContext),
    true,
  );
  assert.equal(isAllowedRoute(ROUTES.waste, crewMembership, crewContext), true);

  const ownerMembership = [{ ...memberships[0], role: "OWNER" }];
  const ownerContext = { activeOutletId: "outlet-a", activeRole: "OWNER" };
  assert.equal(
    isAllowedRoute(ROUTES.inventory, ownerMembership, ownerContext),
    false,
  );
  assert.equal(isAllowedRoute(ROUTES.waste, ownerMembership, ownerContext), false);
  assert.equal(
    isAllowedRoute(ROUTES.waste, crewMembership, {
      activeOutletId: "outlet-b",
      activeRole: "CREW",
    }),
    false,
  );
});

test("stock requests and expenses follow role and selected outlet policy", () => {
  const crewMembership = [{ ...memberships[0], role: "CREW" }];
  const crewContext = { activeOutletId: "outlet-a", activeRole: "CREW" };
  assert.equal(
    isAllowedRoute(ROUTES.stockRequests, crewMembership, crewContext),
    true,
  );
  assert.equal(isAllowedRoute(ROUTES.expenses, crewMembership, crewContext), false);

  const managerMembership = [{ ...memberships[0], role: "MANAGER" }];
  const managerContext = { activeOutletId: "outlet-a", activeRole: "MANAGER" };
  assert.equal(
    isAllowedRoute(ROUTES.stockRequests, managerMembership, managerContext),
    true,
  );
  assert.equal(
    isAllowedRoute(ROUTES.expenses, managerMembership, managerContext),
    true,
  );
  assert.equal(
    isAllowedRoute(ROUTES.expenses, managerMembership, {
      activeOutletId: "outlet-b",
      activeRole: "MANAGER",
    }),
    false,
  );

  const ownerMembership = [{ ...memberships[0], role: "OWNER" }];
  const ownerContext = { activeOutletId: "outlet-a", activeRole: "OWNER" };
  assert.equal(
    isAllowedRoute(ROUTES.expenses, ownerMembership, ownerContext),
    true,
  );
  assert.equal(
    isAllowedRoute(ROUTES.stockRequests, ownerMembership, ownerContext),
    false,
  );
});

test("login stores only the refresh token securely and loads the profile from /me", async () => {
  const secureStorage = createStorage();
  const calls = [];
  const { client } = createClient({
    secureStorage,
    fetchImpl: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path.endsWith("/auth/login")) {
        return success(tokenData("access-one", "refresh-one"));
      }
      if (path.endsWith("/auth/me")) {
        return success(profile);
      }
      throw new Error("Unexpected test request");
    },
  });

  const result = await client.login({
    email: "uji@seroo.test",
    password: "one-time-test-password",
  });

  assert.equal(result.user.id, profile.user.id);
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/v1/auth/login", "/api/v1/auth/me"],
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: "uji@seroo.test",
    password: "one-time-test-password",
  });
  assert.equal(calls[1].options.headers.Authorization, "Bearer access-one");
  assert.deepEqual([...secureStorage.values.values()], ["refresh-one"]);
});

test("login exposes the backend rate-limit cooldown message", async () => {
  const { client } = createClient({
    fetchImpl: async () =>
      failure(
        "RATE_LIMITED",
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
        429,
      ),
  });

  await assert.rejects(
    client.login({ email: "uji@seroo.test", password: "password" }),
    (error) => {
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.status, 429);
      assert.equal(
        error.message,
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
      );
      return true;
    },
  );
});

test("password change uses the authenticated endpoint and does not persist passwords", async () => {
  const secureStorage = createStorage();
  const calls = [];
  const { client } = createClient({
    secureStorage,
    fetchImpl: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path.endsWith("/auth/login")) {
        return success(tokenData("access-one", "refresh-one"));
      }
      if (path.endsWith("/auth/me")) {
        return success(profile);
      }
      if (path.endsWith("/auth/change-password")) {
        return success({ passwordChanged: true });
      }
      throw new Error("Unexpected test request");
    },
  });

  await client.login({ email: "uji@seroo.test", password: "old-password" });
  const result = await client.changePassword({
    currentPassword: "old-password",
    newPassword: "new-password-strong",
  });

  assert.deepEqual(result, { passwordChanged: true });
  assert.equal(calls[2].path, "/api/v1/auth/change-password");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.headers.Authorization, "Bearer access-one");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    currentPassword: "old-password",
    newPassword: "new-password-strong",
  });
  assert.deepEqual([...secureStorage.values.values()], ["refresh-one"]);
});

test("login accepts Admin Pusat and Owner Mitra memberships from the backend", async () => {
  for (const role of ["ADMIN_PUSAT", "OWNER_MITRA"]) {
    const roleProfile = {
      ...profile,
      user: {
        ...profile.user,
        memberships: [{ ...memberships[0], role }],
      },
    };
    const secureStorage = createStorage();
    const { client } = createClient({
      secureStorage,
      fetchImpl: async (url) => {
        if (new URL(url).pathname.endsWith("/auth/login")) {
          return success(tokenData("access-one", "refresh-one"));
        }
        if (new URL(url).pathname.endsWith("/auth/me")) {
          return success(roleProfile);
        }
        throw new Error("Unexpected test request");
      },
    });

    const result = await client.login({
      email: "uji@seroo.test",
      password: "one-time-test-password",
    });

    assert.equal(result.user.memberships[0].role, role);
  }
});

test("profile route is available to authenticated users regardless of outlet membership", () => {
  assert.equal(ROUTES.profile, "/profile");
  assert.equal(isAllowedRoute(ROUTES.profile, [], null), true);
});

test("session restoration rotates the stored refresh token before loading /me", async () => {
  const secureStorage = createStorage("refresh-old");
  const calls = [];
  const { client } = createClient({
    secureStorage,
    fetchImpl: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path.endsWith("/auth/refresh")) {
        return success(tokenData("access-new", "refresh-new"));
      }
      if (path.endsWith("/auth/me")) {
        return success(profile);
      }
      throw new Error("Unexpected test request");
    },
  });

  const restored = await client.restoreSession();

  assert.equal(restored.user.id, profile.user.id);
  assert.equal(
    JSON.parse(calls[0].options.body).refreshToken,
    "refresh-old",
  );
  assert.equal(calls[1].options.headers.Authorization, "Bearer access-new");
  assert.deepEqual([...secureStorage.values.values()], ["refresh-new"]);
});

test("parallel expired requests share one refresh and retry with the rotated access token", async () => {
  const secureStorage = createStorage();
  let protectedRequests = 0;
  let refreshRequests = 0;
  const { client } = createClient({
    secureStorage,
    fetchImpl: async (url, options) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/auth/login")) {
        return success(tokenData("access-one", "refresh-one"));
      }
      if (path.endsWith("/auth/me")) {
        return success(profile);
      }
      if (path.endsWith("/auth/refresh")) {
        refreshRequests += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return success(tokenData("access-two", "refresh-two"));
      }
      if (path.endsWith("/protected")) {
        protectedRequests += 1;
        if (options.headers.Authorization === "Bearer access-one") {
          return failure(
            "ACCESS_TOKEN_EXPIRED",
            "Access token sudah kedaluwarsa.",
          );
        }
        return success({ available: true });
      }
      throw new Error("Unexpected test request");
    },
  });

  await client.login({ email: "uji@seroo.test", password: "password" });
  const results = await Promise.all([
    client.request("/api/v1/protected"),
    client.request("/api/v1/protected"),
  ]);

  assert.equal(refreshRequests, 1);
  assert.equal(protectedRequests, 4);
  assert.deepEqual(results, [{ available: true }, { available: true }]);
  assert.deepEqual([...secureStorage.values.values()], ["refresh-two"]);
});

test("invalid refresh clears local credentials and signals the auth gate", async () => {
  const secureStorage = createStorage("revoked-refresh");
  let expiredCount = 0;
  const { client } = createClient({
    secureStorage,
    onSessionExpired: () => {
      expiredCount += 1;
    },
    fetchImpl: async () =>
      failure("SESSION_REVOKED", "Sesi sudah dicabut."),
  });

  await assert.rejects(client.restoreSession(), (error) => {
    assert.ok(error instanceof AuthApiError);
    assert.equal(error.code, "SESSION_REVOKED");
    return true;
  });
  assert.equal(secureStorage.values.size, 0);
  assert.equal(expiredCount, 1);
});

test("auto-lock policy locks at 10 minutes and not before", () => {
  const start = 1_000_000;
  assert.equal(AUTO_LOCK_TIMEOUT_MS, 10 * 60 * 1000);
  assert.equal(shouldAutoLock(start, start + AUTO_LOCK_TIMEOUT_MS - 1), false);
  assert.equal(shouldAutoLock(start, start + AUTO_LOCK_TIMEOUT_MS), true);
  assert.equal(shouldAutoLock(Number.NaN, start), false);
});

test("logout revokes the server session and clears the secure refresh token", async () => {
  const secureStorage = createStorage("refresh-one");
  const calls = [];
  const { client } = createClient({
    secureStorage,
    fetchImpl: async (url, options) => {
      calls.push({ path: new URL(url).pathname, options });
      return success({ loggedOut: true });
    },
  });

  const result = await client.logout();

  assert.deepEqual(calls.map((call) => call.path), ["/api/v1/auth/logout"]);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    refreshToken: "refresh-one",
  });
  assert.equal(result.serverConfirmed, true);
  assert.equal(secureStorage.values.size, 0);
});

test("logout clears the secure refresh token when the server is unreachable", async () => {
  const secureStorage = createStorage("refresh-one");
  const { client } = createClient({
    secureStorage,
    fetchImpl: async () => {
      throw new Error("network detail");
    },
  });

  const result = await client.logout();

  assert.equal(result.serverConfirmed, false);
  assert.equal(result.notice, "Tidak dapat terhubung ke server. Periksa koneksi internet.");
  assert.equal(secureStorage.values.size, 0);
});

test("network failure is shown without discarding a potentially recoverable token", async () => {
  const secureStorage = createStorage("refresh-kept");
  const { client } = createClient({
    secureStorage,
    fetchImpl: async () => {
      throw new Error("network detail");
    },
  });

  await assert.rejects(client.restoreSession(), (error) => {
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.message, "Tidak dapat terhubung ke server. Periksa koneksi internet.");
    return true;
  });
  assert.deepEqual([...secureStorage.values.values()], ["refresh-kept"]);
});

test("production API configuration rejects non-HTTPS URLs", async () => {
  const client = createAuthClient({
    apiBaseUrl: "http://api.seroo.test",
    secureStorage: createStorage(),
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  await assert.rejects(client.login({ email: "u@seroo.test", password: "p" }), {
    code: "CONFIGURATION_ERROR",
  });
});
