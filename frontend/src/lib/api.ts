import axios from 'axios';

// Get API base URL from Vite environment variable or default to local backend port 8001
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Generate & attach correlation ID
apiClient.interceptors.request.use((config) => {
  const requestId = `web-${Math.random().toString(36).substring(2, 10)}`;
  config.headers['X-Request-ID'] = requestId;
  return config;
});

// Response interceptor: Extract structured errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.error) {
      console.warn('[API Error Response]:', error.response.data.error);
    }
    return Promise.reject(error);
  }
);
