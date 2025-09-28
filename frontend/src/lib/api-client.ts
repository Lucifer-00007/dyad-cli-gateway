/**
 * Axios-based API client with authentication, CSRF protection, and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ErrorResponse } from '@/types';
import { enhanceApiError, reportError } from './error-handling';

import { config } from './config';

// API client configuration
const API_BASE_URL = config.apiBaseUrl;
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for HttpOnly refresh tokens
});

// Authentication manager
class AuthManager {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private tokenExpiresAt: number | null = null;

  setAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
  }

  getAccessToken(): string | null {
    if (!this.accessToken || this.isTokenExpired()) {
      return null;
    }
    return this.accessToken;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Add 30 second buffer before expiration
    return Date.now() >= (this.tokenExpiresAt - 30000);
  }

  async refreshToken(): Promise<string> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': this.getCSRFToken(),
          },
        }
      );

      const { accessToken, expiresIn } = response.data;
      this.setAccessToken(accessToken, expiresIn);
      return accessToken;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  getCSRFToken(): string {
    // Get CSRF token from meta tag or cookie
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;

    // Fallback to cookie
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));
    return csrfCookie ? csrfCookie.split('=')[1] : '';
  }
}

// Global auth manager instance
export const authManager = new AuthManager();

// Request interceptor for authentication and CSRF
apiClient.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    // Add access token if available
    let token = authManager.getAccessToken();
    
    // Auto-refresh expired tokens
    if (!token && config.url !== '/api/v1/auth/refresh') {
      try {
        token = await authManager.refreshToken();
      } catch (error) {
        // Redirect to login if refresh fails
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw error;
      }
    }

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing operations
    const isStateChanging = ['post', 'put', 'patch', 'delete'].includes(
      config.method?.toLowerCase() || ''
    );
    
    if (isStateChanging) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = authManager.getCSRFToken();
    }

    // Add API versioning header
    config.headers = config.headers || {};
    config.headers['X-API-Version'] = '1.0';

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = await authManager.refreshToken();
        
        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        
        return apiClient.request(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        authManager.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

// API error handling utilities
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly type: string;
  public readonly requestId?: string;

  constructor(error: AxiosError<ErrorResponse>) {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    
    super(message);
    
    this.name = 'ApiError';
    this.status = error.response?.status || 500;
    this.code = errorData?.code || 'unknown_error';
    this.type = errorData?.type || 'internal_error';
    this.requestId = errorData?.request_id;
  }
}

// Helper function to handle API errors consistently
export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (axios.isAxiosError(error)) {
    const apiError = new ApiError(error);
    
    // Enhance error with additional context and report it
    const enhancedError = enhanceApiError(error);
    reportError(enhancedError);
    
    return apiError;
  }
  
  // Fallback for non-axios errors
  const fallbackError = new ApiError({
    message: error instanceof Error ? error.message : 'Unknown error',
    response: {
      status: 500,
      data: {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'internal_error',
          code: 'unknown_error',
        },
      },
    },
  } as AxiosError<ErrorResponse>);
  
  // Enhance and report fallback error
  const enhancedError = enhanceApiError(error);
  reportError(enhancedError);
  
  return fallbackError;
};

// Request timeout configuration
export const createTimeoutConfig = (timeoutMs: number): AxiosRequestConfig => ({
  timeout: timeoutMs,
});

// Retry configuration for failed requests
export const createRetryConfig = (retries: number = 3, delay: number = 1000) => {
  return {
    retries,
    retryDelay: (retryCount: number) => {
      return Math.min(delay * Math.pow(2, retryCount), 10000); // Exponential backoff with max 10s
    },
    retryCondition: (error: AxiosError) => {
      // Retry on network errors or 5xx server errors
      return !error.response || (error.response.status >= 500 && error.response.status < 600);
    },
  };
};

// Helper for creating authenticated requests
export const createAuthenticatedRequest = async <T = unknown>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  return apiClient.request<T>(config);
};

// Helper for file uploads
export const createFileUploadRequest = async (
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<AxiosResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
};

// Helper for streaming requests
export const createStreamingRequest = async (
  url: string,
  data: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authManager.getAccessToken()}`,
      'X-CSRF-Token': authManager.getCSRFToken(),
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          onChunk(data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export default apiClient;