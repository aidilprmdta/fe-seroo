// orderActions.js — Kumpulan aksi untuk order (verifikasi, cancel, dsb.) di sisi client.
// Beradaptasi dengan EXP-Za (Expo Router) dan API backend Seroo.

import { useState, useCallback } from "react";
import { OrderActionError, ORDER_ACTION_ERROR_CODES } from "./orderActionError.js";

// useApi dapat disediakan oleh konteks aplikasi, default ke fungsi dummy.
export let useApi = () => null;

/**
 * Fungsi murni yang melakukan aksi terhadap order.
 * Cocok untuk unit test (tanpa Expo/React hooks).
 */
export async function executeOrderAction(api, action, orderId, payload = {}) {
  if (!api) throw new OrderActionError(ORDER_ACTION_ERROR_CODES.UNKNOWN_ERROR, "API tidak tersedia");
  let url;
  switch (action) {
    case "VERIFY_QRIS": {
      url = `/outlets/${payload.outletId}/orders/${orderId}/verify-qris`;
      await api.post(url, {});
      break;
    }
    case "CANCEL_ORDER": {
      url = `/outlets/${payload.outletId}/orders/${orderId}/cancel`;
      await api.post(url, {});
      break;
    }
    default:
      throw new OrderActionError(ORDER_ACTION_ERROR_CODES.UNSUPPORTED_ACTION, `Aksi "${action}" tidak didukung.`);
  }
  return { success: true };
}

/**
 * HookUI untuk mengelola state aksi order.
 * @param {Object} options
 * @param {Function} options.useApiProvider - Default useApi function.
 */
export function useOrderActions({ useApiProvider = useApi } = {}) {
  useApi = useApiProvider;
  const api = useApi();
  const [isPending, setIsPending] = useState(false);
  const [lastError, setLastError] = useState(null);

  const run = useCallback(async (action, orderId, payload = {}) => {
    setIsPending(true);
    setLastError(null);
    try {
      await executeOrderAction(api, action, orderId, payload);
      return { success: true };
    } catch (error) {
      const orderError = error instanceof OrderActionError ? error : new OrderActionError(ORDER_ACTION_ERROR_CODES.UNKNOWN_ERROR, String(error));
      setLastError(orderError);
      return { success: false, error: orderError };
    } finally {
      setIsPending(false);
    }
  }, [api]);

  return { isPending, lastError, run, ORDER_ACTION_ERROR_CODES };
}
