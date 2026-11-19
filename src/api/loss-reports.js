import { createApiClient } from './api.js';

export function createLossReportsApi({ request }) {
  return {
    async listLossReports(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query
        ? `/outlets/${encodeURIComponent(outletId)}/loss-reports?${query}`
        : `/outlets/${encodeURIComponent(outletId)}/loss-reports`;
      const response = await request.get(path);
      return response?.data ?? response;
    },
    async createLossReport(outletId, data) {
      const response = await request.post(
        `/outlets/${encodeURIComponent(outletId)}/loss-reports`,
        data,
      );
      return response?.data ?? response;
    },
    async reviewLossReport(outletId, reportId, data) {
      const response = await request.patch(
        `/outlets/${encodeURIComponent(outletId)}/loss-reports/${encodeURIComponent(reportId)}/review`,
        data,
      );
      return response?.data ?? response;
    },
  };
}
