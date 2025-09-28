/**
 * Metrics and analytics API services
 */

import { apiClient, handleApiError } from '@/lib/api-client';
import { MetricDataPoint } from '@/types';

export interface MetricsTimeRange {
  start: Date;
  end: Date;
}

export interface SystemMetricsResponse {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  requestsPerMinute: number;
  tokensProcessed: number;
  activeProviders: number;
  uptime: number;
  timestamp: string;
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  errorRate: number;
  tokensProcessed: number;
  lastRequest?: string;
}

export interface ModelMetrics {
  modelId: string;
  providerId: string;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  tokensProcessed: number;
  averageTokensPerRequest: number;
}

export interface ErrorMetrics {
  errorType: string;
  errorCode: string;
  count: number;
  percentage: number;
  lastOccurrence: string;
  affectedProviders: string[];
}

export class MetricsService {
  private static readonly BASE_PATH = '/admin/metrics';

  /**
   * Get current system metrics
   */
  static async getSystemMetrics(timeRange?: MetricsTimeRange): Promise<SystemMetricsResponse> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get<SystemMetricsResponse>(this.BASE_PATH, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get time-series metrics data
   */
  static async getTimeSeriesMetrics(
    metric: 'requests' | 'errors' | 'latency' | 'tokens',
    timeRange: MetricsTimeRange,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<MetricDataPoint[]> {
    try {
      const response = await apiClient.get<MetricDataPoint[]>(`${this.BASE_PATH}/timeseries`, {
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
   * Get provider-specific metrics
   */
  static async getProviderMetrics(
    providerId?: string,
    timeRange?: MetricsTimeRange
  ): Promise<ProviderMetrics[]> {
    try {
      const params: any = {};
      
      if (providerId) {
        params.providerId = providerId;
      }
      
      if (timeRange) {
        params.start = timeRange.start.toISOString();
        params.end = timeRange.end.toISOString();
      }

      const response = await apiClient.get<ProviderMetrics[]>(`${this.BASE_PATH}/providers`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get model-specific metrics
   */
  static async getModelMetrics(
    modelId?: string,
    timeRange?: MetricsTimeRange
  ): Promise<ModelMetrics[]> {
    try {
      const params: any = {};
      
      if (modelId) {
        params.modelId = modelId;
      }
      
      if (timeRange) {
        params.start = timeRange.start.toISOString();
        params.end = timeRange.end.toISOString();
      }

      const response = await apiClient.get<ModelMetrics[]>(`${this.BASE_PATH}/models`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get error metrics and analysis
   */
  static async getErrorMetrics(timeRange?: MetricsTimeRange): Promise<ErrorMetrics[]> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get<ErrorMetrics[]>(`${this.BASE_PATH}/errors`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get real-time metrics (for dashboard)
   */
  static async getRealTimeMetrics(): Promise<{
    currentRPS: number;
    currentLatency: number;
    currentErrorRate: number;
    activeConnections: number;
    queueSize: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/realtime`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get performance percentiles
   */
  static async getPerformancePercentiles(
    timeRange?: MetricsTimeRange
  ): Promise<{
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
  }> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get(`${this.BASE_PATH}/percentiles`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get usage trends
   */
  static async getUsageTrends(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    requestsTrend: number; // percentage change
    errorRateTrend: number;
    latencyTrend: number;
    tokensTrend: number;
    period: string;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/trends`, {
        params: { period },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get top performing models
   */
  static async getTopModels(
    limit: number = 10,
    sortBy: 'requests' | 'tokens' | 'latency' = 'requests',
    timeRange?: MetricsTimeRange
  ): Promise<ModelMetrics[]> {
    try {
      const params: any = { limit, sortBy };
      
      if (timeRange) {
        params.start = timeRange.start.toISOString();
        params.end = timeRange.end.toISOString();
      }

      const response = await apiClient.get<ModelMetrics[]>(`${this.BASE_PATH}/top-models`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get cost analysis (if cost tracking is enabled)
   */
  static async getCostAnalysis(timeRange?: MetricsTimeRange): Promise<{
    totalCost: number;
    costByProvider: Array<{ providerId: string; providerName: string; cost: number }>;
    costByModel: Array<{ modelId: string; cost: number }>;
    costTrend: MetricDataPoint[];
  }> {
    try {
      const params = timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : {};

      const response = await apiClient.get(`${this.BASE_PATH}/costs`, { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Export metrics data
   */
  static async exportMetrics(
    type: 'system' | 'providers' | 'models' | 'errors',
    format: 'json' | 'csv',
    timeRange?: MetricsTimeRange
  ): Promise<Blob> {
    try {
      const params: any = { format };
      
      if (timeRange) {
        params.start = timeRange.start.toISOString();
        params.end = timeRange.end.toISOString();
      }

      const response = await apiClient.get(`${this.BASE_PATH}/export/${type}`, {
        params,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get alerts and thresholds
   */
  static async getAlerts(): Promise<Array<{
    id: string;
    type: 'error_rate' | 'latency' | 'requests' | 'provider_health';
    threshold: number;
    currentValue: number;
    status: 'ok' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/alerts`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Create or update alert threshold
   */
  static async setAlertThreshold(
    type: 'error_rate' | 'latency' | 'requests' | 'provider_health',
    threshold: number,
    enabled: boolean = true
  ): Promise<void> {
    try {
      await apiClient.post(`${this.BASE_PATH}/alerts`, {
        type,
        threshold,
        enabled,
      });
    } catch (error) {
      throw handleApiError(error);
    }
  }
}