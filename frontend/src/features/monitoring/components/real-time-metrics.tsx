/**
 * Real-time metrics component
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Zap, 
  Clock, 
  Users, 
  Database, 
  Cpu, 
  MemoryStick,
  Wifi,
  WifiOff
} from 'lucide-react';

interface RealTimeMetricsProps {
  data?: {
    currentRPS: number;
    currentLatency: number;
    currentErrorRate: number;
    activeConnections: number;
    queueSize: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  streamingMetrics?: Record<string, unknown>;
}

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  data,
  streamingMetrics,
}) => {
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Use streaming metrics if available, otherwise fall back to data
  const metrics = streamingMetrics || data;

  useEffect(() => {
    if (streamingMetrics) {
      setIsLive(true);
      setLastUpdate(new Date());
    } else {
      setIsLive(false);
    }
  }, [streamingMetrics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'bg-green-500';
    if (value <= thresholds.warning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Real-time Metrics</span>
            <Badge variant="outline">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          </CardTitle>
          <CardDescription>
            Live system performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No real-time data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Real-time Metrics</span>
            <Badge variant={isLive ? "default" : "outline"}>
              {isLive ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Cached
                </>
              )}
            </Badge>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </CardTitle>
        <CardDescription>
          Live system performance indicators
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Requests per Second */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">RPS</span>
              </div>
              <span className={`text-lg font-bold ${getStatusColor(metrics.currentRPS || 0, { good: 100, warning: 500 })}`}>
                {formatNumber(metrics.currentRPS || 0)}
              </span>
            </div>
            <Progress 
              value={Math.min((metrics.currentRPS || 0) / 1000 * 100, 100)} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              Requests per second
            </div>
          </div>

          {/* Current Latency */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Latency</span>
              </div>
              <span className={`text-lg font-bold ${getStatusColor(metrics.currentLatency || 0, { good: 100, warning: 500 })}`}>
                {formatLatency(metrics.currentLatency || 0)}
              </span>
            </div>
            <Progress 
              value={Math.min((metrics.currentLatency || 0) / 1000 * 100, 100)} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              Average response time
            </div>
          </div>

          {/* Error Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Error Rate</span>
              </div>
              <span className={`text-lg font-bold ${getStatusColor(metrics.currentErrorRate || 0, { good: 1, warning: 5 })}`}>
                {(metrics.currentErrorRate || 0).toFixed(2)}%
              </span>
            </div>
            <Progress 
              value={Math.min((metrics.currentErrorRate || 0), 100)} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              Current error percentage
            </div>
          </div>

          {/* Active Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Connections</span>
              </div>
              <span className="text-lg font-bold">
                {formatNumber(metrics.activeConnections || 0)}
              </span>
            </div>
            <Progress 
              value={Math.min((metrics.activeConnections || 0) / 1000 * 100, 100)} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              Active connections
            </div>
          </div>
        </div>

        {/* System Resources */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-medium mb-4">System Resources</h4>
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* CPU Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">CPU</span>
                </div>
                <span className={`text-sm font-medium ${getStatusColor(metrics.cpuUsage || 0, { good: 70, warning: 85 })}`}>
                  {(metrics.cpuUsage || 0).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.cpuUsage || 0} 
                className="h-2"
              />
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MemoryStick className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Memory</span>
                </div>
                <span className={`text-sm font-medium ${getStatusColor(metrics.memoryUsage || 0, { good: 70, warning: 85 })}`}>
                  {(metrics.memoryUsage || 0).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.memoryUsage || 0} 
                className="h-2"
              />
            </div>

            {/* Queue Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-orange-500" />
                  <span className="text-sm">Queue</span>
                </div>
                <span className={`text-sm font-medium ${getStatusColor(metrics.queueSize || 0, { good: 10, warning: 50 })}`}>
                  {formatNumber(metrics.queueSize || 0)}
                </span>
              </div>
              <Progress 
                value={Math.min((metrics.queueSize || 0) / 100 * 100, 100)} 
                className="h-2"
              />
            </div>
          </div>
        </div>

        {/* Live Indicators */}
        {isLive && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live data streaming</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <span>Updates every 5s</span>
                <span>•</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};