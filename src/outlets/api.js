export class OutletAccessApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "OutletAccessApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new OutletAccessApiError(
    "INVALID_RESPONSE",
    502,
    "Respons data anggota outlet dari server tidak sesuai kontrak.",
  );
}

export function createOutletAccessApi({ request }) {
  return {
    async getMembers(outletId) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/members`;
      const data = await request(path);
      if (!data || !Array.isArray(data.members)) {
        throw invalidResponse();
      }
      return data;
    },

    async assignMember(outletId, { email, userId, role }) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/members`;
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify({ email, userId, role }),
      });
      if (!data || !data.membership) {
        throw invalidResponse();
      }
      return data;
    },

    async revokeMember(outletId, userId) {
      const path = `/api/v1/outlets/${encodeURIComponent(outletId)}/members/${encodeURIComponent(userId)}`;
      const data = await request(path, {
        method: "DELETE",
      });
      return data;
    },
  };
}

