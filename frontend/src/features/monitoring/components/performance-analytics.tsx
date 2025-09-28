/**
 * Performance analytics component
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Clock, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Activity,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format } from 'date-fns';

import { usePerformancePercentiles, useTopModels, useUsageTrends } from '@/hooks/api/use-metrics';
import { MonitoringTimeRange, PerformanceMetric } from '../types';

interface PerformanceAnalyticsProps {
  data: any;
  timeRange: MonitoringTimeRange;
  isLoading: boolean;
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316'];

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  data,
  timeRange,
  isLoading,
}) => {
  const { data: percentiles } = usePerformancePercentiles(timeRange);
  const { data: topModels } = useTopModels(10, 'requests', timeRange);
  const { data: trends } = useUsageTrends('week');

  const performanceMetrics = useMemo((): PerformanceMetric[] => {
    if (!data?.overview) return [];

    return [
      {
        name: 'Average Latency',
        value: data.overview.averageLatency,
        unit: 'ms',
        trend: trends?.latencyTrend > 0 ? 'up' : trends?.latencyTrend < 0 ? 'down' : 'stable',
        trendPercentage: Math.abs(trends?.latencyTrend || 0),
        status: data.overview.averageLatency < 100 ? 'good' : 
                data.overview.averageLatency < 500 ? 'warning' : 'critical',
      },
      {
        name: 'Requests/Min',
        value: data.realTime?.currentRPS * 60 || 0,
        unit: 'req/min',
        trend: trends?.requestsTrend > 0 ? 'up' : trends?.requestsTrend < 0 ? 'down' : 'stable',
        trendPercentage: Math.abs(trends?.requestsTrend || 0),
        status: 'good',
      },
      {
        name: 'Success Rate',
        value: data.overview.successRate,
        unit: '%',
        trend: 'stable',
        trendPercentage: 0,
        status: data.overview.successRate > 99 ? 'good' : 
                data.overview.successRate > 95 ? 'warning' : 'critical',
      },
      {
        name: 'Error Rate',
        value: data.overview.errorRate,
        unit: '%',
        trend: trends?.errorRateTrend > 0 ? 'up' : trends?.errorRateTrend < 0 ? 'down' : 'stable',
        trendPercentage: Math.abs(trends?.errorRateTrend || 0),
        status: data.overview.errorRate < 1 ? 'good' : 
                data.overview.errorRate < 5 ? 'warning' : 'critical',
      },
    ];
  }, [data, trends]);

  const percentileData = useMemo(() => {
    if (!percentiles) return [];
    
    return [
      { name: 'P50', value: percentiles.p50, label: '50th percentile' },
      { name: 'P90', value: percentiles.p90, label: '90th percentile' },
      { name: 'P95', value: percentiles.p95, label: '95th percentile' },
      { name: 'P99', value: percentiles.p99, label: '99th percentile' },
      { name: 'P99.9', value: percentiles.p999, label: '99.9th percentile' },
    ];
  }, [percentiles]);

  const providerPerformanceData = useMemo(() => {
    if (!data?.providers) return [];
    
    return data.providers
      .filter((p: any) => p.metrics)
      .map((provider: any) => ({
        name: provider.name,
        latency: provider.metrics.averageLatency,
        requests: provider.metrics.requests,
        errorRate: provider.metrics.errorRate,
        successRate: 100 - provider.metrics.errorRate,
      }))
      .sort((a: any, b: any) => b.requests - a.requests)
      .slice(0, 10);
  }, [data?.providers]);

  const modelDistributionData = useMemo(() => {
    if (!topModels) return [];
    
    return topModels.map((model, index) => ({
      name: model.modelId,
      value: model.requests,
      color: COLORS[index % COLORS.length],
    }));
  }, [topModels]);

  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-green-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Metrics Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {performanceMetrics.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              <div className="flex items-center space-x-1">
                {getTrendIcon(metric.trend)}
                <span className="text-xs text-muted-foreground">
                  {metric.trendPercentage.toFixed(1)}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                {metric.name === 'Average Latency' ? formatLatency(metric.value) : 
                 metric.unit === '%' ? `${metric.value.toFixed(2)}%` :
                 `${formatNumber(metric.value)} ${metric.unit}`}
              </div>
              <Badge 
                variant={metric.status === 'good' ? 'default' : 
                        metric.status === 'warning' ? 'secondary' : 'destructive'}
                className="mt-2"
              >
                {metric.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Analysis Tabs */}
      <Tabs defaultValue="latency" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="latency">Latency Analysis</TabsTrigger>
          <TabsTrigger value="providers">Provider Performance</TabsTrigger>
          <TabsTrigger value="models">Model Distribution</TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="latency" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Latency Percentiles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Latency Percentiles</span>
                </CardTitle>
                <CardDescription>
                  Response time distribution across all requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={percentileData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis 
                        tickFormatter={formatLatency}
                        className="text-xs"
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatLatency(value), 'Latency']}
                        labelFormatter={(label) => percentileData.find(d => d.name === label)?.label}
                      />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Latency Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Latency Breakdown</CardTitle>
                <CardDescription>
                  Performance targets and current status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Target: &lt; 100ms</span>
                    <Badge variant={percentiles?.p95 && percentiles.p95 < 100 ? 'default' : 'destructive'}>
                      {percentiles?.p95 ? formatLatency(percentiles.p95) : 'N/A'}
                    </Badge>
                  </div>
                  <Progress 
                    value={percentiles?.p95 ? Math.min((percentiles.p95 / 100) * 100, 100) : 0}
                    className="h-2"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SLA: &lt; 500ms (P99)</span>
                    <Badge variant={percentiles?.p99 && percentiles.p99 < 500 ? 'default' : 'destructive'}>
                      {percentiles?.p99 ? formatLatency(percentiles.p99) : 'N/A'}
                    </Badge>
                  </div>
                  <Progress 
                    value={percentiles?.p99 ? Math.min((percentiles.p99 / 500) * 100, 100) : 0}
                    className="h-2"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fastest</span>
                      <div className="font-medium">{formatLatency(percentiles?.p50 || 0)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Slowest</span>
                      <div className="font-medium">{formatLatency(percentiles?.p999 || 0)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Provider Performance Comparison</span>
              </CardTitle>
              <CardDescription>
                Latency and request volume by provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      yAxisId="latency"
                      orientation="left"
                      tickFormatter={formatLatency}
                      className="text-xs"
                    />
                    <YAxis 
                      yAxisId="requests"
                      orientation="right"
                      tickFormatter={formatNumber}
                      className="text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'latency' ? formatLatency(value) : formatNumber(value),
                        name === 'latency' ? 'Avg Latency' : 'Requests'
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="latency" dataKey="latency" fill="#f59e0b" name="Avg Latency" />
                    <Bar yAxisId="requests" dataKey="requests" fill="#3b82f6" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChartIcon className="w-5 h-5" />
                  <span>Request Distribution by Model</span>
                </CardTitle>
                <CardDescription>
                  Most popular models by request volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={modelDistributionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {modelDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatNumber(value), 'Requests']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Models Performance</CardTitle>
                <CardDescription>
                  Performance metrics for most used models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topModels?.slice(0, 5).map((model, index) => (
                    <div key={model.modelId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <div>
                          <div className="font-medium text-sm">{model.modelId}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(model.requests)} requests
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatLatency(model.averageLatency)}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.errorRate.toFixed(1)}% errors
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Request Trend</CardTitle>
                <CardDescription>Week over week change</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold">
                    {trends?.requestsTrend > 0 ? '+' : ''}{trends?.requestsTrend.toFixed(1)}%
                  </div>
                  {trends && getTrendIcon(trends.requestsTrend > 0 ? 'up' : trends.requestsTrend < 0 ? 'down' : 'stable')}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Compared to previous {trends?.period}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latency Trend</CardTitle>
                <CardDescription>Week over week change</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold">
                    {trends?.latencyTrend > 0 ? '+' : ''}{trends?.latencyTrend.toFixed(1)}%
                  </div>
                  {trends && getTrendIcon(trends.latencyTrend > 0 ? 'up' : trends.latencyTrend < 0 ? 'down' : 'stable')}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Compared to previous {trends?.period}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rate Trend</CardTitle>
                <CardDescription>Week over week change</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold">
                    {trends?.errorRateTrend > 0 ? '+' : ''}{trends?.errorRateTrend.toFixed(1)}%
                  </div>
                  {trends && getTrendIcon(trends.errorRateTrend > 0 ? 'up' : trends.errorRateTrend < 0 ? 'down' : 'stable')}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Compared to previous {trends?.period}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};