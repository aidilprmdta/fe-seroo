export class RecipeApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "RecipeApiError";
    this.code = code;
    this.status = status;
  }
}

function invalidResponse() {
  return new RecipeApiError(
    "INVALID_RESPONSE",
    502,
    "Respons data resep dari server tidak sesuai kontrak.",
  );
}

export function createRecipeApi({ request }) {
  return {
    async listIngredients() {
      const res = await request("/api/v1/recipes/ingredients");
      if (!res || !Array.isArray(res.ingredients)) {
        throw invalidResponse();
      }
      return res.ingredients;
    },

    async listRecipes({ productId, productVariantId } = {}) {
      const params = new URLSearchParams();
      if (productId) params.append("productId", productId);
      if (productVariantId) params.append("productVariantId", productVariantId);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await request(`/api/v1/recipes${query}`);
      if (!res || !Array.isArray(res.recipes)) {
        throw invalidResponse();
      }
      return res.recipes;
    },

    async getVariantRecipe(variantId) {
      const res = await request(`/api/v1/recipes/variants/${encodeURIComponent(variantId)}`);
      if (!res || !Array.isArray(res.items)) {
        throw invalidResponse();
      }
      return res;
    },

    async setVariantRecipe(variantId, items) {
      const res = await request(
        `/api/v1/recipes/variants/${encodeURIComponent(variantId)}`,
        {
          method: "PUT",
          body: { items },
        },
      );
      if (!res || !Array.isArray(res.items)) {
        throw invalidResponse();
      }
      return res;
    },

    async createOrUpdateRecipe(item) {
      const res = await request("/api/v1/recipes", {
        method: "POST",
        body: item,
      });
      if (!res || !res.recipe) {
        throw invalidResponse();
      }
      return res.recipe;
    },

    async deleteRecipe(id) {
      const res = await request(`/api/v1/recipes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return res;
    },
  };
}

