/**
 * System monitoring and health API services
 */

import { apiClient, handleApiError } from '@/lib/api-client';
import { HealthResponse, ReadinessResponse, SystemMetrics, LogEntry } from '@/types';

export class SystemService {
  /**
   * Get system health status
   */
  static async getHealth(): Promise<HealthResponse> {
    try {
      const response = await apiClient.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get system readiness status
   */
  static async getReadiness(): Promise<ReadinessResponse> {
    try {
      const response = await apiClient.get<ReadinessResponse>('/ready');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get system metrics (this would be a custom endpoint)
   */
  static async getMetrics(timeRange?: { start: Date; end: Date }): Promise<SystemMetrics> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      // This would be a custom admin endpoint for metrics
      const response = await apiClient.get<SystemMetrics>('/admin/metrics', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get system logs with filtering
   */
  static async getLogs(params?: {
    page?: number;
    limit?: number;
    level?: string[];
    source?: string[];
    providerId?: string;
    timeRange?: { start: Date; end: Date };
    search?: string;
  }): Promise<{
    results: LogEntry[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  }> {
    try {
      const queryParams: any = {
        page: params?.page || 1,
        limit: params?.limit || 50,
      };

      if (params?.level?.length) {
        queryParams.level = params.level.join(',');
      }

      if (params?.source?.length) {
        queryParams.source = params.source.join(',');
      }

      if (params?.providerId) {
        queryParams.providerId = params.providerId;
      }

      if (params?.timeRange) {
        queryParams.start = params.timeRange.start.toISOString();
        queryParams.end = params.timeRange.end.toISOString();
      }

      if (params?.search) {
        queryParams.search = params.search;
      }

      // This would be a custom admin endpoint for logs
      const response = await apiClient.get('/admin/logs', { params: queryParams });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get real-time system status
   */
  static async getSystemStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    providers: Array<{
      id: string;
      name: string;
      status: 'healthy' | 'unhealthy' | 'unknown';
      lastChecked: string;
    }>;
    metrics: {
      requestsPerMinute: number;
      errorRate: number;
      averageLatency: number;
      uptime: number;
    };
  }> {
    try {
      // This would be a custom admin endpoint that aggregates health data
      const response = await apiClient.get('/admin/status');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get performance metrics over time
   */
  static async getPerformanceMetrics(
    metric: 'requests' | 'errors' | 'latency',
    timeRange: { start: Date; end: Date },
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<Array<{ timestamp: string; value: number }>> {
    try {
      const response = await apiClient.get('/admin/metrics/performance', {
        params: {
          metric,
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
          granularity,
        },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Export system data
   */
  static async exportData(
    type: 'logs' | 'metrics' | 'providers',
    format: 'json' | 'csv',
    filters?: any
  ): Promise<Blob> {
    try {
      const response = await apiClient.post(
        '/admin/export',
        { type, filters },
        {
          params: { format },
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Clear system cache
   */
  static async clearCache(): Promise<void> {
    try {
      await apiClient.post('/admin/cache/clear');
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Restart system services
   */
  static async restartServices(services?: string[]): Promise<void> {
    try {
      await apiClient.post('/admin/services/restart', { services });
    } catch (error) {
      throw handleApiError(error);
    }
  }
}