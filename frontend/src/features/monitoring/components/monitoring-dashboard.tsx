/**
 * Main monitoring dashboard component
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Settings
} from 'lucide-react';

import { SystemHealthOverview } from './system-health-overview';
import { MetricsChart } from './metrics-chart';
import { LogsViewer } from './logs-viewer';
import { PerformanceAnalytics } from './performance-analytics';
import { ErrorTracking } from './error-tracking';
import { RealTimeMetrics } from './real-time-metrics';

import { useMonitoringDashboard } from '../hooks/use-monitoring-dashboard';
import { useRealTimeUpdates } from '../hooks/use-real-time-updates';
import { MonitoringTimeRange } from '../types';
import { useExportMetrics } from '@/hooks/api/use-metrics';
import { toast } from 'sonner';

const TIME_RANGES: MonitoringTimeRange[] = [
  {
    start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    end: new Date(),
    label: 'Last Hour',
  },
  {
    start: new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
    end: new Date(),
    label: 'Last 6 Hours',
  },
  {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
    label: 'Last 24 Hours',
  },
  {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date(),
    label: 'Last 7 Days',
  },
  {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    end: new Date(),
    label: 'Last 30 Days',
  },
];

export const MonitoringDashboard: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<MonitoringTimeRange>(TIME_RANGES[1]);
  const [activeTab, setActiveTab] = useState('overview');
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);

  const { data, isLoading, error, refetch } = useMonitoringDashboard(selectedTimeRange);
  const realTimeUpdates = useRealTimeUpdates({ enabled: realTimeEnabled });
  const exportMetrics = useExportMetrics();

  const handleTimeRangeChange = (value: string) => {
    const timeRange = TIME_RANGES.find(range => range.label === value);
    if (timeRange) {
      setSelectedTimeRange(timeRange);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await exportMetrics.mutateAsync({
        type: 'system',
        format,
        timeRange: selectedTimeRange,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-metrics-${selectedTimeRange.label.toLowerCase().replace(/\s+/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Metrics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export metrics');
    }
  };

  const systemStatus = useMemo(() => {
    if (!data) return 'unknown';
    
    const { overview, alerts } = data;
    
    if (alerts.critical > 0) return 'critical';
    if (alerts.warning > 0 || overview.errorRate > 5) return 'warning';
    if (overview.successRate > 95) return 'healthy';
    
    return 'degraded';
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary',
      degraded: 'secondary',
      critical: 'destructive',
      unknown: 'outline',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">System Monitoring</h1>
            {getStatusBadge(systemStatus)}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange.label} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exportMetrics.isPending}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRealTimeEnabled(!realTimeEnabled)}
          >
            <Activity className={`w-4 h-4 mr-1 ${realTimeEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            Real-time
          </Button>
        </div>
      </div>

      {/* Real-time connection status */}
      {realTimeEnabled && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${realTimeUpdates.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-muted-foreground">
            {realTimeUpdates.isConnected ? 'Connected' : 'Disconnected'}
            {realTimeUpdates.connectionError && ` - ${realTimeUpdates.connectionError}`}
          </span>
        </div>
      )}

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <SystemHealthOverview 
                data={data} 
                realTimeMetrics={realTimeUpdates.metrics}
              />
              <RealTimeMetrics 
                data={data?.realTime} 
                streamingMetrics={realTimeUpdates.metrics}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <MetricsChart
                title="Requests per Hour"
                data={data?.timeSeries.requests || []}
                type="requests"
                timeRange={selectedTimeRange}
              />
              <MetricsChart
                title="Error Rate"
                data={data?.timeSeries.errors || []}
                type="errors"
                timeRange={selectedTimeRange}
              />
              <MetricsChart
                title="Average Latency"
                data={data?.timeSeries.latency || []}
                type="latency"
                timeRange={selectedTimeRange}
              />
              <MetricsChart
                title="Provider Performance"
                data={data?.providers.map(p => ({
                  timestamp: new Date().toISOString(),
                  value: p.metrics?.averageLatency || 0,
                  label: p.name,
                })) || []}
                type="latency"
                timeRange={selectedTimeRange}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceAnalytics 
            data={data} 
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          <ErrorTracking 
            errors={data?.errors || []} 
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <LogsViewer 
            timeRange={selectedTimeRange}
            streamingLogs={realTimeUpdates.logs}
            isStreaming={realTimeUpdates.isConnected}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};