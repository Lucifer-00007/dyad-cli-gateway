import React from 'react';
import { logger } from './logger';
import { analytics } from './analytics';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
      metadata?: Record<string, unknown>;
    };
  };
  version: string;
  environment: string;
}

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  endpoints: {
    backend: string;
    analytics?: string;
    logging?: string;
  };
}

class HealthCheckService {
  private config: HealthCheckConfig;
  private intervalId?: NodeJS.Timeout;
  private lastResult?: HealthCheckResult;
  private isRunning: boolean = false;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = {
      interval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
      timeout: parseInt(import.meta.env.VITE_HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
      retries: parseInt(import.meta.env.VITE_HEALTH_CHECK_RETRIES || '3'),
      endpoints: {
        backend: import.meta.env.VITE_API_BASE_URL || '/api',
        analytics: import.meta.env.VITE_ANALYTICS_ENDPOINT,
        logging: import.meta.env.VITE_LOGGING_ENDPOINT,
      },
      ...config,
    };
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Health check service started', { interval: this.config.interval });

    // Run initial check
    this.runHealthCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runHealthCheck();
    }, this.config.interval);
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Health check service stopped');
  }

  public async runHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    logger.debug('Running health check');

    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: startTime,
      checks: {},
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      environment: import.meta.env.VITE_ENVIRONMENT || 'development',
    };

    // Run all health checks in parallel
    const checkPromises = [
      this.checkBackendHealth(),
      this.checkBrowserHealth(),
      this.checkStorageHealth(),
      this.checkNetworkHealth(),
      this.checkPerformanceHealth(),
    ];

    // Add optional service checks
    if (this.config.endpoints.analytics) {
      checkPromises.push(this.checkAnalyticsHealth());
    }

    if (this.config.endpoints.logging) {
      checkPromises.push(this.checkLoggingHealth());
    }

    const checkResults = await Promise.allSettled(checkPromises);

    // Process results
    checkResults.forEach((checkResult, index) => {
      const checkNames = [
        'backend',
        'browser',
        'storage',
        'network',
        'performance',
        'analytics',
        'logging',
      ];
      
      const checkName = checkNames[index];
      if (!checkName) return;

      if (checkResult.status === 'fulfilled') {
        result.checks[checkName] = checkResult.value;
      } else {
        result.checks[checkName] = {
          status: 'fail',
          message: checkResult.reason?.message || 'Check failed',
        };
      }
    });

    // Determine overall status
    const failedChecks = Object.values(result.checks).filter(check => check.status === 'fail');
    const warnChecks = Object.values(result.checks).filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      result.status = 'unhealthy';
    } else if (warnChecks.length > 0) {
      result.status = 'degraded';
    }

    const duration = Date.now() - startTime;
    logger.info('Health check completed', {
      status: result.status,
      duration,
      failedChecks: failedChecks.length,
      warnChecks: warnChecks.length,
    });

    // Track health status changes
    if (this.lastResult && this.lastResult.status !== result.status) {
      analytics.trackSystemEvent({
        event: 'health_status_changed',
        level: result.status === 'unhealthy' ? 'error' : 'warn',
        data: {
          previousStatus: this.lastResult.status,
          newStatus: result.status,
          failedChecks: failedChecks.map(check => check.message),
        },
      });
    }

    this.lastResult = result;
    return result;
  }

  private async checkBackendHealth(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.endpoints.backend}/health`,
        { method: 'GET' },
        this.config.timeout
      );

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'pass',
          message: 'Backend is healthy',
          duration,
          metadata: data,
        };
      } else {
        return {
          status: 'fail',
          message: `Backend returned ${response.status}`,
          duration,
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Backend check failed',
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkBrowserHealth(): Promise<HealthCheckResult['checks'][string]> {
    const checks = {
      localStorage: typeof Storage !== 'undefined' && !!window.localStorage,
      sessionStorage: typeof Storage !== 'undefined' && !!window.sessionStorage,
      fetch: typeof fetch !== 'undefined',
      webSocket: typeof WebSocket !== 'undefined',
      performanceAPI: typeof performance !== 'undefined',
    };

    const failedChecks = Object.entries(checks)
      .filter(([, supported]) => !supported)
      .map(([feature]) => feature);

    return {
      status: failedChecks.length === 0 ? 'pass' : 'warn',
      message: failedChecks.length === 0 
        ? 'All browser features supported' 
        : `Unsupported features: ${failedChecks.join(', ')}`,
      metadata: checks,
    };
  }

  private async checkStorageHealth(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const testKey = 'dyad-health-check';
      const testValue = Date.now().toString();

      // Test localStorage
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        throw new Error('localStorage read/write failed');
      }

      // Check storage quota
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usagePercent = estimate.usage && estimate.quota 
          ? (estimate.usage / estimate.quota) * 100 
          : 0;

        return {
          status: usagePercent > 90 ? 'warn' : 'pass',
          message: usagePercent > 90 
            ? `Storage usage high: ${usagePercent.toFixed(1)}%`
            : 'Storage is healthy',
          metadata: {
            usage: estimate.usage,
            quota: estimate.quota,
            usagePercent: usagePercent.toFixed(1),
          },
        };
      }

      return {
        status: 'pass',
        message: 'Storage is functional',
      };
    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Storage check failed',
      };
    }
  }

  private async checkNetworkHealth(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();

    try {
      // Check network connectivity
      if (!navigator.onLine) {
        return {
          status: 'fail',
          message: 'Browser reports offline',
        };
      }

      // Test network speed with a small request
      const response = await this.fetchWithTimeout(
        `${this.config.endpoints.backend}/ping`,
        { method: 'HEAD' },
        this.config.timeout
      );

      const duration = Date.now() - startTime;
      const connectionType = (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType;

      return {
        status: duration > 2000 ? 'warn' : 'pass',
        message: duration > 2000 
          ? `Slow network response: ${duration}ms`
          : 'Network is responsive',
        duration,
        metadata: {
          connectionType,
          onLine: navigator.onLine,
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Network check failed',
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkPerformanceHealth(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const memory = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      const checks = {
        memoryUsage: memory ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0,
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
      };

      const warnings = [];
      if (checks.memoryUsage > 80) warnings.push('High memory usage');
      if (checks.loadTime > 3000) warnings.push('Slow page load');
      if (checks.domContentLoaded > 2000) warnings.push('Slow DOM ready');

      return {
        status: warnings.length === 0 ? 'pass' : 'warn',
        message: warnings.length === 0 
          ? 'Performance is good'
          : `Performance issues: ${warnings.join(', ')}`,
        metadata: checks,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Performance metrics unavailable',
      };
    }
  }

  private async checkAnalyticsHealth(): Promise<HealthCheckResult['checks'][string]> {
    if (!this.config.endpoints.analytics) {
      return {
        status: 'warn',
        message: 'Analytics endpoint not configured',
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.endpoints.analytics}/health`,
        { method: 'GET' },
        this.config.timeout
      );

      const duration = Date.now() - startTime;

      return {
        status: response.ok ? 'pass' : 'warn',
        message: response.ok ? 'Analytics service is healthy' : 'Analytics service degraded',
        duration,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Analytics service unavailable',
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkLoggingHealth(): Promise<HealthCheckResult['checks'][string]> {
    if (!this.config.endpoints.logging) {
      return {
        status: 'warn',
        message: 'Logging endpoint not configured',
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.endpoints.logging}/health`,
        { method: 'GET' },
        this.config.timeout
      );

      const duration = Date.now() - startTime;

      return {
        status: response.ok ? 'pass' : 'warn',
        message: response.ok ? 'Logging service is healthy' : 'Logging service degraded',
        duration,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Logging service unavailable',
        duration: Date.now() - startTime,
      };
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  public getLastResult(): HealthCheckResult | undefined {
    return this.lastResult;
  }

  public isHealthy(): boolean {
    return this.lastResult?.status === 'healthy';
  }

  public getFailedChecks(): string[] {
    if (!this.lastResult) return [];
    
    return Object.entries(this.lastResult.checks)
      .filter(([, check]) => check.status === 'fail')
      .map(([name]) => name);
  }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();

// React hook for health monitoring
export const useHealthCheck = () => {
  const [healthStatus, setHealthStatus] = React.useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const runCheck = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await healthCheckService.runHealthCheck();
      setHealthStatus(result);
    } catch (error) {
      logger.error('Failed to run health check', {}, error instanceof Error ? error : undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Get initial status
    const lastResult = healthCheckService.getLastResult();
    if (lastResult) {
      setHealthStatus(lastResult);
    }

    // Start health check service
    healthCheckService.start();

    return () => {
      healthCheckService.stop();
    };
  }, []);

  return {
    healthStatus,
    isLoading,
    runCheck,
    isHealthy: healthCheckService.isHealthy(),
    failedChecks: healthCheckService.getFailedChecks(),
  };
};

// Health status component
export const HealthStatusIndicator: React.FC<{
  className?: string;
  showDetails?: boolean;
}> = ({ className = '', showDetails = false }) => {
  const { healthStatus, isLoading, runCheck } = useHealthCheck();

  if (isLoading) {
    return React.createElement('div', {
      className: `health-status loading ${className}`
    }, [
      React.createElement('span', { className: 'status-indicator', key: 'icon' }, '⏳'),
      React.createElement('span', { key: 'text' }, 'Checking...')
    ]);
  }

  if (!healthStatus) {
    return React.createElement('div', {
      className: `health-status unknown ${className}`
    }, [
      React.createElement('span', { className: 'status-indicator', key: 'icon' }, '❓'),
      React.createElement('span', { key: 'text' }, 'Unknown')
    ]);
  }

  const statusIcons = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌',
  };

  const children = [
    React.createElement('span', { 
      className: 'status-indicator', 
      key: 'icon' 
    }, statusIcons[healthStatus.status]),
    React.createElement('span', { key: 'status' }, healthStatus.status)
  ];

  if (showDetails) {
    const checkElements = Object.entries(healthStatus.checks).map(([name, check]) =>
      React.createElement('div', {
        key: name,
        className: `check ${check.status}`
      }, [
        React.createElement('span', { className: 'check-name', key: 'name' }, name),
        React.createElement('span', { className: 'check-status', key: 'status' }, check.status),
        check.message && React.createElement('span', { 
          className: 'check-message', 
          key: 'message' 
        }, check.message)
      ].filter(Boolean))
    );

    children.push(
      React.createElement('div', { className: 'health-details', key: 'details' }, [
        React.createElement('button', {
          onClick: runCheck,
          className: 'refresh-button',
          key: 'refresh'
        }, '🔄 Refresh'),
        React.createElement('div', { className: 'checks', key: 'checks' }, checkElements)
      ])
    );
  }

  return React.createElement('div', {
    className: `health-status ${healthStatus.status} ${className}`
  }, children);
};

export default healthCheckService;