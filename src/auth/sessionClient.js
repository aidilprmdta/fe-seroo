const REFRESH_TOKEN_KEY = "seroo.refreshToken";
const REQUEST_TIMEOUT_MS = 15000;

export class AuthApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
  }
}

function assertTokenResponse(data) {
  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.refreshToken !== "string" ||
    data.tokenType !== "Bearer" ||
    !Number.isInteger(data.expiresIn) ||
    !data.session ||
    typeof data.session.id !== "string" ||
    typeof data.session.expiresAt !== "string"
  ) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      502,
      "Respons autentikasi dari server tidak sesuai kontrak.",
    );
  }
  return data;
}

function safeServerError(payload, status) {
  const error = payload?.error;
  return new AuthApiError(
    typeof error?.code === "string" ? error.code : "INTERNAL_SERVER_ERROR",
    status,
    typeof error?.message === "string"
      ? error.message
      : "Permintaan tidak dapat diproses.",
  );
}

export function createAuthClient({
  apiBaseUrl,
  secureStorage,
  fetchImpl = fetch,
  allowInsecureHttp = false,
  onSessionExpired = () => {},
}) {
  let accessToken = null;
  let refreshPromise = null;
  let expirationPromise = null;
  let sessionGeneration = 0;

  function getEndpoint(path) {
    if (!apiBaseUrl) {
      throw new AuthApiError(
        "CONFIGURATION_ERROR",
        0,
        "Alamat API belum dikonfigurasi.",
      );
    }

    let base;
    try {
      base = new URL(apiBaseUrl);
    } catch {
      throw new AuthApiError(
        "CONFIGURATION_ERROR",
        0,
        "Alamat API tidak valid.",
      );
    }

    if (
      !["http:", "https:"].includes(base.protocol) ||
      (base.protocol !== "https:" && !allowInsecureHttp) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new AuthApiError(
        "CONFIGURATION_ERROR",
        0,
        "Alamat API harus menggunakan HTTPS pada build produksi.",
      );
    }

    return new URL(path, `${base.origin}/`).toString();
  }

  async function send(path, { method = "GET", body, bearerToken } = {}) {
    const endpoint = getEndpoint(path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    let response;
    try {
      response = await fetchImpl(endpoint, {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new AuthApiError(
          "NETWORK_TIMEOUT",
          0,
          "Waktu koneksi habis. Periksa jaringan lalu coba lagi.",
        );
      }
      throw new AuthApiError(
        "NETWORK_ERROR",
        0,
        "Tidak dapat terhubung ke server. Periksa koneksi internet.",
      );
    } finally {
      clearTimeout(timeout);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new AuthApiError(
        "INVALID_RESPONSE",
        response.status,
        "Respons server tidak dapat dibaca.",
      );
    }

    if (!response.ok || payload?.success !== true) {
      throw safeServerError(payload, response.status);
    }
    return payload.data;
  }

  async function clearLocalSession() {
    sessionGeneration += 1;
    accessToken = null;
    await secureStorage.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  async function refreshTokens() {
    const generation = sessionGeneration;
    const previousRefreshToken =
      await secureStorage.getItemAsync(REFRESH_TOKEN_KEY);
    if (!previousRefreshToken) {
      throw new AuthApiError(
        "UNAUTHORIZED",
        401,
        "Sesi tidak tersedia. Silakan login.",
      );
    }

    const data = assertTokenResponse(
      await send("/api/v1/auth/refresh", {
        method: "POST",
        body: { refreshToken: previousRefreshToken },
      }),
    );

    if (generation !== sessionGeneration) {
      throw new AuthApiError(
        "SESSION_REVOKED",
        401,
        "Sesi sudah dihentikan.",
      );
    }

    try {
      await secureStorage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
    } catch {
      accessToken = null;
      throw new AuthApiError(
        "SECURE_STORAGE_ERROR",
        0,
        "Token aman tidak dapat disimpan pada perangkat.",
      );
    }

    accessToken = data.accessToken;
    return data;
  }

  function refreshAccessToken() {
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  function expireSession() {
    if (!expirationPromise) {
      expirationPromise = clearLocalSession()
        .finally(onSessionExpired)
        .finally(() => {
          expirationPromise = null;
        });
    }
    return expirationPromise;
  }

  async function request(
    path,
    { method = "GET", body, authenticated = true } = {},
  ) {
    if (!authenticated) {
      return send(path, { method, body });
    }

    if (!accessToken) {
      try {
        await refreshAccessToken();
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          await expireSession();
        }
        throw error;
      }
    }

    const attemptedToken = accessToken;
    try {
      return await send(path, { method, body, bearerToken: attemptedToken });
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }

      if (accessToken !== attemptedToken && accessToken) {
        return send(path, { method, body, bearerToken: accessToken });
      }

      try {
        await refreshAccessToken();
      } catch (refreshError) {
        if (refreshError.status === 401 || refreshError.status === 403) {
          await expireSession();
        }
        throw refreshError;
      }

      return send(path, { method, body, bearerToken: accessToken });
    }
  }

  async function profile() {
    const data = await request("/api/v1/auth/me");
    if (
      !data?.user ||
      typeof data.user.id !== "string" ||
      typeof data.user.name !== "string" ||
      typeof data.user.email !== "string" ||
      typeof data.user.mustChangePassword !== "boolean" ||
      !Array.isArray(data.user.memberships) ||
      data.user.memberships.some(
        (membership) =>
          typeof membership?.outletId !== "string" ||
          typeof membership?.outletCode !== "string" ||
          typeof membership?.outletName !== "string" ||
          ![
            "ADMIN_PUSAT",
            "OWNER_MITRA",
            "OWNER",
            "MANAGER",
            "CREW",
          ].includes(membership?.role),
      ) ||
      !data.session ||
      typeof data.session.id !== "string"
    ) {
      throw new AuthApiError(
        "INVALID_RESPONSE",
        502,
        "Profil pengguna dari server tidak sesuai kontrak.",
      );
    }
    return data;
  }

  async function changePassword({ currentPassword, newPassword }) {
    const data = await request("/api/v1/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
    if (data?.passwordChanged !== true) {
      throw new AuthApiError(
        "INVALID_RESPONSE",
        502,
        "Respons perubahan password dari server tidak sesuai kontrak.",
      );
    }
    return data;
  }

  async function login({ email, password }) {
    const generation = sessionGeneration;
    const data = assertTokenResponse(
      await send("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    );

    if (generation !== sessionGeneration) {
      await send("/api/v1/auth/logout", {
        method: "POST",
        body: { refreshToken: data.refreshToken },
      });
      throw new AuthApiError("SESSION_REVOKED", 401, "Sesi sudah dihentikan.");
    }

    try {
      await secureStorage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
    } catch {
      throw new AuthApiError(
        "SECURE_STORAGE_ERROR",
        0,
        "Token aman tidak dapat disimpan pada perangkat.",
      );
    }

    accessToken = data.accessToken;
    return profile();
  }

  async function restoreSession() {
    const storedRefreshToken =
      await secureStorage.getItemAsync(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      return null;
    }

    try {
      await refreshAccessToken();
      return await profile();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        await expireSession();
      }
      throw error;
    }
  }

  async function logout() {
    sessionGeneration += 1;
    accessToken = null;
    onSessionExpired();
    let serverConfirmed = false;
    let notice = null;
    let storedRefreshToken = null;

    try {
      storedRefreshToken =
        await secureStorage.getItemAsync(REFRESH_TOKEN_KEY);
      if (storedRefreshToken) {
        await send("/api/v1/auth/logout", {
          method: "POST",
          body: { refreshToken: storedRefreshToken },
        });
        serverConfirmed = true;
      } else {
        notice = "Token lokal tidak tersedia untuk mengonfirmasi logout server.";
      }
    } catch (error) {
      notice = error.message;
    }

    try {
      await clearLocalSession();
    } catch {
      throw new AuthApiError(
        "SECURE_STORAGE_ERROR",
        0,
        "Sesi sudah dihentikan di memori, tetapi token lokal tidak dapat dihapus.",
      );
    }

    return { serverConfirmed, notice };
  }

  async function logoutAll() {
    const data = await request("/api/v1/auth/logout-all", { method: "POST" });
    await clearLocalSession();
    onSessionExpired();
    return data;
  }

  return {
    login,
    logout,
    logoutAll,
    changePassword,
    profile,
    request,
    restoreSession,
    refreshAccessToken,
    expireSession,
    getAccessToken: () => accessToken,
  };
}
