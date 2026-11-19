import { createApiClient } from './api.js';

export function createInventoryApi({ request }) {
  return {
    async getStock(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/stocks?${query}` : `/outlets/${outletId}/stocks`;
      const data = await request.get(path);
      return data;
    },
    async getStockMovements(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/stock-movements?${query}` : `/outlets/${outletId}/stock-movements`;
      const data = await request.get(path);
      return data;
    },
    async getStockAlerts(outletId) {
      const data = await request.get(`/outlets/${outletId}/stocks/alerts`);
      return data;
    },
    async createStockReceipt(outletId, data) {
    const response = await request.post(`/outlets/${outletId}/stock-movements`, data);
    return response.data;
    },
    async createStockAdjustment(outletId, data) {
    const response = await request.post(`/outlets/${outletId}/stock-movements`, data);
    return response.data;
    },
  };
}
