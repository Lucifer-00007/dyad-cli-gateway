/**
 * Monitoring feature types
 */

export interface MonitoringTimeRange {
  start: Date;
  end: Date;
  label: string;
}

export interface AlertConfig {
  id: string;
  type: 'error_rate' | 'latency' | 'requests' | 'provider_health';
  threshold: number;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MetricAlert {
  id: string;
  type: AlertConfig['type'];
  threshold: number;
  currentValue: number;
  status: 'ok' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  providerId?: string;
  providerName?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface LogFilter {
  level?: string[];
  source?: string[];
  providerId?: string;
  search?: string;
  timeRange?: MonitoringTimeRange;
}

export interface StreamingLogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  providerId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  status: 'good' | 'warning' | 'critical';
}

export interface ErrorAnalysis {
  errorType: string;
  errorCode: string;
  count: number;
  percentage: number;
  lastOccurrence: string;
  affectedProviders: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
  samples: Array<{
    timestamp: string;
    message: string;
    providerId?: string;
    requestId?: string;
  }>;
}