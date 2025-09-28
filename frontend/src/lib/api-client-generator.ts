/**
 * API client generator utilities for OpenAPI specification
 * This provides type-safe API clients generated from the OpenAPI spec
 */

import { apiClient, handleApiError } from './api-client';
import type { AxiosRequestConfig } from 'axios';

// Base API client interface
export interface ApiClientMethod<TRequest = any, TResponse = any> {
  (data?: TRequest, config?: AxiosRequestConfig): Promise<TResponse>;
}

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// API endpoint configuration
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  authenticated?: boolean;
  timeout?: number;
}

// Generated API client configuration
export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Create a typed API method from endpoint configuration
 */
export function createApiMethod<TRequest = any, TResponse = any>(
  endpoint: ApiEndpoint,
  config?: ApiClientConfig
): ApiClientMethod<TRequest, TResponse> {
  return async (data?: TRequest, requestConfig?: AxiosRequestConfig): Promise<TResponse> => {
    try {
      const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      
      // Build request configuration
      const axiosConfig: AxiosRequestConfig = {
        ...requestConfig,
        timeout: endpoint.timeout || config?.timeout,
        headers: {
          ...config?.headers,
          ...requestConfig?.headers,
        },
      };

      // Handle different HTTP methods
      let response;
      switch (method) {
        case 'get':
        case 'delete':
          response = await apiClient[method](endpoint.path, {
            ...axiosConfig,
            params: data,
          });
          break;
        case 'post':
        case 'put':
        case 'patch':
          response = await apiClient[method](endpoint.path, data, axiosConfig);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${endpoint.method}`);
      }

      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  };
}

/**
 * Generate API client from OpenAPI paths
 */
export class ApiClientGenerator {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig = {}) {
    this.config = config;
  }

  /**
   * Create admin API client with all endpoints
   */
  createAdminClient() {
    return {
      // Provider endpoints
      providers: {
        list: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/providers',
          authenticated: true,
        }, this.config),
        
        get: createApiMethod<{ id: string }, any>({
          method: 'GET',
          path: '/admin/providers/{id}',
          authenticated: true,
        }, this.config),
        
        create: createApiMethod<any, any>({
          method: 'POST',
          path: '/admin/providers',
          authenticated: true,
        }, this.config),
        
        update: createApiMethod<{ id: string; data: any }, any>({
          method: 'PATCH',
          path: '/admin/providers/{id}',
          authenticated: true,
        }, this.config),
        
        delete: createApiMethod<{ id: string }, void>({
          method: 'DELETE',
          path: '/admin/providers/{id}',
          authenticated: true,
        }, this.config),
        
        test: createApiMethod<{ id: string; dryRun?: boolean }, any>({
          method: 'POST',
          path: '/admin/providers/{id}/test',
          authenticated: true,
        }, this.config),
        
        health: createApiMethod<{ id: string }, any>({
          method: 'POST',
          path: '/admin/providers/{id}/health',
          authenticated: true,
        }, this.config),
      },

      // API Key endpoints
      apiKeys: {
        list: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/api-keys',
          authenticated: true,
        }, this.config),
        
        get: createApiMethod<{ id: string }, any>({
          method: 'GET',
          path: '/admin/api-keys/{id}',
          authenticated: true,
        }, this.config),
        
        create: createApiMethod<any, any>({
          method: 'POST',
          path: '/admin/api-keys',
          authenticated: true,
        }, this.config),
        
        update: createApiMethod<{ id: string; data: any }, any>({
          method: 'PATCH',
          path: '/admin/api-keys/{id}',
          authenticated: true,
        }, this.config),
        
        delete: createApiMethod<{ id: string }, void>({
          method: 'DELETE',
          path: '/admin/api-keys/{id}',
          authenticated: true,
        }, this.config),
        
        revoke: createApiMethod<{ id: string }, any>({
          method: 'POST',
          path: '/admin/api-keys/{id}/revoke',
          authenticated: true,
        }, this.config),
        
        regenerate: createApiMethod<{ id: string }, any>({
          method: 'POST',
          path: '/admin/api-keys/{id}/regenerate',
          authenticated: true,
        }, this.config),
        
        usage: createApiMethod<{ id: string; timeRange?: any }, any>({
          method: 'GET',
          path: '/admin/api-keys/{id}/usage',
          authenticated: true,
        }, this.config),
      },

      // Metrics endpoints
      metrics: {
        system: createApiMethod<{ timeRange?: any }, any>({
          method: 'GET',
          path: '/admin/metrics',
          authenticated: true,
        }, this.config),
        
        timeseries: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/metrics/timeseries',
          authenticated: true,
        }, this.config),
        
        providers: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/metrics/providers',
          authenticated: true,
        }, this.config),
        
        models: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/metrics/models',
          authenticated: true,
        }, this.config),
        
        errors: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/metrics/errors',
          authenticated: true,
        }, this.config),
        
        realtime: createApiMethod<void, any>({
          method: 'GET',
          path: '/admin/metrics/realtime',
          authenticated: true,
        }, this.config),
        
        export: createApiMethod<any, Blob>({
          method: 'GET',
          path: '/admin/metrics/export/{type}',
          authenticated: true,
        }, this.config),
      },

      // System endpoints
      system: {
        health: createApiMethod<void, any>({
          method: 'GET',
          path: '/health',
          authenticated: false,
        }, this.config),
        
        readiness: createApiMethod<void, any>({
          method: 'GET',
          path: '/ready',
          authenticated: false,
        }, this.config),
        
        status: createApiMethod<void, any>({
          method: 'GET',
          path: '/admin/status',
          authenticated: true,
        }, this.config),
        
        logs: createApiMethod<any, any>({
          method: 'GET',
          path: '/admin/logs',
          authenticated: true,
        }, this.config),
        
        export: createApiMethod<any, Blob>({
          method: 'POST',
          path: '/admin/export',
          authenticated: true,
        }, this.config),
        
        clearCache: createApiMethod<void, void>({
          method: 'POST',
          path: '/admin/cache/clear',
          authenticated: true,
        }, this.config),
        
        restartServices: createApiMethod<{ services?: string[] }, void>({
          method: 'POST',
          path: '/admin/services/restart',
          authenticated: true,
        }, this.config),
      },
    };
  }

  /**
   * Create OpenAI v1 compatible client
   */
  createV1Client() {
    return {
      models: {
        list: createApiMethod<void, any>({
          method: 'GET',
          path: '/v1/models',
          authenticated: true,
        }, this.config),
      },

      chat: {
        completions: createApiMethod<any, any>({
          method: 'POST',
          path: '/v1/chat/completions',
          authenticated: true,
        }, this.config),
      },

      embeddings: {
        create: createApiMethod<any, any>({
          method: 'POST',
          path: '/v1/embeddings',
          authenticated: true,
        }, this.config),
      },
    };
  }

  /**
   * Create path parameter replacer
   */
  private replacePath(path: string, params: Record<string, string>): string {
    let result = path;
    Object.entries(params).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, encodeURIComponent(value));
    });
    return result;
  }
}

// Global API client instances
export const adminApiClient = new ApiClientGenerator().createAdminClient();
export const v1ApiClient = new ApiClientGenerator().createV1Client();

// Type-safe API client factory
export const createTypedApiClient = (config?: ApiClientConfig) => {
  const generator = new ApiClientGenerator(config);
  return {
    admin: generator.createAdminClient(),
    v1: generator.createV1Client(),
  };
};

// Request/Response interceptor utilities
export const createRequestInterceptor = (
  onRequest?: (config: AxiosRequestConfig) => AxiosRequestConfig,
  onError?: (error: any) => Promise<any>
) => {
  return apiClient.interceptors.request.use(onRequest, onError);
};

export const createResponseInterceptor = (
  onResponse?: (response: any) => any,
  onError?: (error: any) => Promise<any>
) => {
  return apiClient.interceptors.response.use(onResponse, onError);
};

// Batch request utilities
export interface BatchRequest {
  id: string;
  method: HttpMethod;
  path: string;
  data?: any;
  params?: any;
}

export interface BatchResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: any;
}

export const executeBatchRequests = async (
  requests: BatchRequest[]
): Promise<BatchResponse[]> => {
  const promises = requests.map(async (request): Promise<BatchResponse> => {
    try {
      const method = createApiMethod({
        method: request.method,
        path: request.path,
      });
      
      const data = await method(request.data || request.params);
      
      return {
        id: request.id,
        success: true,
        data,
      };
    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: handleApiError(error),
      };
    }
  });

  return Promise.all(promises);
};