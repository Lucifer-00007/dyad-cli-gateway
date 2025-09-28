/**
 * React Query hooks for metrics and analytics
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { MetricsService, MetricsTimeRange } from '@/services/metrics';
import { queryKeys } from '@/lib/query-client';

// System metrics hooks
export const useSystemMetrics = (timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'system', timeRange],
    queryFn: () => MetricsService.getSystemMetrics(timeRange),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useTimeSeriesMetrics = (
  metric: 'requests' | 'errors' | 'latency' | 'tokens',
  timeRange: MetricsTimeRange,
  granularity: 'minute' | 'hour' | 'day' = 'hour'
) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'timeseries', metric, timeRange, granularity],
    queryFn: () => MetricsService.getTimeSeriesMetrics(metric, timeRange, granularity),
    staleTime: 60000, // 1 minute
    enabled: !!timeRange.start && !!timeRange.end,
  });
};

export const useRealTimeMetrics = () => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'realtime'],
    queryFn: () => MetricsService.getRealTimeMetrics(),
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

// Provider metrics hooks
export const useProviderMetrics = (providerId?: string, timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'providers', providerId, timeRange],
    queryFn: () => MetricsService.getProviderMetrics(providerId, timeRange),
    staleTime: 60000, // 1 minute
  });
};

// Model metrics hooks
export const useModelMetrics = (modelId?: string, timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'models', modelId, timeRange],
    queryFn: () => MetricsService.getModelMetrics(modelId, timeRange),
    staleTime: 60000, // 1 minute
  });
};

export const useTopModels = (
  limit: number = 10,
  sortBy: 'requests' | 'tokens' | 'latency' = 'requests',
  timeRange?: MetricsTimeRange
) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'top-models', limit, sortBy, timeRange],
    queryFn: () => MetricsService.getTopModels(limit, sortBy, timeRange),
    staleTime: 300000, // 5 minutes
  });
};

// Error metrics hooks
export const useErrorMetrics = (timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'errors', timeRange],
    queryFn: () => MetricsService.getErrorMetrics(timeRange),
    staleTime: 60000, // 1 minute
  });
};

// Performance metrics hooks
export const usePerformancePercentiles = (timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'percentiles', timeRange],
    queryFn: () => MetricsService.getPerformancePercentiles(timeRange),
    staleTime: 60000, // 1 minute
  });
};

export const useUsageTrends = (period: 'day' | 'week' | 'month' = 'week') => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'trends', period],
    queryFn: () => MetricsService.getUsageTrends(period),
    staleTime: 300000, // 5 minutes
  });
};

// Cost analysis hooks
export const useCostAnalysis = (timeRange?: MetricsTimeRange) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'costs', timeRange],
    queryFn: () => MetricsService.getCostAnalysis(timeRange),
    staleTime: 300000, // 5 minutes
  });
};

// Alerts hooks
export const useAlerts = () => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), 'alerts'],
    queryFn: () => MetricsService.getAlerts(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

// Mutation hooks
export const useExportMetrics = () => {
  return useMutation({
    mutationKey: ['export-metrics'],
    mutationFn: ({
      type,
      format,
      timeRange,
    }: {
      type: 'system' | 'providers' | 'models' | 'errors';
      format: 'json' | 'csv';
      timeRange?: MetricsTimeRange;
    }) => MetricsService.exportMetrics(type, format, timeRange),
  });
};

export const useSetAlertThreshold = () => {
  return useMutation({
    mutationKey: ['set-alert-threshold'],
    mutationFn: ({
      type,
      threshold,
      enabled,
    }: {
      type: 'error_rate' | 'latency' | 'requests' | 'provider_health';
      threshold: number;
      enabled?: boolean;
    }) => MetricsService.setAlertThreshold(type, threshold, enabled),
  });
};

// Custom hooks for common metric combinations
export const useDashboardMetrics = (timeRange?: MetricsTimeRange) => {
  const systemMetrics = useSystemMetrics(timeRange);
  const realTimeMetrics = useRealTimeMetrics();
  const errorMetrics = useErrorMetrics(timeRange);
  const alerts = useAlerts();

  return {
    systemMetrics,
    realTimeMetrics,
    errorMetrics,
    alerts,
    isLoading: systemMetrics.isLoading || realTimeMetrics.isLoading,
    error: systemMetrics.error || realTimeMetrics.error,
  };
};

export const useProviderDashboard = (providerId: string, timeRange?: MetricsTimeRange) => {
  const providerMetrics = useProviderMetrics(providerId, timeRange);
  const modelMetrics = useModelMetrics(undefined, timeRange);

  return {
    providerMetrics,
    modelMetrics: {
      ...modelMetrics,
      data: modelMetrics.data?.filter(model => 
        model.providerId === providerId
      ),
    },
    isLoading: providerMetrics.isLoading || modelMetrics.isLoading,
    error: providerMetrics.error || modelMetrics.error,
  };
};