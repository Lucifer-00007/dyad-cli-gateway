import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';
import { reportError } from './sentry';

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
}

export interface PerformanceThresholds {
  CLS: { good: number; poor: number };
  FID: { good: number; poor: number };
  FCP: { good: number; poor: number };
  LCP: { good: number; poor: number };
  TTFB: { good: number; poor: number };
}

// Web Vitals thresholds (in milliseconds, except CLS which is unitless)
const THRESHOLDS: PerformanceThresholds = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = import.meta.env.VITE_PERFORMANCE_MONITORING !== 'false';
    
    if (this.isEnabled) {
      this.initializeWebVitals();
      this.initializeCustomMetrics();
    }
  }

  private initializeWebVitals(): void {
    // Collect Core Web Vitals
    getCLS(this.handleMetric.bind(this));
    getFID(this.handleMetric.bind(this));
    getFCP(this.handleMetric.bind(this));
    getLCP(this.handleMetric.bind(this));
    getTTFB(this.handleMetric.bind(this));
  }

  private initializeCustomMetrics(): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.recordCustomMetric('long-task', entry.duration, {
                startTime: entry.startTime,
                name: entry.name,
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }

      // Monitor navigation timing
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordCustomMetric('dom-content-loaded', 
                navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart);
              this.recordCustomMetric('load-complete', 
                navEntry.loadEventEnd - navEntry.loadEventStart);
            }
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation observer not supported:', error);
      }

      // Monitor resource loading
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              
              // Track slow resources (>1s)
              if (resourceEntry.duration > 1000) {
                this.recordCustomMetric('slow-resource', resourceEntry.duration, {
                  name: resourceEntry.name,
                  type: resourceEntry.initiatorType,
                });
              }
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource observer not supported:', error);
      }
    }
  }

  private handleMetric(metric: Metric): void {
    const rating = this.getRating(metric.name as keyof PerformanceThresholds, metric.value);
    
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.metrics.push(performanceMetric);
    this.reportMetric(performanceMetric);

    // Log poor performance metrics
    if (rating === 'poor') {
      console.warn(`Poor ${metric.name} performance:`, metric.value);
    }
  }

  private getRating(metricName: keyof PerformanceThresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = THRESHOLDS[metricName];
    if (!thresholds) return 'good';

    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }

  private recordCustomMetric(name: string, value: number, context?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      rating: 'good', // Custom metrics don't have predefined ratings
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.metrics.push(metric);
    this.reportMetric(metric, context);
  }

  private reportMetric(metric: PerformanceMetric, context?: Record<string, unknown>): void {
    // Send to analytics service
    this.sendToAnalytics(metric, context);

    // Send to Sentry for performance monitoring
    if (import.meta.env.VITE_SENTRY_DSN) {
      try {
        // Use Sentry's performance monitoring
        const sentryHub = (window as { __SENTRY__?: { hub?: { getScope?: () => { getTransaction?: () => { setMeasurement?: (name: string, value: number, unit: string) => void } } } } }).__SENTRY__;
        const transaction = sentryHub?.hub?.getScope?.()?.getTransaction?.();
        if (transaction?.setMeasurement) {
          transaction.setMeasurement(metric.name, metric.value, 'millisecond');
        }
      } catch (error) {
        console.warn('Failed to report metric to Sentry:', error);
      }
    }
  }

  private sendToAnalytics(metric: PerformanceMetric, context?: Record<string, unknown>): void {
    // Send to backend analytics endpoint
    const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
    
    if (analyticsEndpoint) {
      fetch(`${analyticsEndpoint}/performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...metric,
          context,
          sessionId: this.getSessionId(),
        }),
      }).catch((error) => {
        console.warn('Failed to send performance metric:', error);
      });
    }

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.log(`Performance metric: ${metric.name}`, {
        value: metric.value,
        rating: metric.rating,
        context,
      });
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('dyad-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('dyad-session-id', sessionId);
    }
    return sessionId;
  }

  // Public methods
  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name === name);
  }

  public getAverageMetric(name: string): number | null {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return null;
    
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public measureFunction<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordCustomMetric(`function-${name}`, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordCustomMetric(`function-${name}-error`, duration);
      throw error;
    }
  }

  public async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordCustomMetric(`async-function-${name}`, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordCustomMetric(`async-function-${name}-error`, duration);
      throw error;
    }
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const measureRender = (componentName: string) => {
    return performanceMonitor.measureFunction(`render-${componentName}`, () => {
      // This will be called by the component
    });
  };

  const measureAsyncOperation = async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    return performanceMonitor.measureAsyncFunction(operationName, operation);
  };

  const getComponentMetrics = (componentName: string) => {
    return performanceMonitor.getMetricsByName(`render-${componentName}`);
  };

  return {
    measureRender,
    measureAsyncOperation,
    getComponentMetrics,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    clearMetrics: performanceMonitor.clearMetrics.bind(performanceMonitor),
  };
};

// HOC for measuring component render performance
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const MeasuredComponent = (props: P) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const endTime = performance.now();
      performanceMonitor.recordCustomMetric(`component-mount-${displayName}`, endTime - startTime);
    }, [startTime]);

    return React.createElement(WrappedComponent, props);
  };

  MeasuredComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return MeasuredComponent;
};

export default performanceMonitor;