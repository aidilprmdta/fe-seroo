import { createApiClient } from './api.js';

export function createStockRequestsApi({ request }) {
  return {
    async listRequests(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/stock-requests?${query}` : `/outlets/${outletId}/stock-requests`;
      const data = await request.get(path);
      return data;
    },
    async createRequest(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/stock-requests`, data);
      return response;
    },
    async processRequest(outletId, requestId, data) {
    const response = await request.patch(`/outlets/${outletId}/stock-requests/${requestId}`, data);
    return response.data;
    },
  };
}
