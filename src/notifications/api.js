// Notifikasi diturunkan dari data operasional backend (read-only).
export function createNotificationsApi({ request }) {
  return {
    async getNotifications(outletId) {
      const data = await request(
        `/api/v1/outlets/${encodeURIComponent(outletId)}/notifications`,
      );
      const payload = data?.data;
      if (!payload || !Array.isArray(payload.notifications)) {
        const error = new Error("Respons notifikasi dari server tidak sesuai kontrak.");
        error.code = "INVALID_RESPONSE";
        throw error;
      }
      return payload;
    },
  };
}
