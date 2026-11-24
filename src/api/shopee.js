// ShopeeFood API client — Flow pemesanan dari platform eksternal (ShopeeFood/Grab)
// Frontend: app/crew/shopee-food.js
// Backend: perlu endpoint POST /outlets/:outletId/shopee/orders (belum ada — buat di BE)

import { createApiClient } from './api.js';

export function createShopeeApi({ request }) {
  return {
    // Simpan pesanan ShopeeFood dari platform eksternal
    // Payload sesuai orderSchema di backend (clientTransactionId, recordedOffline, paymentMethod, payments, items)
    async createOrder(outletId, orderData) {
      const data = await request.post(`/outlets/${outletId}/orders`, orderData);
      return data;
    },

    // Lihat daftar pesanan ShopeeFood yang belum selesai (pending)
    async listPendingOrders(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query
        ? `/outlets/${outletId}/shopee-orders?${query}`
        : `/outlets/${outletId}/shopee-orders`;
      const data = await request.get(path);
      return data;
    },

    // Update status pesanan Shopee Food (pickup → deliver → settlement)
    async updateOrderStatus(outletId, orderId, statusData) {
      const data = await request.patch(
        `/outlets/${outletId}/orders/${orderId}/shopee-status`,
        statusData,
      );
      return data;
    },

    // Ambil detail pesanan ShopeeFood
    async getOrder(outletId, orderId) {
      const data = await request.get(`/outlets/${outletId}/orders/${orderId}`);
      return data;
    },
  };
}

// Factory default: buat client + API grab-gabungan
export async function createShopeeClient() {
  const client = createApiClient();
  return createShopeeApi({ request: client });
}
