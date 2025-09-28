import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  RefreshCw, 
  TrendingUp,
  Zap,
  Eye,
  Bug,
  BarChart3
} from 'lucide-react';

import { useHealthCheck, HealthStatusIndicator } from '../lib/health-check';
import { usePerformanceMonitoring } from '../lib/performance-monitoring';
import { useAnalytics } from '../lib/analytics';
import { useLogger, logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance-monitoring';
import { analytics } from '../lib/analytics';

interface MonitoringDashboardProps {
  className?: string;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  className = '' 
}) => {
  const { healthStatus, isLoading: healthLoading, runCheck } = useHealthCheck();
  const { getMetrics, clearMetrics } = usePerformanceMonitoring();
  const { trackFeature } = useAnalytics();
  const { info } = useLogger('MonitoringDashboard');

  const [performanceMetrics, setPerformanceMetrics] = useState(getMetrics());
  const [logs, setLogs] = useState(logger.getStoredLogs());
  const [analyticsEvents, setAnalyticsEvents] = useState(analytics.getEvents());

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceMetrics(getMetrics());
      setLogs(logger.getStoredLogs());
      setAnalyticsEvents(analytics.getEvents());
    }, 5000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  // Track dashboard usage
  useEffect(() => {
    trackFeature('monitoring_dashboard_viewed');
    info('Monitoring dashboard opened');
  }, [trackFeature, info]);

  const handleExportLogs = (format: 'json' | 'csv') => {
    const exportData = logger.exportLogs(format);
    const blob = new Blob([exportData], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dyad-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackFeature('logs_exported', { format });
  };

  const handleClearLogs = () => {
    logger.clearStoredLogs();
    setLogs([]);
    trackFeature('logs_cleared');
  };

  const handleClearMetrics = () => {
    clearMetrics();
    setPerformanceMetrics([]);
    trackFeature('metrics_cleared');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-600';
      case 'degraded':
      case 'warn':
        return 'text-yellow-600';
      case 'unhealthy':
      case 'fail':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return <CheckCircle className="w-4 h-4" />;
      case 'degraded':
      case 'warn':
        return <AlertTriangle className="w-4 h-4" />;
      case 'unhealthy':
      case 'fail':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration.toFixed(0)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  // Calculate performance statistics
  const performanceStats = React.useMemo(() => {
    const webVitals = performanceMetrics.filter(m => 
      ['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name)
    );
    
    const customMetrics = performanceMetrics.filter(m => 
      !['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].includes(m.name)
    );

    const avgLoadTime = webVitals
      .filter(m => m.name === 'LCP')
      .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);

    return {
      totalMetrics: performanceMetrics.length,
      webVitals: webVitals.length,
      customMetrics: customMetrics.length,
      avgLoadTime: avgLoadTime || 0,
      poorMetrics: performanceMetrics.filter(m => m.rating === 'poor').length,
    };
  }, [performanceMetrics]);

  // Calculate log statistics
  const logStats = React.useMemo(() => {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter(log => log.timestamp > last24h);
    
    return {
      total: logs.length,
      recent: recentLogs.length,
      errors: logs.filter(log => log.level === 'error').length,
      warnings: logs.filter(log => log.level === 'warn').length,
    };
  }, [logs]);

  return (
    <div className={`monitoring-dashboard space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and observability dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HealthStatusIndicator className="mr-4" />
          <Button
            variant="outline"
            size="sm"
            onClick={runCheck}
            disabled={healthLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last check: {healthStatus ? formatTimestamp(healthStatus.timestamp) : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceStats.avgLoadTime > 0 
                ? formatDuration(performanceStats.avgLoadTime)
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Average load time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logStats.errors}
            </div>
            <p className="text-xs text-muted-foreground">
              Total errors logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsEvents.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Analytics events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health Status</CardTitle>
              <CardDescription>
                Current status of all monitored services and components
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthStatus ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Overall Status</span>
                    <Badge 
                      variant={healthStatus.status === 'healthy' ? 'default' : 'destructive'}
                      className={getStatusColor(healthStatus.status)}
                    >
                      {getStatusIcon(healthStatus.status)}
                      <span className="ml-1">{healthStatus.status}</span>
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {Object.entries(healthStatus.checks).map(([name, check]) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={getStatusColor(check.status)}>
                            {getStatusIcon(check.status)}
                          </span>
                          <span className="font-medium capitalize">{name}</span>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={check.status === 'pass' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {check.status}
                          </Badge>
                          {check.duration && (
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(check.duration)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No health data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Web Vitals and custom performance measurements
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearMetrics}
              >
                Clear Metrics
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{performanceStats.totalMetrics}</div>
                  <div className="text-sm text-muted-foreground">Total Metrics</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{performanceStats.webVitals}</div>
                  <div className="text-sm text-muted-foreground">Web Vitals</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{performanceStats.poorMetrics}</div>
                  <div className="text-sm text-muted-foreground">Poor Ratings</div>
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {performanceMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{metric.name}</span>
                        <Badge 
                          variant={metric.rating === 'good' ? 'default' : 'destructive'}
                          className="ml-2 text-xs"
                        >
                          {metric.rating}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {formatDuration(metric.value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(metric.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Application Logs</CardTitle>
                <CardDescription>
                  Structured logs from the frontend application
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportLogs('json')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportLogs('csv')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                >
                  Clear Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{logStats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Logs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{logStats.recent}</div>
                  <div className="text-sm text-muted-foreground">Last 24h</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{logStats.errors}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{logStats.warnings}</div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {logs.slice(-50).reverse().map((log, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={log.level === 'error' ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {log.level}
                          </Badge>
                          {log.source && (
                            <span className="text-muted-foreground">[{log.source}]</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <div className="font-mono text-xs">{log.message}</div>
                      {log.context && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Context
                          </summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Events</CardTitle>
              <CardDescription>
                User actions and system events tracked by the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {analyticsEvents.slice(-50).reverse().map((event, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs">
                            {event.category}
                          </Badge>
                          <span className="font-medium">{event.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      {event.properties && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Properties
                          </summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded">
                            {JSON.stringify(event.properties, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};