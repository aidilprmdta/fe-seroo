export class PosApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "PosApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new PosApiError(
    "INVALID_RESPONSE",
    502,
    "Respons POS dari server tidak sesuai kontrak.",
  );
}

function isMoney(value) {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)
  );
}

function assertCatalog(data) {
  if (
    !data ||
    typeof data.outletId !== "string" ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.addOns)
  ) {
    throw invalidResponse();
  }

  const validProducts = data.products.every(
    (product) =>
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      Array.isArray(product.variants) &&
      product.variants.every(
        (variant) =>
          typeof variant.id === "string" &&
          typeof variant.name === "string" &&
          isMoney(variant.price),
      ),
  );
  const validAddOns = data.addOns.every(
    (addOn) =>
      typeof addOn.id === "string" &&
      typeof addOn.name === "string" &&
      isMoney(addOn.price),
  );

  if (!validProducts || !validAddOns) {
    throw invalidResponse();
  }
  return data;
}

function assertOrderResult(data) {
  const order = data?.order;
  if (
    !order ||
    typeof order.id !== "string" ||
    typeof order.orderNumber !== "string" ||
    typeof order.total !== "string" ||
    !Array.isArray(order.items) ||
    (data.replayed !== undefined && typeof data.replayed !== "boolean")
  ) {
    throw invalidResponse();
  }
  return data;
}

export function createPosApi({ request }) {
  return {
    async getCatalog(outletId) {
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/catalog`,
      );
      return assertCatalog(data);
    },
    async createOrder(outletId, payload) {
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/orders`,
        { method: "POST", body: payload },
      );
      return assertOrderResult(data);
    },
    async verifyQris(outletId, orderId, { notes } = {}) {
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/orders/${encodeURIComponent(orderId)}/verify-qris`,
        {
          method: "POST",
          body: notes ? { notes } : {},
        },
      );
      return assertOrderResult(data);
    },
    async listOrders(
      outletId,
      { paymentStatus, status, page = 1, pageSize = 20, limit } = {},
    ) {
      const params = new URLSearchParams();
      if (paymentStatus) params.append("paymentStatus", paymentStatus);
      if (status) params.append("status", status);
      if (limit !== undefined) {
        params.append("limit", limit.toString());
      } else {
        params.append("page", page.toString());
        params.append("pageSize", pageSize.toString());
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/orders${query}`,
      );
      if (
        !data ||
        !Array.isArray(data.orders) ||
        !data.pagination ||
        typeof data.pagination.page !== "number" ||
        typeof data.pagination.pageSize !== "number" ||
        typeof data.pagination.hasNextPage !== "boolean"
      ) {
        throw invalidResponse();
      }
      return data;
    },
    async getOrder(outletId, orderId) {
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/orders/${encodeURIComponent(orderId)}`,
      );
      return assertOrderResult(data);
    },
    async cancelOrder(outletId, orderId, { reason, recordWaste = true, notes } = {}) {
      const body = {
        reason,
        recordWaste: Boolean(recordWaste),
        ...(notes ? { notes } : {}),
      };
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: "POST",
          body,
        },
      );
      return assertOrderResult(data);
    },
  };
}
