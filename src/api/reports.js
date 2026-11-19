import { fetchText } from './api.js';

export function createReportsApi({ request }) {
  return {
    async getDailyReport(outletId, date) {
      const data = await request.get(`/outlets/${outletId}/reports/daily?date=${date}`);
      return data;
    },
    async getMonthlyReport(outletId, monthKey) {
      const data = await request.get(`/outlets/${outletId}/reports/monthly?month=${encodeURIComponent(monthKey)}`);
      return data;
    },
    async exportReport(outletId, format, params = {}) {
      const query = new URLSearchParams(params).toString();
      const suffix = query ? `?${query}` : '';
      return fetchText(`/outlets/${outletId}/reports/export/${format}${suffix}`);
    },
  };
}
