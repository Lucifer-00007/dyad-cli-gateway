/**
 * Performance monitoring hook for frontend optimization
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  componentRenderTime?: number;
  memoryUsage?: number;
  jsHeapSize?: number;
  
  // Navigation timing
  domContentLoaded?: number;
  loadComplete?: number;
  
  // Resource timing
  resourceCount?: number;
  totalResourceSize?: number;
}

export interface PerformanceEntry {
  timestamp: number;
  metrics: PerformanceMetrics;
  url: string;
  userAgent: string;
}

export const usePerformanceMonitor = (options: {
  enabled?: boolean;
  sampleRate?: number;
  reportInterval?: number;
  onReport?: (entry: PerformanceEntry) => void;
} = {}) => {
  const {
    enabled = true,
    sampleRate = 1.0, // 100% sampling by default
    reportInterval = 30000, // 30 seconds
    onReport,
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [isSupported, setIsSupported] = useState(false);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const reportTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if performance monitoring is supported
  useEffect(() => {
    const supported = 
      typeof window !== 'undefined' &&
      'performance' in window &&
      'PerformanceObserver' in window;
    
    setIsSupported(supported);
  }, []);

  // Initialize performance observers
  useEffect(() => {
    if (!enabled || !isSupported || Math.random() > sampleRate) {
      return;
    }

    const updateMetrics = (newMetrics: Partial<PerformanceMetrics>) => {
      setMetrics(prev => ({ ...prev, ...newMetrics }));
    };

    // Observe Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry) {
            updateMetrics({ lcp: lastEntry.startTime });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID Observer
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            updateMetrics({ fid: entry.processingStart - entry.startTime });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS Observer
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          updateMetrics({ cls: clsValue });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Navigation timing
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navigationEntries.length > 0) {
          const nav = navigationEntries[0];
          updateMetrics({
            fcp: nav.responseStart - nav.fetchStart,
            ttfb: nav.responseStart - nav.requestStart,
            domContentLoaded: nav.domContentLoadedEventEnd - nav.navigationStart,
            loadComplete: nav.loadEventEnd - nav.navigationStart,
          });
        }

        // Resource timing
        const resourceEntries = performance.getEntriesByType('resource');
        const totalSize = resourceEntries.reduce((sum, entry: any) => {
          return sum + (entry.transferSize || 0);
        }, 0);
        
        updateMetrics({
          resourceCount: resourceEntries.length,
          totalResourceSize: totalSize,
        });

        observerRef.current = lcpObserver; // Keep reference for cleanup
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error);
      }
    }

    // Memory usage monitoring
    const updateMemoryMetrics = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        updateMetrics({
          memoryUsage: memory.usedJSHeapSize,
          jsHeapSize: memory.totalJSHeapSize,
        });
      }
    };

    updateMemoryMetrics();
    const memoryInterval = setInterval(updateMemoryMetrics, 5000);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      clearInterval(memoryInterval);
    };
  }, [enabled, isSupported, sampleRate]);

  // Periodic reporting
  useEffect(() => {
    if (!enabled || !onReport) return;

    const report = () => {
      const entry: PerformanceEntry = {
        timestamp: Date.now(),
        metrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      onReport(entry);
    };

    reportTimerRef.current = setInterval(report, reportInterval);

    return () => {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current);
      }
    };
  }, [enabled, metrics, onReport, reportInterval]);

  // Component render time measurement
  const measureRenderTime = useCallback((componentName: string) => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({
        ...prev,
        componentRenderTime: renderTime,
      }));
      
      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }, []);

  // Manual metric recording
  const recordMetric = useCallback((key: keyof PerformanceMetrics, value: number) => {
    setMetrics(prev => ({ ...prev, [key]: value }));
  }, []);

  // Get performance score (0-100)
  const getPerformanceScore = useCallback((): number => {
    let score = 100;
    
    // Deduct points for poor Core Web Vitals
    if (metrics.lcp && metrics.lcp > 2500) score -= 20;
    if (metrics.fid && metrics.fid > 100) score -= 20;
    if (metrics.cls && metrics.cls > 0.1) score -= 20;
    if (metrics.fcp && metrics.fcp > 1800) score -= 15;
    if (metrics.ttfb && metrics.ttfb > 600) score -= 15;
    
    // Deduct points for high memory usage
    if (metrics.memoryUsage && metrics.jsHeapSize) {
      const memoryRatio = metrics.memoryUsage / metrics.jsHeapSize;
      if (memoryRatio > 0.8) score -= 10;
    }
    
    return Math.max(0, score);
  }, [metrics]);

  // Get performance recommendations
  const getRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];
    
    if (metrics.lcp && metrics.lcp > 2500) {
      recommendations.push('Optimize Largest Contentful Paint by reducing server response times and optimizing critical resources');
    }
    
    if (metrics.fid && metrics.fid > 100) {
      recommendations.push('Reduce First Input Delay by minimizing JavaScript execution time');
    }
    
    if (metrics.cls && metrics.cls > 0.1) {
      recommendations.push('Improve Cumulative Layout Shift by setting dimensions for images and ads');
    }
    
    if (metrics.fcp && metrics.fcp > 1800) {
      recommendations.push('Optimize First Contentful Paint by reducing render-blocking resources');
    }
    
    if (metrics.ttfb && metrics.ttfb > 600) {
      recommendations.push('Reduce Time to First Byte by optimizing server performance');
    }
    
    if (metrics.resourceCount && metrics.resourceCount > 100) {
      recommendations.push('Reduce the number of HTTP requests by bundling resources');
    }
    
    if (metrics.totalResourceSize && metrics.totalResourceSize > 2000000) {
      recommendations.push('Reduce total resource size by compressing images and minifying code');
    }
    
    return recommendations;
  }, [metrics]);

  return {
    metrics,
    isSupported,
    measureRenderTime,
    recordMetric,
    getPerformanceScore,
    getRecommendations,
  };
};

// HOC for measuring component render time
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    const { measureRenderTime } = usePerformanceMonitor();
    const endMeasurement = useRef<(() => void) | null>(null);

    useEffect(() => {
      endMeasurement.current = measureRenderTime(componentName || Component.name);
      
      return () => {
        endMeasurement.current?.();
      };
    });

    return <Component {...props} />;
  };
}

// Hook for measuring async operations
export const useAsyncPerformance = () => {
  const { recordMetric } = usePerformanceMonitor();

  const measureAsync = useCallback(async <T>(
    operation: () => Promise<T>,
    metricName: string
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      recordMetric('componentRenderTime', duration);
      
      // Log slow operations in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow async operation detected (${metricName}): ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`Async operation failed (${metricName}) after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, [recordMetric]);

  return { measureAsync };
};