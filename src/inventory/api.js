export class InventoryApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "InventoryApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new InventoryApiError(
    "INVALID_RESPONSE",
    502,
    "Respons inventaris dari server tidak sesuai kontrak.",
  );
}

function isQuantity(value) {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/.test(value)
  );
}

function assertStocks(data) {
  if (
    !data ||
    typeof data.outletId !== "string" ||
    !Array.isArray(data.stocks) ||
    !data.stocks.every(
      (item) =>
        typeof item.inventoryItemId === "string" &&
        typeof item.name === "string" &&
        typeof item.unit === "string" &&
        isQuantity(item.quantity),
    )
  ) {
    throw invalidResponse();
  }
  return data;
}

function assertMovements(data) {
  if (
    !data ||
    !Array.isArray(data.movements) ||
    !data.movements.every(
      (movement) =>
        typeof movement.id === "string" &&
        ["IN", "OUT", "WASTE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"].includes(
          movement.type,
        ) &&
        typeof movement.quantity === "string" &&
        movement.inventoryItem &&
        typeof movement.inventoryItem.name === "string",
    )
  ) {
    throw invalidResponse();
  }
  return data;
}

function assertWaste(data) {
  if (
    !data ||
    !Array.isArray(data.waste) ||
    !data.waste.every(
      (record) =>
        typeof record.id === "string" &&
        typeof record.itemName === "string" &&
        typeof record.category === "string" &&
        typeof record.quantity === "string" &&
        typeof record.unit === "string",
    )
  ) {
    throw invalidResponse();
  }
  return data;
}

function assertStockRequests(data) {
  if (
    !data ||
    !Array.isArray(data.requests) ||
    !data.requests.every(
      (request) =>
        typeof request.id === "string" &&
        ["PENDING", "APPROVED", "REJECTED"].includes(request.status) &&
        Array.isArray(request.items) &&
        request.items.every(
          (item) =>
            typeof item.inventoryItemId === "string" &&
            typeof item.itemName === "string" &&
            typeof item.unit === "string" &&
            isQuantity(item.quantity),
        ),
    )
  ) {
    throw invalidResponse();
  }
  return data;
}

function assertCreatedResource(data, key) {
  const resource = data?.[key];
  if (
    !resource ||
    typeof resource.id !== "string" ||
    typeof resource.clientTransactionId !== "string" ||
    typeof data.replayed !== "boolean"
  ) {
    throw invalidResponse();
  }
  return data;
}

export function createInventoryApi({ request }) {
  const outletPath = (outletId) =>
    `/api/v1/outlets/${encodeURIComponent(outletId)}`;

  return {
    async getStocks(outletId) {
      return assertStocks(await request(`${outletPath(outletId)}/stocks`));
    },
    async getMovements(outletId) {
      return assertMovements(
        await request(`${outletPath(outletId)}/stock-movements`),
      );
    },
    async createMovement(outletId, payload) {
      return assertCreatedResource(
        await request(`${outletPath(outletId)}/stock-movements`, {
          method: "POST",
          body: payload,
        }),
        "movement",
      );
    },
    async getWaste(outletId) {
      return assertWaste(await request(`${outletPath(outletId)}/waste`));
    },
    async createWaste(outletId, payload) {
      return assertCreatedResource(
        await request(`${outletPath(outletId)}/waste`, {
          method: "POST",
          body: payload,
        }),
        "waste",
      );
    },
    async getStockRequests(outletId) {
      return assertStockRequests(
        await request(`${outletPath(outletId)}/stock-requests`),
      );
    },
    async createStockRequest(outletId, payload) {
      return assertCreatedResource(
        await request(`${outletPath(outletId)}/stock-requests`, {
          method: "POST",
          body: payload,
        }),
        "request",
      );
    },
    async decideStockRequest(outletId, requestId, payload) {
      return assertCreatedResource(
        await request(
          `${outletPath(outletId)}/stock-requests/${encodeURIComponent(requestId)}`,
          { method: "PATCH", body: payload },
        ),
        "request",
      );
    },
  };
}
