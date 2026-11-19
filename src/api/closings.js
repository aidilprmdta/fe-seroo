import { createApiClient } from './api.js';

export function createClosingsApi({ request }) {
  return {
    async listClosings(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/closings?${query}` : `/outlets/${outletId}/closings`;
      const data = await request.get(path);
      return data;
    },
    async getClosingPreview(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query
        ? `/outlets/${outletId}/closings/preview?${query}`
        : `/outlets/${outletId}/closings/preview`;
      const data = await request.get(path);
      return data;
    },
    async createClosing(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/closings`, data);
      return response.data;
    },
    async reopenClosing(outletId, closingId, data) {
      const response = await request.post(`/outlets/${outletId}/closings/reopen`, data);
      return response.data;
    },
    async getCashOpening(outletId, periodKey) {
      const data = await request.get(`/outlets/${outletId}/cash-openings/${periodKey}`);
      return data;
    },
    async createCashOpening(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/cash-openings`, data);
      return response.data;
    },
  };
}
