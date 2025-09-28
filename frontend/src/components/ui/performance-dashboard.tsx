/**
 * Performance monitoring dashboard component
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Zap,
  Clock,
  MemoryStick,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { usePerformanceMonitor, PerformanceMetrics } from '@/hooks/use-performance-monitor';

export interface PerformanceDashboardProps {
  className?: string;
  showRecommendations?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className,
  showRecommendations = true,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const {
    metrics,
    isSupported,
    getPerformanceScore,
    getRecommendations,
  } = usePerformanceMonitor({
    enabled: true,
    reportInterval: refreshInterval,
  });

  const [lastUpdated, setLastUpdated] = React.useState(new Date());

  React.useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastUpdated(new Date());
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (!isSupported) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Performance monitoring is not supported in this browser.
        </AlertDescription>
      </Alert>
    );
  }

  const performanceScore = getPerformanceScore();
  const recommendations = getRecommendations();

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 70) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  const formatMetric = (value: number | undefined, unit: string = 'ms') => {
    if (value === undefined) return 'N/A';
    return `${value.toFixed(1)}${unit}`;
  };

  const formatBytes = (bytes: number | undefined) => {
    if (bytes === undefined) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLastUpdated(new Date())}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Performance Score */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getScoreIcon(performanceScore)}
            <span>Overall Performance Score</span>
          </CardTitle>
          <CardDescription>
            Based on Core Web Vitals and custom metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Progress value={performanceScore} className="h-3" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}/100
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Largest Contentful Paint"
          value={formatMetric(metrics.lcp)}
          icon={<Clock className="h-4 w-4" />}
          threshold={{ good: 2500, poor: 4000 }}
          currentValue={metrics.lcp}
          description="Time to render the largest content element"
        />
        <MetricCard
          title="First Input Delay"
          value={formatMetric(metrics.fid)}
          icon={<Zap className="h-4 w-4" />}
          threshold={{ good: 100, poor: 300 }}
          currentValue={metrics.fid}
          description="Time from first user interaction to browser response"
        />
        <MetricCard
          title="Cumulative Layout Shift"
          value={formatMetric(metrics.cls, '')}
          icon={<Activity className="h-4 w-4" />}
          threshold={{ good: 0.1, poor: 0.25 }}
          currentValue={metrics.cls}
          description="Visual stability of the page"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="First Contentful Paint"
          value={formatMetric(metrics.fcp)}
          icon={<TrendingUp className="h-4 w-4" />}
          threshold={{ good: 1800, poor: 3000 }}
          currentValue={metrics.fcp}
        />
        <MetricCard
          title="Time to First Byte"
          value={formatMetric(metrics.ttfb)}
          icon={<Clock className="h-4 w-4" />}
          threshold={{ good: 600, poor: 1500 }}
          currentValue={metrics.ttfb}
        />
        <MetricCard
          title="Memory Usage"
          value={formatBytes(metrics.memoryUsage)}
          icon={<MemoryStick className="h-4 w-4" />}
          description="JavaScript heap memory usage"
        />
        <MetricCard
          title="Resource Count"
          value={metrics.resourceCount?.toString() || 'N/A'}
          icon={<Activity className="h-4 w-4" />}
          description="Total number of loaded resources"
        />
      </div>

      {/* Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Performance Recommendations</span>
            </CardTitle>
            <CardDescription>
              Suggestions to improve your application's performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  threshold?: { good: number; poor: number };
  currentValue?: number;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  threshold,
  currentValue,
  description,
}) => {
  const getStatus = () => {
    if (!threshold || currentValue === undefined) return 'neutral';
    if (currentValue <= threshold.good) return 'good';
    if (currentValue <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'needs-improvement':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'good':
        return <Badge className="bg-green-100 text-green-800">Good</Badge>;
      case 'needs-improvement':
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Improvement</Badge>;
      case 'poor':
        return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
      default:
        return null;
    }
  };

  const status = getStatus();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
          </div>
          {getStatusBadge(status)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getStatusColor(status)}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};