/**
 * React Query hooks for system monitoring and health
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { SystemService } from '@/services';
import { queryKeys } from '@/lib/query-client';

export const useSystemHealth = () => {
  return useQuery({
    queryKey: queryKeys.system.health(),
    queryFn: () => SystemService.getHealth(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useSystemReadiness = () => {
  return useQuery({
    queryKey: [...queryKeys.system.all, 'readiness'],
    queryFn: () => SystemService.getReadiness(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useSystemMetrics = (timeRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: [...queryKeys.system.metrics(), timeRange],
    queryFn: () => SystemService.getMetrics(timeRange),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useSystemStatus = () => {
  return useQuery({
    queryKey: [...queryKeys.system.all, 'status'],
    queryFn: () => SystemService.getSystemStatus(),
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useSystemLogs = (params?: {
  page?: number;
  limit?: number;
  level?: string[];
  source?: string[];
  providerId?: string;
  timeRange?: { start: Date; end: Date };
  search?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.system.logs(params),
    queryFn: () => SystemService.getLogs(params),
    staleTime: 10000, // 10 seconds
    keepPreviousData: true, // Keep previous data while loading new page
  });
};

export const usePerformanceMetrics = (
  metric: 'requests' | 'errors' | 'latency',
  timeRange: { start: Date; end: Date },
  granularity: 'minute' | 'hour' | 'day' = 'hour'
) => {
  return useQuery({
    queryKey: [...queryKeys.system.all, 'performance', metric, timeRange, granularity],
    queryFn: () => SystemService.getPerformanceMetrics(metric, timeRange, granularity),
    staleTime: 60000, // 1 minute
    enabled: !!timeRange.start && !!timeRange.end,
  });
};

// Mutation hooks
export const useExportData = () => {
  return useMutation({
    mutationKey: ['export-data'],
    mutationFn: ({
      type,
      format,
      filters,
    }: {
      type: 'logs' | 'metrics' | 'providers';
      format: 'json' | 'csv';
      filters?: any;
    }) => SystemService.exportData(type, format, filters),
  });
};

export const useClearCache = () => {
  return useMutation({
    mutationKey: ['clear-cache'],
    mutationFn: () => SystemService.clearCache(),
  });
};

export const useRestartServices = () => {
  return useMutation({
    mutationKey: ['restart-services'],
    mutationFn: (services?: string[]) => SystemService.restartServices(services),
  });
};