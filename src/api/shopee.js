// ShopeeFood API client — order dibuat lewat endpoint POS biasa dengan
// platformOrderId (lihat backend/src/pos/routes.js). Modul ini untuk
// daftar & update status penyerahan driver (backend/src/shopee-food/routes.js).

import { createApiClient } from './api.js';

export function createShopeeApi({ request }) {
  return {
    // Lihat daftar pesanan ShopeeFood yang belum selesai (pending)
    async listPendingOrders(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query
        ? `/outlets/${outletId}/shopee-orders?${query}`
        : `/outlets/${outletId}/shopee-orders`;
      const data = await request.get(path);
      return data;
    },

    // Update status penyerahan driver (PENDING/PICKED/DELIVERED/SETTLED/CANCELLED)
    async updateOrderStatus(outletId, orderId, statusData) {
      const data = await request.patch(
        `/outlets/${outletId}/orders/${orderId}/status`,
        statusData,
      );
      return data;
    },
  };
}
