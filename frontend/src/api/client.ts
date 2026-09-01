import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE_URL = rawApiUrl.replace(/\/$/, '').endsWith('/api/v1')
  ? rawApiUrl.replace(/\/$/, '')
  : `${rawApiUrl.replace(/\/$/, '')}/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// 1. Request Interceptor: Attach Bearer Token & Correlation ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Request-ID'] = `web-${Math.random().toString(36).substring(2, 10)}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Token Refresh & Error Normalization
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Auto-refresh token on 401 Unauthorized
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = response.data?.data?.access_token;
        const newRefreshToken = response.data?.data?.refresh_token;

        if (newAccessToken) {
          useAuthStore.getState().setTokens({
            access_token: newAccessToken,
            refresh_token: newRefreshToken || refreshToken,
          });

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr as AxiosError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
