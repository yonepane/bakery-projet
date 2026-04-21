import axios from 'axios';

const http = axios.create({
  baseURL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000/api' 
    : '/api'
});

http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bakery_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bakery_token');
      localStorage.removeItem('bakery_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default http;
