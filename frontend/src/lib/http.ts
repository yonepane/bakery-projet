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
  (error) => {
    if (error.response?.status === 401 && !_isRedirecting) {
      // If the server rejects the token, the saved login is no longer valid.
      // Clear it and force the app back to the login screen.
      _isRedirecting = true;
      localStorage.removeItem('bakery_token');
      localStorage.removeItem('bakery_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default http;
