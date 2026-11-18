import { createApiClient } from './api';

export function createAdminApi({ request }) {
  return {
    async listAccounts(params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/admin/accounts?${query}` : `/admin/accounts`;
      const data = await request.get(path);
      return data;
    },
    async listOutlets() {
      const data = await request.get('/admin/outlets');
      return data;
    },
    async createAccount(data) {
      const response = await request.post('/admin/accounts', data);
      return response.data;
    },
    async updateAccountStatus(userId, data) {
      const response = await request.patch(`/admin/accounts/${userId}/status`, data);
      return response.data;
    },
    async resetAccountPassword(userId) {
      const data = await request.post(`/admin/accounts/${userId}/reset-password`);
      return data;
    },
    async createOutlet(data) {
      const response = await request.post('/admin/outlets', data);
      return response;
    },
    async updateOutlet(outletId, data) {
      const response = await request.patch(`/admin/outlets/${outletId}`, data);
      return response;
    },
    async listAuditLogs(params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/admin/audit-logs?${query}` : '/admin/audit-logs';
      const data = await request.get(path);
      return data;
    },
  };
}
