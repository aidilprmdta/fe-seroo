import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiClient,
  OutletsApi,
  setSessionDelegate,
  getSessionDelegate,
  clearSessionDelegate,
  setAuthTokenProvider,
  isPublicEndpoint,
  ApiError,
  ApiTimeoutError,
} from "../src/api/api.js";
import { createOutletAccessApi } from "../src/api/outlets.js";
import { resolveLandingRoute, getSelectedMembership } from "../src/auth/routePolicy.js";

test("Bug 1: OutletsApi.listOutlets parses backend response { success: true, data: { outlets } }", async () => {
  const mockBackendResponse = {
    success: true,
    data: {
      outlets: [
        { id: "outlet-1", name: "Outlet Rumbai", code: "RMB", role: "MANAGER" },
        { id: "outlet-2", name: "Outlet Panam", code: "PNM", role: "CREW" },
      ],
    },
  };

  const mockRequest = {
    async get(path) {
      assert.equal(path, "/outlets");
      return mockBackendResponse;
    },
  };

  const api = new OutletsApi(mockRequest);
  const data = await api.listOutlets();

  // Memastikan data yang dikembalikan memiliki properti outlets yang berupa array
  assert.ok(data);
  assert.ok(Array.isArray(data.outlets), "data.outlets harus berupa array");
  assert.equal(data.outlets.length, 2);
  assert.equal(data.outlets[0].name, "Outlet Rumbai");
});

test("Outlet Security: Empty API response { outlets: [] } does NOT restore stale memberships", async () => {
  // Simulasi user memiliki memberships lokal lama di session
  const staleUserMemberships = [
    { outletId: "revoked-outlet-1", outletName: "Revoked Outlet", role: "CREW" },
  ];

  // Simulasi respons backend: outlet keanggotaan sudah dicabut sehingga API mengembalikan list kosong
  const mockRequest = {
    async get(path) {
      return { success: true, data: { outlets: [] } };
    },
  };

  const api = new OutletsApi(mockRequest);
  const data = await api.listOutlets();
  const list = Array.isArray(data?.outlets)
    ? data.outlets
    : Array.isArray(data)
    ? data
    : [];

  // Verifikasi: List harus tetap kosong, tidak boleh fallback ke staleUserMemberships
  assert.equal(list.length, 0, "List outlets harus kosong ketika API mengembalikan []");
  assert.notEqual(list.length, staleUserMemberships.length);
});

test("Outlet Security: Network failure on outlet list does NOT restore stale memberships and surfaces retry", async () => {
  const staleUserMemberships = [
    { outletId: "revoked-outlet-1", outletName: "Revoked Outlet", role: "CREW" },
  ];

  const mockRequest = {
    async get() {
      throw new Error("Koneksi gagal");
    },
  };

  const api = new OutletsApi(mockRequest);
  let outlets = null;
  let error = null;

  try {
    const data = await api.listOutlets();
    outlets = Array.isArray(data?.outlets) ? data.outlets : [];
  } catch (err) {
    error = err.message || "Gagal memuat outlet. Periksa koneksi internet.";
    outlets = [];
  }

  assert.deepEqual(outlets, [], "Outlets harus di-set ke [] pada kegagalan jaringan");
  assert.equal(error, "Koneksi gagal", "Error harus disimpan untuk memicu tombol retry");
});

test("Outlet Security: resolveLandingRoute uses active role and active outlet accurately", () => {
  const memberships = [
    { outletId: "outlet-pnm", role: "CREW", outlet: { id: "outlet-pnm", isActive: true } },
    { outletId: "outlet-rmb", role: "MANAGER", outlet: { id: "outlet-rmb", isActive: true } },
  ];

  const routeManager = resolveLandingRoute(memberships, {
    activeOutletId: "outlet-rmb",
    activeRole: "MANAGER",
  });
  assert.equal(routeManager, "/manager/dashboard");

  const routeCrew = resolveLandingRoute(memberships, {
    activeOutletId: "outlet-pnm",
    activeRole: "CREW",
  });
  assert.equal(routeCrew, "/crew");
});

test("Bug 3: createApiClient menyediakan method delete dan del, serta OutletsApi.removeMember tidak melempar TypeError", async () => {
  const requests = [];
  const client = {
    async delete(path, options) {
      requests.push({ method: "DELETE", path, options });
      return { success: true, data: { removed: true } };
    },
    async del(path, options) {
      return this.delete(path, options);
    },
  };

  const api = new OutletsApi(client);
  const result = await api.removeMember("outlet-rumbai", "user-123");

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "DELETE");
  assert.equal(requests[0].path, "/outlets/outlet-rumbai/members/user-123");
  assert.deepEqual(result, { removed: true });

  // Test createOutletAccessApi dari mobile/src/api/outlets.js
  const outletApi = createOutletAccessApi({ request: client });
  const deleteResult = await outletApi.removeMember("outlet-rumbai", "user-456");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].path, "/outlets/outlet-rumbai/members/user-456");
  assert.deepEqual(deleteResult, { success: true, data: { removed: true } });
});

test("Bug 3: removeMember correctly encodes URI parameters and forwards options", async () => {
  const requests = [];
  const client = {
    async delete(path, options) {
      requests.push({ method: "DELETE", path, options });
      return { success: true, data: { message: "Revoked" } };
    },
    async del(path, options) {
      return this.delete(path, options);
    },
  };

  const api = new OutletsApi(client);
  await api.removeMember("outlet/special#1", "user+name@test.com", { headers: { "X-Test": "1" } });

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].path,
    `/outlets/${encodeURIComponent("outlet/special#1")}/members/${encodeURIComponent("user+name@test.com")}`
  );
  assert.deepEqual(requests[0].options, { headers: { "X-Test": "1" } });
});

test("Bug 3: removeMember propagates 403 Forbidden and 404 Not Found errors as ApiError", async () => {
  const client = {
    async delete(path) {
      throw new ApiError("Keanggotaan staf tidak ditemukan di outlet ini.", 404, "NOT_FOUND");
    },
    async del(path) {
      return this.delete(path);
    },
  };

  const api = new OutletsApi(client);
  await assert.rejects(
    async () => {
      await api.removeMember("outlet-1", "user-not-found");
    },
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, "NOT_FOUND");
      return true;
    }
  );
});

test("Bug 3: createApiClient instance bawaan memiliki method del dan delete", () => {
  const apiClient = createApiClient({ baseUrl: "http://localhost:3000/api/v1" });
  assert.equal(typeof apiClient.del, "function", "apiClient.del harus berupa function");
  assert.equal(typeof apiClient.delete, "function", "apiClient.delete harus berupa function");
});

test("Scenario 1: Valid token -> request succeeds directly without refresh", async () => {
  let refreshCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.headers?.Authorization, "Bearer valid-token");
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { item: 1 } };
      },
    };
  };

  const mockDelegate = {
    getAccessToken() {
      return "valid-token";
    },
    async refreshAccessToken() {
      refreshCount += 1;
      return { accessToken: "valid-token" };
    },
  };

  setSessionDelegate(mockDelegate);
  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    const res = await client.get("/catalog");
    assert.equal(res.success, true);
    assert.equal(refreshCount, 0, "Tidak boleh memanggil refresh saat token valid");
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 2: Expired token (401) -> refresh token once -> retry succeeds", async () => {
  let callCount = 0;
  let refreshCount = 0;
  let tokenInUse = "initial-expired-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    callCount += 1;
    const authHeader = options?.headers?.Authorization;

    if (authHeader === "Bearer initial-expired-token") {
      return {
        ok: false,
        status: 401,
        async json() {
          return { error: { code: "UNAUTHORIZED", message: "Token expired" } };
        },
      };
    }

    if (authHeader === "Bearer fresh-rotated-token") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { success: true, data: { message: "Success with fresh token" } };
        },
      };
    }

    return { ok: false, status: 500, async json() { return {}; } };
  };

  const mockSessionDelegate = {
    getAccessToken() {
      return tokenInUse;
    },
    async refreshAccessToken() {
      refreshCount += 1;
      tokenInUse = "fresh-rotated-token";
      return { accessToken: tokenInUse };
    },
    async expireSession() {},
  };

  setSessionDelegate(mockSessionDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    const response = await client.get("/test-endpoint");

    assert.equal(callCount, 2, "Request harus dipanggil 2 kali (pertama gagal 401, kedua retry)");
    assert.equal(refreshCount, 1, "refreshAccessToken harus dipanggil tepat 1 kali");
    assert.deepEqual(response, { success: true, data: { message: "Success with fresh token" } });
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 3: Concurrent requests hitting 401 share a single refreshAccessToken call (single-flight)", async () => {
  let refreshCount = 0;
  let tokenInUse = "stale-token";

  let refreshResolver;
  const refreshPromise = new Promise((resolve) => {
    refreshResolver = resolve;
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const authHeader = options?.headers?.Authorization;
    if (authHeader === "Bearer stale-token") {
      return {
        ok: false,
        status: 401,
        async json() {
          return { error: { code: "UNAUTHORIZED", message: "Stale token" } };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { endpoint: url } };
      },
    };
  };

  let inFlightRefresh = null;
  const mockSessionDelegate = {
    getAccessToken() {
      return tokenInUse;
    },
    async refreshAccessToken() {
      if (!inFlightRefresh) {
        refreshCount += 1;
        inFlightRefresh = refreshPromise.then(() => {
          tokenInUse = "new-valid-token";
          inFlightRefresh = null;
        });
      }
      return inFlightRefresh;
    },
    async expireSession() {},
  };

  setSessionDelegate(mockSessionDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });

    // Luncurkan 3 request secara bersamaan saat token stale
    const p1 = client.get("/req-1");
    const p2 = client.get("/req-2");
    const p3 = client.get("/req-3");

    // Selesaikan refresh
    refreshResolver();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    assert.equal(refreshCount, 1, "Hanya satu kali refresh token untuk seluruh request bersamaan");
    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
    assert.equal(r3.success, true);
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 4: Refresh token expired/revoked (401 on refresh) -> calls expireSession and rejects", async () => {
  let expireCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 401,
      async json() {
        return { error: { code: "UNAUTHORIZED", message: "Session expired" } };
      },
    };
  };

  const mockSessionDelegate = {
    getAccessToken() {
      return "old-token";
    },
    async refreshAccessToken() {
      const err = new Error("Refresh token expired");
      err.status = 401;
      throw err;
    },
    async expireSession() {
      expireCalled = true;
    },
  };

  setSessionDelegate(mockSessionDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.get("/protected-endpoint");
      },
      (err) => {
        assert.equal(err.status, 401);
        return true;
      }
    );
    assert.equal(expireCalled, true, "expireSession harus dipanggil ketika refresh gagal 401");
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 5: Public endpoint /auth/login returning 401 does NOT invoke refreshAccessToken", async () => {
  let refreshAttempted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(url.includes("/auth/login"));
    return {
      ok: false,
      status: 401,
      async json() {
        return { error: { code: "INVALID_CREDENTIALS", message: "Email atau password salah" } };
      },
    };
  };

  const mockDelegate = {
    getAccessToken() {
      return null;
    },
    async refreshAccessToken() {
      refreshAttempted = true;
      return { accessToken: "should-not-happen" };
    },
  };

  setSessionDelegate(mockDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.post("/auth/login", { email: "test@example.com", password: "wrong" });
      },
      (err) => {
        assert.equal(err.status, 401);
        assert.equal(err.code, "INVALID_CREDENTIALS");
        return true;
      }
    );

    assert.equal(refreshAttempted, false, "Tidak boleh memanggil refreshAccessToken pada /auth/login 401");
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 6: Public endpoint /auth/refresh returning 401 does NOT trigger recursion", async () => {
  let refreshCallCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(url.includes("/auth/refresh"));
    return {
      ok: false,
      status: 401,
      async json() {
        return { error: { code: "REFRESH_TOKEN_EXPIRED", message: "Refresh token kadaluarsa" } };
      },
    };
  };

  const mockDelegate = {
    getAccessToken() {
      return null;
    },
    async refreshAccessToken() {
      refreshCallCount += 1;
    },
  };

  setSessionDelegate(mockDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.post("/auth/refresh", { refreshToken: "expired-refresh-token" });
      },
      (err) => {
        assert.equal(err.status, 401);
        return true;
      }
    );

    assert.equal(refreshCallCount, 0, "Tidak boleh ada rekursi refreshAccessToken pada /auth/refresh");
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 7: Public health probes skip auth and do not refresh on 401", async () => {
  let authHeaderSent = false;
  let refreshCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options?.headers?.Authorization) {
      authHeaderSent = true;
    }
    return {
      ok: false,
      status: 401,
      async json() {
        return { error: { message: "Unhealthy" } };
      },
    };
  };

  const mockDelegate = {
    getAccessToken() {
      return "dummy-token";
    },
    async refreshAccessToken() {
      refreshCalled = true;
    },
  };

  setSessionDelegate(mockDelegate);

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.get("/health");
      },
      (err) => {
        assert.equal(err.status, 401);
        return true;
      }
    );

    assert.equal(authHeaderSent, false, "Health endpoint tidak boleh menyertakan auth header");
    assert.equal(refreshCalled, false, "Health endpoint tidak boleh memicu refresh");
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionDelegate();
  }
});

test("Scenario 8: Network error triggers ApiError with NETWORK_ERROR code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.get("/any-endpoint");
      },
      (err) => {
        assert.equal(err.code, "NETWORK_ERROR");
        assert.equal(err.status, 0);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Scenario 9: Timeout error triggers ApiTimeoutError with TIMEOUT code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    throw abortErr;
  };

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await assert.rejects(
      async () => {
        await client.get("/slow-endpoint");
      },
      (err) => {
        assert.equal(err.code, "TIMEOUT");
        assert.equal(err.status, 0);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Scenario 10: clearSessionDelegate clears activeSessionDelegate and token provider", async () => {
  let tokenCalled = false;
  setSessionDelegate({
    getAccessToken() {
      tokenCalled = true;
      return "some-token";
    },
  });
  setAuthTokenProvider(() => {
    tokenCalled = true;
    return "provider-token";
  });

  assert.ok(getSessionDelegate() !== null);

  clearSessionDelegate();

  assert.equal(getSessionDelegate(), null, "Session delegate harus null setelah clearSessionDelegate");
  const originalFetch = globalThis.fetch;
  let sentAuthHeader = null;
  globalThis.fetch = async (url, options) => {
    sentAuthHeader = options?.headers?.Authorization;
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true };
      },
    };
  };

  try {
    const client = createApiClient({ baseUrl: "http://mock-api.seroo.test" });
    await client.get("/public-or-unauthed");
    assert.equal(sentAuthHeader, undefined, "Tidak boleh ada Authorization header setelah session di-clear");
    assert.equal(tokenCalled, false, "Tidak boleh memanggil getter token lama setelah session di-clear");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Helper isPublicEndpoint accurately classifies public routes and query params", () => {
  assert.equal(isPublicEndpoint("/auth/login"), true);
  assert.equal(isPublicEndpoint("/api/v1/auth/login"), true);
  assert.equal(isPublicEndpoint("http://localhost:3000/api/v1/auth/login"), true);
  assert.equal(isPublicEndpoint("/auth/refresh"), true);
  assert.equal(isPublicEndpoint("http://localhost:3000/api/v1/auth/refresh?foo=bar"), true);
  assert.equal(isPublicEndpoint("/health"), true);
  assert.equal(isPublicEndpoint("/healthz"), true);
  assert.equal(isPublicEndpoint("/readyz"), true);

  assert.equal(isPublicEndpoint("/auth/me"), false);
  assert.equal(isPublicEndpoint("/outlets"), false);
  assert.equal(isPublicEndpoint("/outlets/1/members"), false);
  assert.equal(isPublicEndpoint("/admin/accounts"), false);
});

