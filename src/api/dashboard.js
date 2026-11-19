import { createApiClient } from './api.js';

export function createDashboardApi({ request }) {
  return {
    async getDashboard(outletId) {
      const data = await request.get(`/outlets/${outletId}/dashboard`);
      return data;
    },
  };
}
