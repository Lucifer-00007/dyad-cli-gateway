/**
 * System health overview component
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Server, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Database,
  Cpu,
  MemoryStick
} from 'lucide-react';

interface SystemHealthOverviewProps {
  data: any;
  realTimeMetrics?: Record<string, any>;
}

export const SystemHealthOverview: React.FC<SystemHealthOverviewProps> = ({ 
  data, 
  realTimeMetrics 
}) => {
  if (!data) return null;

  const { overview, providers, alerts, realTime } = data;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getHealthStatus = (successRate: number, errorRate: number) => {
    if (successRate >= 99 && errorRate < 1) return 'excellent';
    if (successRate >= 95 && errorRate < 5) return 'good';
    if (successRate >= 90 && errorRate < 10) return 'fair';
    return 'poor';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const healthStatus = getHealthStatus(overview.successRate, overview.errorRate);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* System Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">{healthStatus}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>{overview.successRate.toFixed(1)}% success rate</span>
            <Badge variant="outline" className="text-xs">
              {overview.activeProviders} providers
            </Badge>
          </div>
          <Progress 
            value={overview.successRate} 
            className="mt-2"
            // @ts-ignore - Progress component accepts className
            indicatorClassName={getHealthColor(healthStatus).replace('text-', 'bg-')}
          />
        </CardContent>
      </Card>

      {/* Total Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(overview.totalRequests)}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Current: {realTime?.currentRPS || 0} RPS</span>
            {realTimeMetrics?.requestsTrend && (
              <div className="flex items-center">
                {realTimeMetrics.requestsTrend > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : realTimeMetrics.requestsTrend < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-500" />
                )}
                <span className="ml-1">{Math.abs(realTimeMetrics.requestsTrend)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Average Latency */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatLatency(overview.averageLatency)}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Current: {formatLatency(realTime?.currentLatency || 0)}</span>
            {realTimeMetrics?.latencyTrend && (
              <div className="flex items-center">
                {realTimeMetrics.latencyTrend > 0 ? (
                  <TrendingUp className="w-3 h-3 text-red-500" />
                ) : realTimeMetrics.latencyTrend < 0 ? (
                  <TrendingDown className="w-3 h-3 text-green-500" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-500" />
                )}
                <span className="ml-1">{Math.abs(realTimeMetrics.latencyTrend)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.errorRate.toFixed(2)}%</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Current: {(realTime?.currentErrorRate || 0).toFixed(2)}%</span>
            {alerts.critical > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alerts.critical} critical
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Resources */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">System Resources</CardTitle>
          <CardDescription>Current resource utilization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span>CPU Usage</span>
                </div>
                <span className="font-medium">{(realTime?.cpuUsage || 0).toFixed(1)}%</span>
              </div>
              <Progress value={realTime?.cpuUsage || 0} />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <MemoryStick className="w-4 h-4 text-muted-foreground" />
                  <span>Memory Usage</span>
                </div>
                <span className="font-medium">{(realTime?.memoryUsage || 0).toFixed(1)}%</span>
              </div>
              <Progress value={realTime?.memoryUsage || 0} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>Active Connections</span>
              </div>
              <span className="font-medium">{realTime?.activeConnections || 0}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span>Queue Size</span>
              </div>
              <span className="font-medium">{realTime?.queueSize || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Status */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Provider Status</CardTitle>
          <CardDescription>Health status of all registered providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {providers.slice(0, 6).map((provider: any) => (
              <div key={provider.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    provider.status === 'healthy' ? 'bg-green-500' :
                    provider.status === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm font-medium">{provider.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {provider.status}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  {provider.metrics && (
                    <>
                      <span>{provider.metrics.requests} req</span>
                      <span>{formatLatency(provider.metrics.averageLatency)}</span>
                      <span>{provider.metrics.errorRate.toFixed(1)}% err</span>
                    </>
                  )}
                </div>
              </div>
            ))}
            
            {providers.length > 6 && (
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                +{providers.length - 6} more providers
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uptime */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatUptime(overview.uptime)}</div>
          <p className="text-xs text-muted-foreground">
            Since last restart
          </p>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{alerts.total}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {alerts.critical > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alerts.critical} critical
              </Badge>
            )}
            {alerts.warning > 0 && (
              <Badge variant="secondary" className="text-xs">
                {alerts.warning} warning
              </Badge>
            )}
            {alerts.total === 0 && <span>All systems normal</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};