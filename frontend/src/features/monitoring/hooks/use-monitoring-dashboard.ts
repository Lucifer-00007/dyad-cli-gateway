/**
 * Custom hook for monitoring dashboard data aggregation
 */

import { useMemo } from 'react';
import { 
  useSystemMetrics, 
  useRealTimeMetrics, 
  useErrorMetrics, 
  useAlerts,
  useProviderMetrics,
  useTimeSeriesMetrics
} from '@/hooks/api/use-metrics';
import { useSystemStatus } from '@/hooks/api/use-system';
import { MonitoringTimeRange } from '../types';

export const useMonitoringDashboard = (timeRange?: MonitoringTimeRange) => {
  // Core metrics
  const systemMetrics = useSystemMetrics(timeRange);
  const realTimeMetrics = useRealTimeMetrics();
  const systemStatus = useSystemStatus();
  const errorMetrics = useErrorMetrics(timeRange);
  const alerts = useAlerts();
  const providerMetrics = useProviderMetrics(undefined, timeRange);

  // Time series data for charts
  const requestsTimeSeries = useTimeSeriesMetrics('requests', timeRange!, 'hour');
  const errorsTimeSeries = useTimeSeriesMetrics('errors', timeRange!, 'hour');
  const latencyTimeSeries = useTimeSeriesMetrics('latency', timeRange!, 'hour');

  // Aggregate loading states
  const isLoading = useMemo(() => {
    return systemMetrics.isLoading || 
           realTimeMetrics.isLoading || 
           systemStatus.isLoading ||
           errorMetrics.isLoading ||
           alerts.isLoading ||
           providerMetrics.isLoading;
  }, [
    systemMetrics.isLoading,
    realTimeMetrics.isLoading,
    systemStatus.isLoading,
    errorMetrics.isLoading,
    alerts.isLoading,
    providerMetrics.isLoading
  ]);

  // Aggregate error states
  const error = useMemo(() => {
    return systemMetrics.error || 
           realTimeMetrics.error || 
           systemStatus.error ||
           errorMetrics.error ||
           alerts.error ||
           providerMetrics.error;
  }, [
    systemMetrics.error,
    realTimeMetrics.error,
    systemStatus.error,
    errorMetrics.error,
    alerts.error,
    providerMetrics.error
  ]);

  // Computed dashboard data
  const dashboardData = useMemo(() => {
    if (!systemMetrics.data || !realTimeMetrics.data || !systemStatus.data) {
      return null;
    }

    const activeAlerts = alerts.data?.filter(alert => alert.status !== 'ok') || [];
    const criticalAlerts = activeAlerts.filter(alert => alert.status === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.status === 'warning');

    return {
      // System overview
      overview: {
        totalRequests: systemMetrics.data.totalRequests,
        successRate: systemMetrics.data.successRate,
        errorRate: systemMetrics.data.errorRate,
        averageLatency: systemMetrics.data.averageLatency,
        activeProviders: systemMetrics.data.activeProviders,
        uptime: systemMetrics.data.uptime,
      },

      // Real-time metrics
      realTime: {
        currentRPS: realTimeMetrics.data.currentRPS,
        currentLatency: realTimeMetrics.data.currentLatency,
        currentErrorRate: realTimeMetrics.data.currentErrorRate,
        activeConnections: realTimeMetrics.data.activeConnections,
        queueSize: realTimeMetrics.data.queueSize,
        memoryUsage: realTimeMetrics.data.memoryUsage,
        cpuUsage: realTimeMetrics.data.cpuUsage,
      },

      // Provider health
      providers: systemStatus.data.providers.map(provider => ({
        ...provider,
        metrics: providerMetrics.data?.find(p => p.providerId === provider.id),
      })),

      // Alerts summary
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        recent: activeAlerts.slice(0, 5),
      },

      // Error analysis
      errors: errorMetrics.data || [],

      // Time series data
      timeSeries: {
        requests: requestsTimeSeries.data || [],
        errors: errorsTimeSeries.data || [],
        latency: latencyTimeSeries.data || [],
      },
    };
  }, [
    systemMetrics.data,
    realTimeMetrics.data,
    systemStatus.data,
    alerts.data,
    errorMetrics.data,
    providerMetrics.data,
    requestsTimeSeries.data,
    errorsTimeSeries.data,
    latencyTimeSeries.data,
  ]);

  return {
    data: dashboardData,
    isLoading,
    error,
    refetch: () => {
      systemMetrics.refetch();
      realTimeMetrics.refetch();
      systemStatus.refetch();
      errorMetrics.refetch();
      alerts.refetch();
      providerMetrics.refetch();
    },
  };
};