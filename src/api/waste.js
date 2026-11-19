import { createApiClient } from './api.js';

export function createWasteApi({ request }) {
  return {
    async listWaste(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/waste?${query}` : `/outlets/${outletId}/waste`;
      const data = await request.get(path);
      return data;
    },
    async createWaste(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/waste`, data);
      return response.data;
    },
  };
}
