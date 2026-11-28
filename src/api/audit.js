export function createAuditApi({ request }) {
  return {
    async listOutletAuditLogs(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query
        ? `/outlets/${encodeURIComponent(outletId)}/audit-logs?${query}`
        : `/outlets/${encodeURIComponent(outletId)}/audit-logs`;
      const data = await request.get(path);
      return data;
    },
  };
}
