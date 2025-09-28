/**
 * API Key Usage Analytics Hook
 * Provides analytics and insights for API key usage patterns
 */

import { useState, useMemo, useCallback } from 'react';
import { useAllApiKeyUsage, useApiKeyUsage, useApiKeyStats } from '@/hooks/api/use-api-keys';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval, eachHourOfInterval, subHours } from 'date-fns';
import { ApiKeyUsageMetrics, ApiKeyStats } from '../types';

type TimeRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';
type MetricType = 'requests' | 'tokens' | 'errors' | 'latency';
type ChartType = 'line' | 'area' | 'bar' | 'pie';

interface UseApiKeyUsageAnalyticsOptions {
  keyId?: string; // If provided, analytics for specific key
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export const useApiKeyUsageAnalytics = (options: UseApiKeyUsageAnalyticsOptions = {}) => {
  const { keyId, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('7d');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('requests');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Calculate actual date range
  const dateRange = useMemo(() => {
    if (timeRange === 'custom' && customDateRange) {
      return customDateRange;
    }

    const now = new Date();
    const daysMap = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[timeRange as keyof typeof daysMap] || 7;

    return {
      start: startOfDay(subDays(now, days)),
      end: endOfDay(now),
    };
  }, [timeRange, customDateRange]);

  // Fetch data
  const { data: allUsageData, isLoading: isLoadingAll, refetch: refetchAll } = useAllApiKeyUsage(
    dateRange,
    { 
      enabled: !keyId,
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const { data: singleKeyUsage, isLoading: isLoadingSingle, refetch: refetchSingle } = useApiKeyUsage(
    keyId || '',
    dateRange,
    { 
      enabled: !!keyId,
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const { data: stats, refetch: refetchStats } = useApiKeyStats({
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const isLoading = keyId ? isLoadingSingle : isLoadingAll;
  
  const usageData = useMemo(() => {
    return keyId ? (singleKeyUsage ? [singleKeyUsage] : []) : (allUsageData || []);
  }, [keyId, singleKeyUsage, allUsageData]);

  // Generate time-series data
  const timeSeriesData = useMemo(() => {
    if (!usageData.length) return [];

    const intervals = timeRange === '24h' 
      ? eachHourOfInterval({ start: dateRange.start, end: dateRange.end })
      : eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

    return intervals.map((interval, index) => {
      // Mock time-series data generation (in real implementation, this would come from API)
      const baseValue = usageData.reduce((sum, key) => {
        switch (selectedMetric) {
          case 'requests':
            return sum + (key.requestsToday / intervals.length);
          case 'tokens':
            return sum + (key.tokensToday / intervals.length);
          case 'errors':
            return sum + Math.floor(Math.random() * 3); // Mock error data
          case 'latency':
            return sum + (100 + Math.random() * 50); // Mock latency data
          default:
            return sum;
        }
      }, 0);

      // Add realistic variation
      const variation = 0.7 + Math.random() * 0.6; // 70% to 130% of base value
      const value = Math.floor(baseValue * variation);

      return {
        timestamp: interval.toISOString(),
        time: format(interval, timeRange === '24h' ? 'HH:mm' : 'MMM d'),
        value,
        date: interval,
      };
    });
  }, [usageData, selectedMetric, timeRange, dateRange]);

  // Analytics insights
  const insights = useMemo(() => {
    if (!usageData.length || !stats) return null;

    const totalRequests = usageData.reduce((sum, key) => sum + key.requestsToday, 0);
    const totalTokens = usageData.reduce((sum, key) => sum + key.tokensToday, 0);
    const activeKeys = usageData.filter(key => key.requestsToday > 0).length;
    const utilizationRate = activeKeys / stats.total;

    // Top performing keys
    const topKeys = usageData
      .sort((a, b) => b.requestsToday - a.requestsToday)
      .slice(0, 5);

    // Usage distribution
    const usageDistribution = usageData.map(key => ({
      keyId: key.keyId,
      requests: key.requestsToday,
      tokens: key.tokensToday,
      percentage: totalRequests > 0 ? (key.requestsToday / totalRequests) * 100 : 0,
    }));

    // Growth trends (mock calculation)
    const currentPeriodRequests = totalRequests;
    const previousPeriodRequests = Math.floor(totalRequests * (0.8 + Math.random() * 0.4));
    const growthRate = previousPeriodRequests > 0 
      ? ((currentPeriodRequests - previousPeriodRequests) / previousPeriodRequests) * 100 
      : 0;

    // Anomaly detection (simple threshold-based)
    const avgRequestsPerKey = totalRequests / Math.max(activeKeys, 1);
    const anomalies = usageData.filter(key => 
      key.requestsToday > avgRequestsPerKey * 3 || // High usage
      (key.lastUsed && new Date(key.lastUsed) < subDays(new Date(), 7) && key.requestsToday > 0) // Unusual activity
    );

    return {
      totalRequests,
      totalTokens,
      activeKeys,
      utilizationRate,
      topKeys,
      usageDistribution,
      growthRate,
      anomalies,
      avgRequestsPerKey,
      peakUsageHour: timeSeriesData.reduce((peak, current) => 
        current.value > peak.value ? current : peak, 
        timeSeriesData[0] || { value: 0, time: '', timestamp: '', date: new Date() }
      ),
    };
  }, [usageData, stats, timeSeriesData]);

  // Recommendations
  const recommendations = useMemo(() => {
    if (!insights) return [];

    const recs = [];

    // Utilization recommendations
    if (insights.utilizationRate < 0.3) {
      recs.push({
        type: 'optimization',
        title: 'Low Key Utilization',
        description: `Only ${Math.round(insights.utilizationRate * 100)}% of API keys are being used. Consider revoking unused keys.`,
        priority: 'medium',
        action: 'revoke_unused',
      });
    }

    // Security recommendations
    if (insights.anomalies.length > 0) {
      recs.push({
        type: 'security',
        title: 'Unusual Usage Patterns',
        description: `${insights.anomalies.length} keys show unusual activity. Review for potential security issues.`,
        priority: 'high',
        action: 'review_anomalies',
      });
    }

    // Performance recommendations
    if (insights.growthRate > 50) {
      recs.push({
        type: 'performance',
        title: 'High Growth Rate',
        description: `Usage has grown by ${Math.round(insights.growthRate)}%. Consider scaling infrastructure.`,
        priority: 'medium',
        action: 'scale_infrastructure',
      });
    }

    // Rate limit recommendations
    const highUsageKeys = insights.topKeys.filter(key => key.requestsToday > 1000);
    if (highUsageKeys.length > 0) {
      recs.push({
        type: 'configuration',
        title: 'Rate Limit Review',
        description: `${highUsageKeys.length} keys have high usage. Review rate limits to ensure optimal performance.`,
        priority: 'low',
        action: 'review_rate_limits',
      });
    }

    return recs;
  }, [insights]);

  // Export data
  const exportData = useCallback((format: 'csv' | 'json' = 'csv') => {
    if (!usageData.length) return;

    const exportData = usageData.map(key => ({
      keyId: key.keyId,
      requestsToday: key.requestsToday,
      tokensToday: key.tokensToday,
      requestsThisMonth: key.requestsThisMonth,
      tokensThisMonth: key.tokensThisMonth,
      lastUsed: key.lastUsed || 'Never',
      exportedAt: new Date().toISOString(),
    }));

    if (format === 'csv') {
      const csv = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-key-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify({
        metadata: {
          exportedAt: new Date().toISOString(),
          timeRange,
          dateRange,
          selectedMetric,
        },
        data: exportData,
        insights,
        recommendations,
      }, null, 2);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-key-analytics-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [usageData, insights, recommendations, timeRange, dateRange, selectedMetric]);

  // Refresh all data
  const refreshData = useCallback(() => {
    if (keyId) {
      refetchSingle();
    } else {
      refetchAll();
    }
    refetchStats();
  }, [keyId, refetchSingle, refetchAll, refetchStats]);

  return {
    // Data
    usageData,
    timeSeriesData,
    stats,
    insights,
    recommendations,
    
    // State
    timeRange,
    customDateRange,
    selectedMetric,
    chartType,
    compareMode,
    selectedKeys,
    dateRange,
    isLoading,
    
    // Actions
    setTimeRange,
    setCustomDateRange,
    setSelectedMetric,
    setChartType,
    setCompareMode,
    setSelectedKeys,
    exportData,
    refreshData,
    
    // Utilities
    formatValue: (value: number) => {
      switch (selectedMetric) {
        case 'tokens':
          return value > 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString();
        case 'latency':
          return `${value}ms`;
        default:
          return value.toLocaleString();
      }
    },
    
    getMetricLabel: () => {
      switch (selectedMetric) {
        case 'requests': return 'Requests';
        case 'tokens': return 'Tokens';
        case 'errors': return 'Errors';
        case 'latency': return 'Latency (ms)';
        default: return 'Value';
      }
    },
  };
};