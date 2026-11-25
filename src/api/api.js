// Base API client for Seroo Mobile

function resolveBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) {
    if (
      (typeof __DEV__ !== "undefined" && __DEV__) ||
      process.env.NODE_ENV === "test" ||
      !process.env.NODE_ENV
    ) {
      return "http://localhost:3000/api/v1";
    }
    throw new Error(
      "EXPO_PUBLIC_API_URL belum dikonfigurasi. Pastikan variabel ini disertakan saat proses build."
    );
  }
  // Hapus trailing slash jika ada
  const cleanUrl = envUrl.replace(/\/+$/, '');
  // Pastikan suffix /api/v1 ada
  return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
}

const BASE_URL = resolveBaseUrl();

const TIMEOUT = 30000;

let authTokenProvider = () => null;
let activeSessionDelegate = null;

export function isPublicEndpoint(pathOrUrl = '') {
  if (typeof pathOrUrl !== 'string') return false;
  const clean = pathOrUrl.split('?')[0].split('#')[0];
  return /\/auth\/(login|refresh)$/i.test(clean) ||
         /\/(health|healthz|readyz)$/i.test(clean);
}

export function setSessionDelegate(delegate) {
  activeSessionDelegate = delegate;
}

export function getSessionDelegate() {
  return activeSessionDelegate;
}

export function clearSessionDelegate() {
  activeSessionDelegate = null;
  authTokenProvider = () => null;
}

export function setAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === 'function' ? provider : () => null;
}

export function getAuthToken() {
  try {
    return authTokenProvider();
  } catch {
    return null;
  }
}

async function resolveAccessToken(pathOrUrl = '', options = {}) {
  let path = pathOrUrl;
  let opts = options;
  if (typeof pathOrUrl === 'object' && pathOrUrl !== null) {
    opts = pathOrUrl;
    path = '';
  }
  if (opts.skipAuth || (path && isPublicEndpoint(path))) return null;
  if (activeSessionDelegate && typeof activeSessionDelegate.getAccessToken === 'function') {
    let token = activeSessionDelegate.getAccessToken();
    if (!token && typeof activeSessionDelegate.refreshAccessToken === 'function') {
      try {
        await activeSessionDelegate.refreshAccessToken();
        token = activeSessionDelegate.getAccessToken();
      } catch {
        // Biarkan request lanjut atau gagal dengan kode 401
      }
    }
    if (token) return token;
  }
  return getAuthToken();
}

export async function fetchText(path, options = {}, isRetry = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  const headers = {
    Accept: 'text/plain, text/csv, text/html',
    ...(options.headers || {}),
  };
  const token = await resolveAccessToken(path, options);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (
        response.status === 401 &&
        !isRetry &&
        !options.skipAuth &&
        !isPublicEndpoint(path) &&
        activeSessionDelegate
      ) {
        const currentToken = activeSessionDelegate.getAccessToken?.();
        if (currentToken && currentToken !== token) {
          clearTimeout(timeout);
          return fetchText(path, options, true);
        }
        if (typeof activeSessionDelegate.refreshAccessToken === 'function') {
          try {
            await activeSessionDelegate.refreshAccessToken();
            clearTimeout(timeout);
            return fetchText(path, options, true);
          } catch {
            if (typeof activeSessionDelegate.expireSession === 'function') {
              await activeSessionDelegate.expireSession().catch(() => {});
            }
          }
        }
      }

      let message = `Request failed with status ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.error?.message || message;
      } catch {
        // response bukan JSON
      }
      throw new ApiError(message, response.status, `HTTP_${response.status}`);
    }
    return await response.text();
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class ApiError extends Error {
  constructor(message, status = 0, code = 'UNKNOWN', data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(msg = 'Request Timeout') {
    super(msg, 0, 'TIMEOUT');
  }
}

async function fetchJson(url, options = {}, isRetry = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = await resolveAccessToken(url, options);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (
        response.status === 401 &&
        !isRetry &&
        !options.skipAuth &&
        !isPublicEndpoint(url) &&
        activeSessionDelegate
      ) {
        const currentToken = activeSessionDelegate.getAccessToken?.();
        if (currentToken && currentToken !== token) {
          return fetchJson(url, options, true);
        }
        if (typeof activeSessionDelegate.refreshAccessToken === 'function') {
          try {
            await activeSessionDelegate.refreshAccessToken();
            return fetchJson(url, options, true);
          } catch {
            if (typeof activeSessionDelegate.expireSession === 'function') {
              await activeSessionDelegate.expireSession().catch(() => {});
            }
          }
        }
      }

      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Server Error' };
      }
      const status = response.status;
      const code = errorData?.error?.code || errorData?.code || `HTTP_${status}`;
      const message = errorData?.error?.message || errorData?.message || `Request failed with status ${status}`;
      throw new ApiError(message, status, code, errorData);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiTimeoutError();
    }
    if (error instanceof TypeError || /Network request failed|Failed to fetch/i.test(error?.message || '')) {
      throw new ApiError(
        `Tidak dapat terhubung ke server (${url}). Periksa koneksi internet.`,
        0,
        'NETWORK_ERROR',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createApiClient({ baseUrl = BASE_URL } = {}) {
  const client = {
    async get(path, options = {}) {
      return fetchJson(`${baseUrl}${path}`, { ...options, method: 'GET' });
    },
    async post(path, body = null, options = {}) {
      return fetchJson(`${baseUrl}${path}`, {
        ...options,
        method: 'POST',
        body: body !== null ? JSON.stringify(body) : null,
      });
    },
    async put(path, body = null, options = {}) {
      return fetchJson(`${baseUrl}${path}`, {
        ...options,
        method: 'PUT',
        body: body !== null ? JSON.stringify(body) : null,
      });
    },
    async patch(path, body = null, options = {}) {
      return fetchJson(`${baseUrl}${path}`, {
        ...options,
        method: 'PATCH',
        body: body !== null ? JSON.stringify(body) : null,
      });
    },
    async del(path, options = {}) {
      return fetchJson(`${baseUrl}${path}`, { ...options, method: 'DELETE' });
    },
    async delete(path, options = {}) {
      return fetchJson(`${baseUrl}${path}`, { ...options, method: 'DELETE' });
    },
  };

  return client;
}

// Convert a request function (with built-in auto-refresh token) into
// the object shape expected by the API modules (createOrdersApi,
// createInventoryApi, createReportsApi, LossReportsApi, etc.).
export function createApiRequestWrapper(apiRequest) {
  return {
    async get(path, options = {}) {
      return apiRequest(path, { ...options, method: 'GET' });
    },
    async post(path, body = null, options = {}) {
      return apiRequest(
        path,
        { ...options, method: 'POST', body: body !== null ? JSON.stringify(body) : null },
      );
    },
    async patch(path, body = null, options = {}) {
      return apiRequest(
        path,
        { ...options, method: 'PATCH', body: body !== null ? JSON.stringify(body) : null },
      );
    },
    async del(path, options = {}) {
      return apiRequest(path, { ...options, method: 'DELETE' });
    },
  };
}

// Auth API
export class AuthApi {
  constructor(request) {
    this.request = request;
  }
  async login(email, password, deviceName) {
    const response = await this.request.post('/auth/login', {
      email, password, deviceName,
    });
    return response.data;
  }
  async refresh(refreshToken) {
    const response = await this.request.post('/auth/refresh', { refreshToken });
    return response.data;
  }
  async getMe() {
    const response = await this.request.get('/auth/me');
    return response.data;
  }
  async changePassword(currentPassword, newPassword) {
    const response = await this.request.post('/auth/change-password', {
      currentPassword, newPassword,
    });
    return response.data;
  }
  async logout(refreshToken) {
    const response = await this.request.post('/auth/logout', { refreshToken });
    return response.data;
  }
  async logoutAll() {
    const response = await this.request.post('/auth/logout-all');
    return response.data;
  }
}

// Dashboard API
export class DashboardApi {
  constructor(request) { this.request = request; }
  async getDashboard(outletId) {
    const response = await this.request.get(`/outlets/${outletId}/dashboard`);
    return response.data;
  }
}

// Catalog API
export class CatalogApi {
  constructor(request) { this.request = request; }
  async getCatalog(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/catalog?${query}` : `/outlets/${outletId}/catalog`;
    const response = await this.request.get(path);
    return response.data;
  }
  async getProducts(outletId) {
    const response = await this.request.get(`/outlets/${outletId}/catalog/products`);
    return response.data;
  }
  async getVariants(outletId, productId) {
    const response = await this.request.get(`/outlets/${outletId}/catalog/products/${productId}/variants`);
    return response.data;
  }
  async getProductAvailability(outletId) {
    const response = await this.request.get(`/outlets/${encodeURIComponent(outletId)}/catalog/products/availability`);
    return response?.data ?? response;
  }
  async setProductAvailability(outletId, productId, isAvailable) {
    const response = await this.request.patch(
      `/outlets/${encodeURIComponent(outletId)}/catalog/products/${encodeURIComponent(productId)}/availability`,
      { isAvailable },
    );
    return response?.data ?? response;
  }
}

// Orders API
export class OrdersApi {
  constructor(request) { this.request = request; }
  async createOrder(outletId, orderData) {
    const response = await this.request.post(`/outlets/${outletId}/orders`, orderData);
    return response.data;
  }
  async getOrder(outletId, orderId) {
    const response = await this.request.get(`/outlets/${outletId}/orders/${orderId}`);
    return response.data;
  }
  async listOrders(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/orders?${query}` : `/outlets/${outletId}/orders`;
    const response = await this.request.get(path);
    return response.data;
  }
  async verifyQris(outletId, orderId, verifiedById) {
    const response = await this.request.post(`/outlets/${outletId}/orders/${orderId}/verify-qris`, {
      verifiedById,
    });
    return response.data;
  }
  async cancelOrder(outletId, orderId, cancelData) {
    const response = await this.request.post(`/outlets/${outletId}/orders/${orderId}/cancel`, cancelData);
    return response.data;
  }
}

// Inventory API
export class InventoryApi {
  constructor(request) { this.request = request; }
  async getStock(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/stocks?${query}` : `/outlets/${outletId}/stocks`;
    const response = await this.request.get(path);
    return response.data;
  }
  async getStockMovements(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/stock-movements?${query}` : `/outlets/${outletId}/stock-movements`;
    const response = await this.request.get(path);
    return response.data;
  }
  async createStockReceipt(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/stock-movements`, data);
    return response.data;
  }
  async createStockAdjustment(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/stock-movements`, data);
    return response.data;
  }
}

// Stock Requests API
export class StockRequestsApi {
  constructor(request) { this.request = request; }
  async listRequests(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/stock-requests?${query}` : `/outlets/${outletId}/stock-requests`;
    const response = await this.request.get(path);
    return response.data;
  }
  async createRequest(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/stock-requests`, data);
    return response.data;
  }
  async processRequest(outletId, requestId, data) {
    const response = await this.request.patch(`/outlets/${outletId}/stock-requests/${requestId}`, data);
    return response.data;
  }
}

// Waste API
export class WasteApi {
  constructor(request) { this.request = request; }
  async listWaste(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/waste?${query}` : `/outlets/${outletId}/waste`;
    const response = await this.request.get(path);
    return response.data;
  }
  async createWaste(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/waste`, data);
    return response.data;
  }
}

// Expenses API
export class ExpensesApi {
  constructor(request) { this.request = request; }
  async getExpenses(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/expenses?${query}` : `/outlets/${outletId}/expenses`;
    const response = await this.request.get(path);
    return response.data;
  }
  async getExpenseCategories() {
    const response = await this.request.get('/expense-categories');
    return response.data;
  }
  async createExpense(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/expenses`, data);
    return response.data;
  }
  async editExpense(outletId, expenseId, data) {
    const response = await this.request.patch(`/outlets/${outletId}/expenses/${expenseId}`, data);
    return response.data;
  }
  async cancelExpense(outletId, expenseId, data) {
    const response = await this.request.post(`/outlets/${outletId}/expenses/${expenseId}/cancel`, data);
    return response.data;
  }
  async getExpenseAudit(outletId, expenseId) {
    const response = await this.request.get(`/outlets/${outletId}/expenses/${expenseId}/audit`);
    return response.data;
  }
}

// Closings API
export class ClosingsApi {
  constructor(request) { this.request = request; }
  async listClosings(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/closings?${query}` : `/outlets/${outletId}/closings`;
    const response = await this.request.get(path);
    return response.data;
  }
  async createClosing(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/closings`, data);
    return response.data;
  }
  async reopenClosing(outletId, closingId, data) {
    const response = await this.request.post(`/outlets/${outletId}/closings/reopen`, data);
    return response.data;
  }
  async getCashOpening(outletId, periodKey) {
    const response = await this.request.get(`/outlets/${outletId}/cash-openings/${periodKey}`);
    return response.data;
  }
  async createCashOpening(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/cash-openings`, data);
    return response.data;
  }
}

// Reports API
export class ReportsApi {
  constructor(request) { this.request = request; }
  async getDailyReport(outletId, date) {
    const response = await this.request.get(`/outlets/${outletId}/reports/daily?date=${date}`);
    return response.data;
  }
  async getMonthlyReport(outletId, month, year) {
    const response = await this.request.get(`/outlets/${outletId}/reports/monthly?month=${month}&year=${year}`);
    return response.data;
  }
  async exportReport(outletId, type, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/reports/export?type=${type}&${query}` : `/reports/export?type=${type}`;
    const response = await this.request.get(path, { responseType: 'blob' });
    return response.data;
  }
}

// Outlets API
export class OutletsApi {
  constructor(request) { this.request = request; }
  async listOutlets() {
    const response = await this.request.get('/outlets');
    return response.data;
  }
  async getOutlet(outletId) {
    const response = await this.request.get(`/outlets/${outletId}`);
    return response.data;
  }
  async getMembers(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/outlets/${outletId}/members?${query}` : `/outlets/${outletId}/members`;
    const response = await this.request.get(path);
    return response.data;
  }
  async assignMember(outletId, data) {
    const response = await this.request.post(`/outlets/${outletId}/members`, data);
    return response.data;
  }
  async removeMember(outletId, memberId, options = {}) {
    const path = `/outlets/${encodeURIComponent(outletId)}/members/${encodeURIComponent(memberId)}`;
    const response = await (typeof this.request.delete === 'function'
      ? this.request.delete(path, options)
      : this.request.del(path, options));
    return response?.data || response;
  }
}

// Admin API (Admin Pusat only)
export class AdminApi {
  constructor(request) { this.request = request; }
  async listAccounts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/admin/accounts?${query}` : `/admin/accounts`;
    const response = await this.request.get(path);
    return response.data;
  }
  async listOutlets() {
    const response = await this.request.get('/admin/outlets');
    return response.data;
  }
  async createAccount(data) {
    const response = await this.request.post('/admin/accounts', data);
    return response.data;
  }
  async updateAccountStatus(userId, data) {
    const response = await this.request.patch(`/admin/accounts/${userId}/status`, data);
    return response.data;
  }
  async resetAccountPassword(userId) {
    const response = await this.request.post(`/admin/accounts/${userId}/reset-password`);
    return response.data;
  }
}

// Loss Reports API
export class LossReportsApi {
  constructor(request) { this.request = request; }
  async listLossReports(outletId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query
      ? `/outlets/${encodeURIComponent(outletId)}/loss-reports?${query}`
      : `/outlets/${encodeURIComponent(outletId)}/loss-reports`;
    const response = await this.request.get(path);
    return response?.data ?? response;
  }
  async createLossReport(outletId, data) {
    const response = await this.request.post(
      `/outlets/${encodeURIComponent(outletId)}/loss-reports`,
      data,
    );
    return response?.data ?? response;
  }
  async reviewLossReport(outletId, reportId, data) {
    const response = await this.request.patch(
      `/outlets/${encodeURIComponent(outletId)}/loss-reports/${encodeURIComponent(reportId)}/review`,
      data,
    );
    return response?.data ?? response;
  }
}
