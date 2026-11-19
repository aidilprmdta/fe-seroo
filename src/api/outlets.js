import { createApiClient } from './api.js';

export function createOutletAccessApi({ request }) {
  return {
    async listOutlets() {
      const data = await request.get('/outlets');
      return data;
    },
    async getOutlet(outletId) {
      const data = await request.get(`/outlets/${outletId}`);
      return data;
    },
    async getMembers(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/members?${query}` : `/outlets/${outletId}/members`;
      const data = await request.get(path);
      return data;
    },
    async assignMember(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/members`, data);
      return response.data;
    },
    async removeMember(outletId, memberId, options = {}) {
      const path = `/outlets/${encodeURIComponent(outletId)}/members/${encodeURIComponent(memberId)}`;
      const data = await (typeof request.delete === 'function'
        ? request.delete(path, options)
        : request.del(path, options));
      return data;
    },
  };
}
