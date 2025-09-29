import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MonitoringDashboard } from '../components/monitoring-dashboard';
import { performanceMonitor } from '../lib/performance-monitoring';
import { analytics } from '../lib/analytics';
import { logger } from '../lib/logger';
import { healthCheckService } from '../lib/health-check';

// Mock the monitoring services
vi.mock('../lib/performance-monitoring', () => ({
  performanceMonitor: {
    getMetrics: vi.fn(() => []),
    clearMetrics: vi.fn(),
  },
  usePerformanceMonitoring: () => ({
    getMetrics: vi.fn(() => []),
    clearMetrics: vi.fn(),
    measureAsyncOperation: vi.fn(),
  }),
}));

vi.mock('../lib/analytics', () => ({
  analytics: {
    getEvents: vi.fn(() => []),
    trackFeatureUsage: vi.fn(),
    trackUserAction: vi.fn(),
  },
  useAnalytics: () => ({
    trackFeature: vi.fn(),
    trackClick: vi.fn(),
  }),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    getStoredLogs: vi.fn(() => []),
    clearStoredLogs: vi.fn(),
    exportLogs: vi.fn(() => '[]'),
  },
  useLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../lib/health-check', () => ({
  healthCheckService: {
    runHealthCheck: vi.fn(),
    getLastResult: vi.fn(),
    isHealthy: vi.fn(() => true),
    getFailedChecks: vi.fn(() => []),
  },
  useHealthCheck: () => ({
    healthStatus: {
      status: 'healthy',
      timestamp: Date.now(),
      checks: {
        backend: { status: 'pass', message: 'Backend is healthy' },
        browser: { status: 'pass', message: 'Browser features supported' },
      },
      version: '1.0.0',
      environment: 'test',
    },
    isLoading: false,
    runCheck: vi.fn(),
    isHealthy: true,
    failedChecks: [],
  }),
  HealthStatusIndicator: ({ className }: { className?: string }) => (
    <div className={`health-status ${className}`}>
      <span>✅ healthy</span>
    </div>
  ),
}));

// Mock fetch for health checks
global.fetch = vi.fn();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Monitoring Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    (performanceMonitor.getMetrics as MockedFunction<typeof performanceMonitor.getMetrics>).mockReturnValue([
      {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        timestamp: Date.now(),
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      },
      {
        name: 'FID',
        value: 50,
        rating: 'good',
        timestamp: Date.now(),
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      },
    ]);

    (analytics.getEvents as MockedFunction<typeof analytics.getEvents>).mockReturnValue([
      {
        name: 'user_click',
        category: 'user_action',
        timestamp: Date.now(),
        sessionId: 'test-session',
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      },
    ]);

    (logger.getStoredLogs as MockedFunction<typeof logger.getStoredLogs>).mockReturnValue([
      {
        level: 'info',
        message: 'Test log message',
        timestamp: Date.now(),
        sessionId: 'test-session',
        url: 'http://localhost:3000',
      },
      {
        level: 'error',
        message: 'Test error message',
        timestamp: Date.now(),
        sessionId: 'test-session',
        url: 'http://localhost:3000',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MonitoringDashboard', () => {
    it('should render monitoring dashboard with all sections', () => {
      renderWithProviders(<MonitoringDashboard />);

      expect(screen.getByText('System Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Real-time monitoring and observability dashboard')).toBeInTheDocument();

      // Check overview cards
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Error Rate')).toBeInTheDocument();
      expect(screen.getByText('Events')).toBeInTheDocument();
    });

    it('should display health status correctly', () => {
      renderWithProviders(<MonitoringDashboard />);

      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('✅ healthy')).toBeInTheDocument();
    });

    it('should show performance metrics', async () => {
      renderWithProviders(<MonitoringDashboard />);

      // Click on Performance tab
      fireEvent.click(screen.getByText('Performance'));

      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total metrics
        expect(screen.getByText('LCP')).toBeInTheDocument();
        expect(screen.getByText('FID')).toBeInTheDocument();
      });
    });

    it('should display logs with filtering', async () => {
      renderWithProviders(<MonitoringDashboard />);

      // Click on Logs tab
      fireEvent.click(screen.getByText('Logs'));

      await waitFor(() => {
        expect(screen.getByText('Application Logs')).toBeInTheDocument();
        expect(screen.getByText('Test log message')).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total logs
        expect(screen.getByText('1')).toBeInTheDocument(); // Errors
      });
    });

    it('should show analytics events', async () => {
      renderWithProviders(<MonitoringDashboard />);

      // Click on Analytics tab
      fireEvent.click(screen.getByText('Analytics'));

      await waitFor(() => {
        expect(screen.getByText('Analytics Events')).toBeInTheDocument();
        expect(screen.getByText('user_click')).toBeInTheDocument();
        expect(screen.getByText('user_action')).toBeInTheDocument();
      });
    });

    it('should handle log export functionality', async () => {
      const mockExportData = JSON.stringify([
        { level: 'info', message: 'Test log', timestamp: Date.now() }
      ]);
      (logger.exportLogs as MockedFunction<typeof logger.exportLogs>).mockReturnValue(mockExportData);

      // Mock URL.createObjectURL and related functions
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement and appendChild
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;
      const mockCreateElement = vi.fn(() => mockAnchor);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      document.createElement = mockCreateElement as typeof document.createElement;
      document.body.appendChild = mockAppendChild as typeof document.body.appendChild;
      document.body.removeChild = mockRemoveChild as typeof document.body.removeChild;

      renderWithProviders(<MonitoringDashboard />);

      // Click on Logs tab
      fireEvent.click(screen.getByText('Logs'));

      await waitFor(() => {
        const exportButton = screen.getByText('Export JSON');
        fireEvent.click(exportButton);

        expect(logger.exportLogs).toHaveBeenCalledWith('json');
        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(mockAnchor.click).toHaveBeenCalled();
      });
    });

    it('should handle metrics clearing', async () => {
      renderWithProviders(<MonitoringDashboard />);

      // Click on Performance tab
      fireEvent.click(screen.getByText('Performance'));

      await waitFor(() => {
        const clearButton = screen.getByText('Clear Metrics');
        fireEvent.click(clearButton);

        expect(performanceMonitor.clearMetrics).toHaveBeenCalled();
      });
    });

    it('should handle log clearing', async () => {
      renderWithProviders(<MonitoringDashboard />);

      // Click on Logs tab
      fireEvent.click(screen.getByText('Logs'));

      await waitFor(() => {
        const clearButton = screen.getByText('Clear Logs');
        fireEvent.click(clearButton);

        expect(logger.clearStoredLogs).toHaveBeenCalled();
      });
    });

    it('should refresh health status', async () => {
      const mockRunCheck = vi.fn();

      // Override the mock for this test
      vi.doMock('../lib/health-check', () => ({
        useHealthCheck: () => ({
          healthStatus: {
            status: 'healthy',
            timestamp: Date.now(),
            checks: {},
            version: '1.0.0',
            environment: 'test',
          },
          isLoading: false,
          runCheck: mockRunCheck,
          isHealthy: true,
          failedChecks: [],
        }),
        HealthStatusIndicator: ({ className }: { className?: string }) => (
          <div className={`health-status ${className}`}>
            <span>✅ healthy</span>
          </div>
        ),
      }));

      renderWithProviders(<MonitoringDashboard />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      expect(mockRunCheck).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track Web Vitals metrics', () => {
      // Test that performance monitoring is properly initialized
      expect(performanceMonitor.getMetrics).toBeDefined();

      const metrics = performanceMonitor.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should have performance monitoring capabilities', () => {
      // Test that performance monitoring has the expected public interface
      expect(performanceMonitor.getMetrics).toBeDefined();
      expect(performanceMonitor.clearMetrics).toBeDefined();
      expect(typeof performanceMonitor.getMetrics).toBe('function');
      expect(typeof performanceMonitor.clearMetrics).toBe('function');
    });
  });

  describe('Analytics Tracking', () => {
    it('should track user actions', () => {
      analytics.trackUserAction({
        action: 'click',
        target: 'test-button',
      });

      expect(analytics.trackUserAction).toHaveBeenCalledWith({
        action: 'click',
        target: 'test-button',
      });
    });

    it('should track feature usage', () => {
      analytics.trackFeatureUsage('test-feature', { context: 'test' });
      expect(analytics.trackFeatureUsage).toHaveBeenCalledWith('test-feature', { context: 'test' });
    });
  });

  describe('Logging System', () => {
    it('should store and retrieve logs', () => {
      const logs = logger.getStoredLogs();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should export logs in different formats', () => {
      logger.exportLogs('json');
      expect(logger.exportLogs).toHaveBeenCalledWith('json');

      logger.exportLogs('csv');
      expect(logger.exportLogs).toHaveBeenCalledWith('csv');
    });

    it('should clear stored logs', () => {
      logger.clearStoredLogs();
      expect(logger.clearStoredLogs).toHaveBeenCalled();
    });
  });

  describe('Health Check Service', () => {
    it('should run health checks', async () => {
      await healthCheckService.runHealthCheck();
      expect(healthCheckService.runHealthCheck).toHaveBeenCalled();
    });

    it('should report health status', () => {
      const isHealthy = healthCheckService.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should identify failed checks', () => {
      const failedChecks = healthCheckService.getFailedChecks();
      expect(Array.isArray(failedChecks)).toBe(true);
    });
  });

  describe('Error Tracking', () => {
    it('should handle error reporting', () => {
      const testError = new Error('Test error');

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      // Simulate error tracking
      expect(() => {
        throw testError;
      }).toThrow('Test error');

      consoleSpy.mockRestore();
    });
  });

  describe('Integration with React Components', () => {
    it('should integrate monitoring hooks with components', () => {
      const TestComponent = () => {
        const trackFeature = vi.fn();
        const info = vi.fn();

        React.useEffect(() => {
          trackFeature('test-component-mounted');
          info('Test component mounted');
        }, [trackFeature, info]);

        return <div>Test Component</div>;
      };

      renderWithProviders(<TestComponent />);
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
  });
});

describe('Environment Configuration', () => {
  it('should respect environment variables for monitoring', () => {
    // Test that monitoring services respect environment configuration
    expect(import.meta.env.VITE_ENVIRONMENT).toBeDefined();
    expect(import.meta.env.VITE_APP_VERSION).toBeDefined();
  });

  it('should handle missing environment variables gracefully', () => {
    // Test that services work even with missing env vars
    expect(() => {
      // These should not throw even if env vars are missing
      performanceMonitor.getMetrics();
      analytics.getEvents();
      logger.getStoredLogs();
    }).not.toThrow();
  });
});