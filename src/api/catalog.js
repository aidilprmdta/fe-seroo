import { createApiClient } from './api.js';

export function createCatalogApi({ request }) {
  return {
    async getCatalog(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/catalog?${query}` : `/outlets/${outletId}/catalog`;
      const data = await request.get(path);
      return data;
    },
    async getProducts(outletId) {
      const data = await request.get(`/outlets/${outletId}/catalog/products`);
      return data;
    },
    async getVariants(outletId, productId) {
      const data = await request.get(`/outlets/${outletId}/catalog/products/${productId}/variants`);
      return data;
    },
    async getAdminProducts() {
      const data = await request.get('/admin/catalog/products');
      return data;
    },
    async createProduct(payload) {
      const response = await request.post('/admin/catalog/products', payload);
      return response?.data?.product ?? response?.data ?? response;
    },
    async updateProduct(productId, payload) {
      const response = await request.patch(`/admin/catalog/products/${productId}`, payload);
      return response?.data?.product ?? response?.data ?? response;
    },
    async createVariant(productId, payload) {
      const response = await request.post('/admin/catalog/variants', {
        productId,
        ...payload,
      });
      return response?.data?.variant ?? response?.data ?? response;
    },
    async updateVariant(variantId, payload) {
      const response = await request.patch(`/admin/catalog/variants/${variantId}`, payload);
      return response?.data?.variant ?? response?.data ?? response;
    },
    async createAddOn(payload) {
      const response = await request.post('/admin/catalog/add-ons', payload);
      return response?.data?.addOn ?? response?.data ?? response;
    },
    async updateAddOn(addOnId, payload) {
      const response = await request.patch(`/admin/catalog/add-ons/${addOnId}`, payload);
      return response?.data?.addOn ?? response?.data ?? response;
    },
    async getProductAvailability(outletId) {
      const response = await request.get(`/outlets/${encodeURIComponent(outletId)}/catalog/products/availability`);
      return response?.data ?? response;
    },
    async setProductAvailability(outletId, productId, isAvailable) {
      const response = await request.patch(
        `/outlets/${encodeURIComponent(outletId)}/catalog/products/${encodeURIComponent(productId)}/availability`,
        { isAvailable },
      );
      return response?.data ?? response;
    },
  };
}
