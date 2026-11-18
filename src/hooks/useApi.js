// Custom hook for API state management
import { useState, useCallback } from 'react';
import { ApiError, ApiTimeoutError } from '../api/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const request = useCallback(async (fn, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      setData(result);
      return result;
    } catch (err) {
      if (err instanceof ApiTimeoutError) {
        setError(new ApiError('Request timed out. Please try again.', 0, 'TIMEOUT'));
      } else if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError('Something went wrong. Please try again.', 0, 'UNKNOWN', err.message));
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    data,
    request,
    clearError,
    setLoading,
    setError,
    setData,
  };
}

// Hook for authentication state
import { useContext, useEffect } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { AuthApi } from '../api/api';
import * as SecureStore from 'expo-secure-store';

export function useAuth2() {
  const { user, session, status, login, logout, refreshToken, setSession } = useContext(AuthContext);
  const [api, setApi] = useState(null);

  const initApi = useCallback(() => {
    if (!session?.accessToken) return null;
    const client = createApiClient();
    const authApi = new AuthApi(client);
    return authApi;
  }, [session]);

  useEffect(() => {
    setApi(initApi());
  }, [session, initApi]);

  return {
    user,
    session,
    status,
    login,
    logout,
    refreshToken,
    setSession,
    api: api,
    isAuthenticated: status === 'authenticated',
  };
}
