/**
 * API Key management services
 */

import { apiClient, handleApiError } from '@/lib/api-client';
import {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  PaginationParams,
} from '@/types';

export interface ListApiKeysParams extends PaginationParams {
  enabled?: boolean;
  search?: string;
}

export interface ApiKeyUsageStats {
  keyId: string;
  requestsToday: number;
  tokensToday: number;
  requestsThisMonth: number;
  tokensThisMonth: number;
  lastUsed?: string;
}

export class ApiKeysService {
  private static readonly BASE_PATH = '/admin/api-keys';

  /**
   * Get paginated list of API keys
   */
  static async getApiKeys(params?: ListApiKeysParams): Promise<{
    results: ApiKey[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  }> {
    try {
      const response = await apiClient.get(this.BASE_PATH, {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 10,
          ...(params?.enabled !== undefined && { enabled: params.enabled.toString() }),
          ...(params?.search && { search: params.search }),
        },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get a specific API key by ID
   */
  static async getApiKey(id: string): Promise<ApiKey> {
    try {
      const response = await apiClient.get<ApiKey>(`${this.BASE_PATH}/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Create a new API key
   */
  static async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    try {
      const response = await apiClient.post<CreateApiKeyResponse>(this.BASE_PATH, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Update an existing API key
   */
  static async updateApiKey(id: string, data: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    try {
      const response = await apiClient.patch<ApiKey>(`${this.BASE_PATH}/${id}`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Delete an API key
   */
  static async deleteApiKey(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.BASE_PATH}/${id}`);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Revoke an API key (disable it)
   */
  static async revokeApiKey(id: string): Promise<ApiKey> {
    try {
      const response = await apiClient.post<ApiKey>(`${this.BASE_PATH}/${id}/revoke`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Regenerate an API key
   */
  static async regenerateApiKey(id: string): Promise<CreateApiKeyResponse> {
    try {
      const response = await apiClient.post<CreateApiKeyResponse>(`${this.BASE_PATH}/${id}/regenerate`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get API key usage statistics
   */
  static async getApiKeyUsage(id: string, timeRange?: { start: Date; end: Date }): Promise<ApiKeyUsageStats> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get<ApiKeyUsageStats>(`${this.BASE_PATH}/${id}/usage`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get usage statistics for all API keys
   */
  static async getAllApiKeyUsage(timeRange?: { start: Date; end: Date }): Promise<ApiKeyUsageStats[]> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get<ApiKeyUsageStats[]>(`${this.BASE_PATH}/usage`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Bulk update API keys
   */
  static async bulkUpdateApiKeys(
    ids: string[],
    updates: Partial<CreateApiKeyRequest>
  ): Promise<ApiKey[]> {
    try {
      const response = await apiClient.patch<ApiKey[]>(`${this.BASE_PATH}/bulk`, {
        ids,
        updates,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Bulk delete API keys
   */
  static async bulkDeleteApiKeys(ids: string[]): Promise<void> {
    try {
      await apiClient.delete(`${this.BASE_PATH}/bulk`, {
        data: { ids },
      });
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get API key statistics
   */
  static async getApiKeyStats(): Promise<{
    total: number;
    active: number;
    revoked: number;
    totalRequestsToday: number;
    totalTokensToday: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/stats`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Test API key validity
   */
  static async testApiKey(id: string): Promise<{
    valid: boolean;
    permissions: string[];
    rateLimits: {
      requestsRemaining: number;
      tokensRemaining: number;
      resetTime: string;
    };
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/${id}/test`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}