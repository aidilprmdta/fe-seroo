// orderActionError.js — Klasi penanganan error aksi order di UI.
// Menyediakan kode error yang konsisten untuk aksi order (verifikasi QRIS, cancel, dsb.).

export const ORDER_ACTION_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  QUANTITY_EXCEEDED: "QUANTITY_EXCEEDED",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  PAYMENT_CONFLICT: "PAYMENT_CONFLICT",
  PERIOD_CLOSED: "PERIOD_CLOSED",
  UNSUPPORTED_ACTION: "UNSUPPORTED_ACTION",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

export class OrderActionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "OrderActionError";
    this.code = code;
    this.details = details || null;
  }

  static fromResponse(res) {
    const data = res?.data ?? {};
    const text = res?.statusText ?? "";
    const message = data.error?.message || data.message || text || "Aksi gagal.";
    const code = data.error?.code || "UNKNOWN_ERROR";
    return new OrderActionError(code, message, data);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function isOrderActionError(error) {
  return error instanceof OrderActionError;
}
