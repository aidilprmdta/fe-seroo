export class CatalogAdminApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "CatalogAdminApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new CatalogAdminApiError(
    "INVALID_RESPONSE",
    502,
    "Respons katalog dari server tidak sesuai kontrak.",
  );
}

export function createCatalogAdminApi({ request }) {
  return {
    async getCatalog() {
      const path = `/api/v1/admin/catalog/products`;
      const data = await request(path);
      if (!data || !Array.isArray(data.products) || !Array.isArray(data.addOns)) {
        throw invalidResponse();
      }
      return data;
    },

    async createProduct(payload) {
      const path = `/api/v1/admin/catalog/products`;
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!data || !data.product) {
        throw invalidResponse();
      }
      return data;
    },

    async updateVariant(variantId, payload) {
      const path = `/api/v1/admin/catalog/variants/${encodeURIComponent(variantId)}`;
      const data = await request(path, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!data || !data.variant) {
        throw invalidResponse();
      }
      return data;
    },

    async createAddOn(payload) {
      const path = `/api/v1/admin/catalog/add-ons`;
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!data || !data.addOn) {
        throw invalidResponse();
      }
      return data;
    },
  };
}

