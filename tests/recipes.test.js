import assert from "node:assert/strict";
import test from "node:test";
import { createRecipeApi, RecipeApiError } from "../src/recipes/api.js";

test("recipe API listRecipes and getVariantRecipe validate response contracts", async () => {
  const calls = [];
  const api = createRecipeApi({
    request: async (path, options) => {
      calls.push({ path, options });
      if (path.startsWith("/api/v1/recipes/variants/")) {
        return {
          productVariantId: "var-1",
          productName: "Teh Tarik",
          variantName: "Medium",
          variantPrice: "15000.00",
          items: [
            {
              id: "rec-1",
              inventoryItemId: "item-tea",
              ingredientName: "Bubuk Teh",
              quantity: "15.000",
              unit: "gram",
            },
          ],
        };
      }
      return {
        recipes: [
          {
            id: "rec-1",
            productVariantId: "var-1",
            productName: "Teh Tarik",
            variantName: "Medium",
            ingredientName: "Bubuk Teh",
            quantity: "15.000",
            unit: "gram",
          },
        ],
      };
    },
  });

  const list = await api.listRecipes({ productId: "prod-1" });
  assert.equal(calls[0].path, "/api/v1/recipes?productId=prod-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].productName, "Teh Tarik");
  assert.equal(list[0].ingredientName, "Bubuk Teh");
  assert.equal(list[0].quantity, "15.000");
  assert.equal(list[0].unit, "gram");

  const detail = await api.getVariantRecipe("var-1");
  assert.equal(calls[1].path, "/api/v1/recipes/variants/var-1");
  assert.equal(detail.items.length, 1);
  assert.equal(detail.items[0].unit, "gram");
});

test("recipe API setVariantRecipe encodes variantId and sends body", async () => {
  const calls = [];
  const api = createRecipeApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        productVariantId: "var / 1",
        items: [
          {
            id: "rec-1",
            inventoryItemId: "item-tea",
            ingredientName: "Bubuk Teh",
            quantity: "15.000",
            unit: "gram",
          },
        ],
      };
    },
  });

  const res = await api.setVariantRecipe("var / 1", [
    { inventoryItemId: "item-tea", quantity: "15.000" },
  ]);

  assert.equal(calls[0].path, "/api/v1/recipes/variants/var%20%2F%201");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.body.items.length, 1);
  assert.equal(res.items.length, 1);
});

test("recipe API rejects malformed server response", async () => {
  const api = createRecipeApi({
    request: async () => ({ unexpected: true }),
  });

  await assert.rejects(api.listRecipes(), RecipeApiError);
  await assert.rejects(api.getVariantRecipe("var-1"), RecipeApiError);
});

