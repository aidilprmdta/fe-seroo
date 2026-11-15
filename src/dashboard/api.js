export class DashboardApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "DashboardApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new DashboardApiError(
    "INVALID_RESPONSE",
    502,
    "Respons dashboard dari server tidak sesuai kontrak.",
  );
}

export function createDashboardApi({ request }) {
  return {
    async getDashboard(outletId) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/dashboard`;
      const data = await request(path);
      if (
        !data ||
        !data.outlet ||
        !data.sales ||
        !data.expenses ||
        typeof data.netBalance !== "string" ||
        !data.stock ||
        !data.waste ||
        !data.closingStatus ||
        !Array.isArray(data.activities)
      ) {
        throw invalidResponse();
      }
      return data;
    },
  };
}

