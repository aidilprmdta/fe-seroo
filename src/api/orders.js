import { createApiClient } from './api';

export function createOrdersApi({ request }) {
  return {
    async createOrder(outletId, orderData) {
      const data = await request.post(`/outlets/${outletId}/orders`, orderData);
      return data;
    },
    async getOrder(outletId, orderId) {
      const data = await request.get(`/outlets/${outletId}/orders/${orderId}`);
      return data;
    },
    async listOrders(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/orders?${query}` : `/outlets/${outletId}/orders`;
      const data = await request.get(path);
      return data;
    },
    async verifyQris(outletId, orderId, verifiedById) {
      const data = await request.post(`/outlets/${outletId}/orders/${orderId}/verify-qris`, { verifiedById });
      return data;
    },
    async cancelOrder(outletId, orderId, cancelData) {
      const data = await request.post(`/outlets/${outletId}/orders/${orderId}/cancel`, cancelData);
      return data;
    },
  };
}
