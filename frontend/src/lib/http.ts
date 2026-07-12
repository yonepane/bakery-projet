/// <reference types="vite/client" />
import axios from 'axios';

// When the app runs locally, requests go straight to the FastAPI server.
// When the app runs in production, requests use `/api` on the same domain.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const http = axios.create({
  baseURL: API_BASE
});

http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bakery_token');
    if (token) {
      // If the user is logged in, attach the saved token to the request.
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track whether a logout-redirect is already in flight so we never
// trigger multiple simultaneous reloads from parallel 401 responses.
let _isRedirecting = false;

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const isRetry = (error.config as any)?._isRefreshRetry;

    if (status === 401 && !_isRedirecting && !isRetry) {
      const refreshToken = localStorage.getItem('bakery_refresh_token');

      if (refreshToken) {
        try {
          // Attempt a silent token refresh using a plain axios call (not the
          // intercepted `http` instance) to avoid triggering another 401 loop.
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          // Persist the new access token and retry the original request.
          localStorage.setItem('bakery_token', data.access_token);
          const retryConfig = {
            ...error.config,
            _isRefreshRetry: true,
            headers: {
              ...error.config.headers,
              Authorization: `Bearer ${data.access_token}`,
            },
          };
          return http(retryConfig);
        } catch {
          // Refresh failed — fall through to hard logout below.
        }
      }

      // No refresh token available, or the refresh itself failed.
      // Clear everything and force the app back to the login screen.
      _isRedirecting = true;
      localStorage.removeItem('bakery_token');
      localStorage.removeItem('bakery_user');
      localStorage.removeItem('bakery_refresh_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default http;
