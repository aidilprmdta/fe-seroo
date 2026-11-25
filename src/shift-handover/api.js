// Shift handover API client — backend: backend/src/shift-handover/routes.js
// POST /:outletId/request, GET /:outletId/requests, PATCH /:outletId/requests/:handoverId

function assertRequests(data) {
  const handovers = data?.data?.handovers;
  if (!Array.isArray(handovers)) {
    const error = new Error("Respons serah terima dari server tidak sesuai kontrak.");
    error.code = "INVALID_RESPONSE";
    throw error;
  }
  return handovers;
}

export function createShiftHandoverApi({ request }) {
  const outletPath = (outletId) =>
    `/api/v1/outlets/${encodeURIComponent(outletId)}`;

  return {
    async requestHandover(outletId, payload) {
      return request(`${outletPath(outletId)}/request`, {
        method: "POST",
        body: payload,
      });
    },

    async listPending(outletId) {
      return assertRequests(
        await request(`${outletPath(outletId)}/requests?status=PENDING`),
      );
    },

    async decide(outletId, handoverId, payload) {
      return request(
        `${outletPath(outletId)}/requests/${encodeURIComponent(handoverId)}`,
        { method: "PATCH", body: payload },
      );
    },
  };
}
