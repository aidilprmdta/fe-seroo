// orderActionTestMock.js — Helper mock untuk unit test aksi order.
// Menyediakan implementasi sederhana yang bisa dijadikan dependency di test.

import { OrderActionError, ORDER_ACTION_ERROR_CODES } from "./orderActionError.js";

export function createMockApi(responses = {}) {
  const handlers = new Map();

  for (const [action, response] of Object.entries(responses)) {
    handlers.set(action, response);
  }

  const api = {
    post: async (url, body = {}) => {
      const path = url.split("/").pop();
      const actionKey = handlers.has(path) ? path : "default";
      const response = handlers.get(actionKey) ?? handlers.get("default");
      return response;
    },
    get: async (url) => {
      const path = url.split("/").pop();
      const response = handlers.has(path) ? handlers.get(path) : handlers.get("default");
      if (response) {
        return response;
      }
      throw new OrderActionError(ORDER_ACTION_ERROR_CODES.UNKNOWN_ERROR, "Endpoint tidak ditemukan");
    },
  };

  return api;
}

export function createMockRun(onExecute) {
  return {
    isPending: false,
    lastError: null,
    run: async (action, orderId, payload = {}) => {
      try {
        await onExecute(action, orderId, payload);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof OrderActionError ? error : new OrderActionError(ORDER_ACTION_ERROR_CODES.UNKNOWN_ERROR, String(error)),
        };
      }
    },
  };
}
