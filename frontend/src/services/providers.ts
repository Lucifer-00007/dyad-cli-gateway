/**
 * Provider management API services
 */

import { apiClient, handleApiError } from '@/lib/api-client';
import {
  Provider,
  ProvidersListResponse,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderTestResponse,
  ProviderHealthResponse,
  ListProvidersParams,
} from '@/types';

export class ProvidersService {
  private static readonly BASE_PATH = '/admin/providers';

  /**
   * Get paginated list of providers with optional filtering
   */
  static async getProviders(params?: ListProvidersParams): Promise<ProvidersListResponse> {
    try {
      const response = await apiClient.get<ProvidersListResponse>(this.BASE_PATH, {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 10,
          ...(params?.enabled !== undefined && { enabled: params.enabled.toString() }),
          ...(params?.type && { type: params.type }),
        },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get a specific provider by ID
   */
  static async getProvider(id: string): Promise<Provider> {
    try {
      const response = await apiClient.get<Provider>(`${this.BASE_PATH}/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Create a new provider
   */
  static async createProvider(data: CreateProviderRequest): Promise<Provider> {
    try {
      const response = await apiClient.post<Provider>(this.BASE_PATH, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Update an existing provider
   */
  static async updateProvider(id: string, data: UpdateProviderRequest): Promise<Provider> {
    try {
      const response = await apiClient.patch<Provider>(`${this.BASE_PATH}/${id}`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Delete a provider
   */
  static async deleteProvider(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.BASE_PATH}/${id}`);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Test provider connectivity and configuration
   */
  static async testProvider(id: string, dryRun: boolean = false): Promise<ProviderTestResponse> {
    try {
      const response = await apiClient.post<ProviderTestResponse>(
        `${this.BASE_PATH}/${id}/test`,
        { dryRun }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Check provider health
   */
  static async checkProviderHealth(id: string): Promise<ProviderHealthResponse> {
    try {
      const response = await apiClient.post<ProviderHealthResponse>(
        `${this.BASE_PATH}/${id}/health`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Toggle provider enabled status
   */
  static async toggleProvider(id: string, enabled: boolean): Promise<Provider> {
    return this.updateProvider(id, { enabled });
  }

  /**
   * Bulk update providers
   */
  static async bulkUpdateProviders(
    ids: string[],
    updates: UpdateProviderRequest
  ): Promise<Provider[]> {
    try {
      const promises = ids.map(id => this.updateProvider(id, updates));
      return await Promise.all(promises);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Bulk delete providers
   */
  static async bulkDeleteProviders(ids: string[]): Promise<void> {
    try {
      const promises = ids.map(id => this.deleteProvider(id));
      await Promise.all(promises);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get provider statistics
   */
  static async getProviderStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    healthy: number;
    unhealthy: number;
    byType: Record<string, number>;
  }> {
    try {
      // This would be a custom endpoint, for now we'll derive from the list
      const response = await this.getProviders({ limit: 1000 });
      const providers = response.results;

      return {
        total: providers.length,
        enabled: providers.filter(p => p.enabled).length,
        disabled: providers.filter(p => !p.enabled).length,
        healthy: providers.filter(p => p.healthStatus?.status === 'healthy').length,
        unhealthy: providers.filter(p => p.healthStatus?.status === 'unhealthy').length,
        byType: providers.reduce((acc, provider) => {
          acc[provider.type] = (acc[provider.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }
}