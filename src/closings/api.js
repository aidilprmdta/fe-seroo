export class ClosingApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "ClosingApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new ClosingApiError(
    "INVALID_RESPONSE",
    502,
    "Respons data closing dari server tidak sesuai kontrak.",
  );
}

export function createClosingApi({ request }) {
  return {
    async getPreview(outletId, { type = "DAILY", periodKey }) {
      const query = `?type=${encodeURIComponent(type)}&periodKey=${encodeURIComponent(periodKey)}`;
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/closings/preview${query}`;
      const data = await request(path);
      if (
        !data ||
        typeof data.outletId !== "string" ||
        typeof data.closingType !== "string" ||
        typeof data.periodKey !== "string" ||
        !Array.isArray(data.unfinishedTransactions)
      ) {
        throw invalidResponse();
      }
      return data;
    },

    async getClosings(outletId, type) {
      const query = type ? `?type=${encodeURIComponent(type)}` : "";
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/closings${query}`;
      const data = await request(path);
      if (!Array.isArray(data?.closings)) {
        throw invalidResponse();
      }
      return data;
    },

    async performClosing(outletId, payload) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/closings`;
      const data = await request(path, {
        method: "POST",
        body: payload,
      });
      if (!data?.record || typeof data.record.status !== "string") {
        throw invalidResponse();
      }
      return data;
    },

    async recordCashOpening(outletId, payload) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/cash-openings`;
      const data = await request(path, {
        method: "POST",
        body: payload,
      });
      if (!data?.id || typeof data.openingCash !== "string") {
        throw invalidResponse();
      }
      return data;
    },

    async getCashOpening(outletId, periodKey) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/cash-openings/${encodeURIComponent(periodKey)}`;
      const data = await request(path);
      if (data && typeof data.cashOpening !== "undefined") {
        return data.cashOpening;
      }
      throw invalidResponse();
    },

    async reopenClosing(outletId, payload) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/closings/reopen`;
      const data = await request(path, {
        method: "POST",
        body: payload,
      });
      if (!data?.record || data.record.status !== "REOPENED") {
        throw invalidResponse();
      }
      return data;
    },

    async updateCashDifference(outletId, closingId, payload) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/closings/${encodeURIComponent(closingId)}/cash-difference`;
      const data = await request(path, {
        method: "PATCH",
        body: payload,
      });
      if (!data?.closing || typeof data.closing.cashDifferenceStatus !== "string") {
        throw invalidResponse();
      }
      return data;
    },
  };
}

