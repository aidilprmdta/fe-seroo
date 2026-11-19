import { createApiClient } from './api.js';

export function createExpensesApi({ request }) {
  return {
    async getExpenses(outletId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const path = query ? `/outlets/${outletId}/expenses?${query}` : `/outlets/${outletId}/expenses`;
      const data = await request.get(path);
      return data;
    },
    async getExpenseCategories() {
      const data = await request.get('/expense-categories');
      return data;
    },
    async createExpense(outletId, data) {
      const response = await request.post(`/outlets/${outletId}/expenses`, data);
      return response.data;
    },
    async editExpense(outletId, expenseId, data) {
    const response = await request.patch(`/outlets/${outletId}/expenses/${expenseId}`, data);
    return response.data;
    },
    async cancelExpense(outletId, expenseId, data) {
    const response = await request.post(`/outlets/${outletId}/expenses/${expenseId}/cancel`, data);
    return response.data;
    },
    async getExpenseAudit(outletId, expenseId) {
      const data = await request.get(`/outlets/${outletId}/expenses/${expenseId}/audit`);
      return data;
    },
  };
}
