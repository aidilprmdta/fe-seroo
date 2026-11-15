export class AdminAccountApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "AdminAccountApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new AdminAccountApiError(
    "INVALID_RESPONSE",
    502,
    "Respons manajemen akun dari server tidak sesuai kontrak.",
  );
}

export function createAdminAccountApi({ request }) {
  return {
    async getAccounts(page = 1, pageSize = 50) {
      const path = `/api/v1/admin/accounts?page=${page}&pageSize=${pageSize}`;
      const data = await request(path);
      if (
        !data ||
        !Array.isArray(data.accounts) ||
        typeof data.hasNextPage !== "boolean"
      ) {
        throw invalidResponse();
      }
      return data;
    },

    async getOutlets() {
      const data = await request("/api/v1/admin/outlets");
      if (!data || !Array.isArray(data.outlets)) {
        throw invalidResponse();
      }
      return data;
    },

    async createAccount(payload) {
      const data = await request("/api/v1/admin/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!data || !data.account) {
        throw invalidResponse();
      }
      return data;
    },

    async setAccountActive(userId, isActive) {
      const path = `/api/v1/admin/accounts/${encodeURIComponent(userId)}/status`;
      const data = await request(path, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      if (!data || !data.account) {
        throw invalidResponse();
      }
      return data;
    },

    async resetPassword(userId) {
      const path = `/api/v1/admin/accounts/${encodeURIComponent(userId)}/reset-password`;
      const data = await request(path, { method: "POST" });
      if (
        !data ||
        typeof data.temporaryPassword !== "string" ||
        data.temporaryPassword.length < 12 ||
        data.mustChangePassword !== true
      ) {
        throw invalidResponse();
      }
      return data;
    },
  };
}
