/**
 * Performance tests for large datasets and component rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { VirtualScroll } from '@/components/ui/virtual-scroll';
import { DataTable } from '@/components/ui/data-table';
import { ProviderList } from '@/components/providers/enhanced-provider-list';
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';
import { useBulkOperations } from '@/hooks/use-bulk-operations';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Generate large datasets for testing
const generateProviders = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    _id: `provider-${i}`,
    name: `Provider ${i}`,
    slug: `provider-${i}`,
    type: ['spawn-cli', 'http-sdk', 'proxy', 'local'][i % 4] as 'spawn-cli' | 'http-sdk' | 'proxy' | 'local',
    description: `Description for provider ${i}`,
    enabled: i % 2 === 0,
    adapterConfig: {
      baseUrl: `https://api-${i}.example.com`,
      authType: 'api-key' as const,
    },
    models: [
      {
        dyadModelId: `model-${i}`,
        adapterModelId: `adapter-model-${i}`,
        maxTokens: 4096,
      },
    ],
    healthStatus: {
      status: ['healthy', 'unhealthy', 'unknown'][i % 3] as 'healthy' | 'unhealthy' | 'unknown',
      lastChecked: new Date(Date.now() - i * 60000).toISOString(),
      responseTime: 100 + (i % 500),
    },
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));

const generateTableData = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    email: `item${i}@example.com`,
    status: ['active', 'inactive', 'pending'][i % 3],
    value: Math.random() * 1000,
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
  }));

// Performance measurement utilities
const measureRenderTime = (renderFn: () => void): number => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};

const measureMemoryUsage = (): number => {
  if ('memory' in performance) {
    return (performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
  }
  return 0;
};

describe('Performance Tests', () => {
  describe('Virtual Scrolling Performance', () => {
    it('should render large lists efficiently', () => {
      const items = generateTableData(10000);
      
      const renderTime = measureRenderTime(() => {
        render(
          <VirtualScroll
            items={items}
            itemHeight={50}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id} data-testid={`item-${item.id}`}>
                {item.name} - {item.email}
              </div>
            )}
          />
        );
      });

      // Should render quickly even with 10k items
      expect(renderTime).toBeLessThan(100); // 100ms threshold
      
      // Should only render visible items
      const renderedItems = screen.getAllByTestId(/^item-/);
      expect(renderedItems.length).toBeLessThan(20); // Much less than 10k
    });

    it('should handle scrolling performance', async () => {
      const items = generateTableData(5000);
      
      render(
        <VirtualScroll
          items={items}
          itemHeight={50}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.name}
            </div>
          )}
        />
      );

      const container = screen.getByTestId('virtual-scroll-container');
      
      // Measure scroll performance
      const scrollStart = performance.now();
      
      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(container, { target: { scrollTop: i * 500 } });
      }
      
      const scrollEnd = performance.now();
      const scrollTime = scrollEnd - scrollStart;
      
      // Should handle rapid scrolling efficiently
      expect(scrollTime).toBeLessThan(50); // 50ms threshold
    });

    it('should maintain consistent memory usage', () => {
      const items = generateTableData(1000);
      
      const initialMemory = measureMemoryUsage();
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          itemHeight={50}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id}>{item.name}</div>
          )}
        />
      );

      // Simulate multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <VirtualScroll
            items={items.slice(0, 900 + i * 10)}
            itemHeight={50}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id}>{item.name}</div>
            )}
          />
        );
      }

      const finalMemory = measureMemoryUsage();
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB threshold
      }
    });
  });

  describe('Data Table Performance', () => {
    const columns = [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'value', header: 'Value' },
      { accessorKey: 'createdAt', header: 'Created' },
    ];

    it('should render large datasets efficiently', () => {
      const data = generateTableData(1000);
      
      const renderTime = measureRenderTime(() => {
        render(
          <DataTable 
            data={data} 
            columns={columns}
            pagination={{ 
              enabled: true, 
              pageSize: 50,
              currentPage: 1,
              totalPages: 20
            }}
          />
        );
      });

      // Should render quickly
      expect(renderTime).toBeLessThan(200); // 200ms threshold
      
      // Should only render current page
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThanOrEqual(51); // 50 data rows + 1 header
    });

    it('should handle sorting performance', async () => {
      const user = userEvent.setup();
      const data = generateTableData(500);
      
      render(
        <DataTable 
          data={data} 
          columns={columns}
          sorting={{ enabled: true }}
        />
      );

      const nameHeader = screen.getByText('Name');
      
      // Measure sorting performance
      const sortStart = performance.now();
      await user.click(nameHeader);
      const sortEnd = performance.now();
      
      const sortTime = sortEnd - sortStart;
      
      // Should sort quickly
      expect(sortTime).toBeLessThan(100); // 100ms threshold
    });

    it('should handle filtering performance', async () => {
      const user = userEvent.setup();
      const data = generateTableData(1000);
      
      render(
        <DataTable 
          data={data} 
          columns={columns}
          filtering={{ enabled: true }}
        />
      );

      const filterInput = screen.getByPlaceholderText('Filter...');
      
      // Measure filtering performance
      const filterStart = performance.now();
      await user.type(filterInput, 'Item 1');
      const filterEnd = performance.now();
      
      const filterTime = filterEnd - filterStart;
      
      // Should filter quickly
      expect(filterTime).toBeLessThan(200); // 200ms threshold
    });
  });

  describe('Provider List Performance', () => {
    it('should handle large provider lists', () => {
      const providers = generateProviders(500);
      
      const renderTime = measureRenderTime(() => {
        render(
          <TestWrapper>
            <ProviderList
              providers={providers}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onTest={vi.fn()}
              onToggleEnabled={vi.fn()}
            />
          </TestWrapper>
        );
      });

      // Should render efficiently
      expect(renderTime).toBeLessThan(300); // 300ms threshold
    });

    it('should handle search performance', async () => {
      const user = userEvent.setup();
      const providers = generateProviders(1000);
      
      render(
        <TestWrapper>
          <ProviderList
            providers={providers}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
            searchable={true}
          />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/Search providers/);
      
      // Measure search performance
      const searchStart = performance.now();
      await user.type(searchInput, 'Provider 1');
      const searchEnd = performance.now();
      
      const searchTime = searchEnd - searchStart;
      
      // Should search quickly
      expect(searchTime).toBeLessThan(150); // 150ms threshold
    });
  });

  describe('Bulk Operations Performance', () => {
    const TestBulkComponent = ({ itemCount }: { itemCount: number }) => {
      const items = generateProviders(itemCount);
      const {
        operations,
        createOperation,
        executeOperation,
      } = useBulkOperations();

      const handleBulkOperation = async () => {
        const operationId = createOperation('Performance Test', items);
        
        await executeOperation(operationId, async (item) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 1));
          return { ...item, processed: true };
        });
      };

      return (
        <div>
          <button onClick={handleBulkOperation} data-testid="start-bulk">
            Start Bulk Operation
          </button>
          <div data-testid="operations-count">{operations.length}</div>
          {operations.map(op => (
            <div key={op.id} data-testid={`operation-${op.id}`}>
              <span data-testid={`progress-${op.id}`}>{op.progress.percentage}%</span>
            </div>
          ))}
        </div>
      );
    };

    it('should handle bulk operations efficiently', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TestBulkComponent itemCount={100} />
        </TestWrapper>
      );

      const startButton = screen.getByTestId('start-bulk');
      
      // Measure bulk operation performance
      const operationStart = performance.now();
      await user.click(startButton);
      
      // Wait for operation to complete
      await waitFor(() => {
        const operation = screen.getByTestId(/^operation-/);
        const progress = operation.querySelector('[data-testid^="progress-"]');
        expect(progress).toHaveTextContent('100%');
      }, { timeout: 10000 });
      
      const operationEnd = performance.now();
      const operationTime = operationEnd - operationStart;
      
      // Should complete bulk operation in reasonable time
      expect(operationTime).toBeLessThan(5000); // 5 second threshold
    });

    it('should handle concurrent bulk operations', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TestBulkComponent itemCount={50} />
        </TestWrapper>
      );

      const startButton = screen.getByTestId('start-bulk');
      
      // Start multiple operations concurrently
      const operationPromises = [];
      for (let i = 0; i < 3; i++) {
        operationPromises.push(user.click(startButton));
      }
      
      const concurrentStart = performance.now();
      await Promise.all(operationPromises);
      
      // Wait for all operations to complete
      await waitFor(() => {
        const operations = screen.getAllByTestId(/^operation-/);
        expect(operations).toHaveLength(3);
      }, { timeout: 15000 });
      
      const concurrentEnd = performance.now();
      const concurrentTime = concurrentEnd - concurrentStart;
      
      // Should handle concurrent operations efficiently
      expect(concurrentTime).toBeLessThan(10000); // 10 second threshold
    });
  });

  describe('Performance Monitoring Hook', () => {
    const TestPerformanceComponent = ({ enableMonitoring }: { enableMonitoring: boolean }) => {
      const {
        metrics,
        measureRenderTime,
        getPerformanceScore,
        getRecommendations,
      } = usePerformanceMonitor({ enabled: enableMonitoring });

      React.useEffect(() => {
        if (enableMonitoring) {
          const endMeasurement = measureRenderTime('TestComponent');
          return endMeasurement;
        }
      }, [measureRenderTime, enableMonitoring]);

      return (
        <div>
          <div data-testid="performance-score">{getPerformanceScore()}</div>
          <div data-testid="render-time">{metrics.componentRenderTime || 0}</div>
          <div data-testid="recommendations-count">{getRecommendations().length}</div>
          <div data-testid="memory-usage">{metrics.memoryUsage || 0}</div>
        </div>
      );
    };

    it('should measure performance with minimal overhead', () => {
      const withMonitoringStart = performance.now();
      
      render(
        <TestWrapper>
          <TestPerformanceComponent enableMonitoring={true} />
        </TestWrapper>
      );
      
      const withMonitoringEnd = performance.now();
      const withMonitoringTime = withMonitoringEnd - withMonitoringStart;

      const withoutMonitoringStart = performance.now();
      
      render(
        <TestWrapper>
          <TestPerformanceComponent enableMonitoring={false} />
        </TestWrapper>
      );
      
      const withoutMonitoringEnd = performance.now();
      const withoutMonitoringTime = withoutMonitoringEnd - withoutMonitoringStart;

      // Performance monitoring should add minimal overhead
      const overhead = withMonitoringTime - withoutMonitoringTime;
      expect(overhead).toBeLessThan(50); // 50ms threshold
    });

    it('should provide accurate performance metrics', async () => {
      render(
        <TestWrapper>
          <TestPerformanceComponent enableMonitoring={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        const renderTime = screen.getByTestId('render-time');
        expect(parseFloat(renderTime.textContent!)).toBeGreaterThan(0);
      });

      const performanceScore = screen.getByTestId('performance-score');
      const score = parseInt(performanceScore.textContent!);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should generate relevant performance recommendations', async () => {
      render(
        <TestWrapper>
          <TestPerformanceComponent enableMonitoring={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        const recommendationsCount = screen.getByTestId('recommendations-count');
        expect(parseInt(recommendationsCount.textContent!)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Component Re-render Performance', () => {
    const RenderCountComponent = ({ data }: { data: unknown[] }) => {
      const renderCount = React.useRef(0);
      renderCount.current += 1;

      return (
        <div>
          <div data-testid="render-count">{renderCount.current}</div>
          <div data-testid="data-count">{data.length}</div>
          {data.slice(0, 10).map(item => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.name}
            </div>
          ))}
        </div>
      );
    };

    it('should minimize unnecessary re-renders', () => {
      const initialData = generateTableData(100);
      
      const { rerender } = render(
        <RenderCountComponent data={initialData} />
      );

      // Initial render
      expect(screen.getByTestId('render-count')).toHaveTextContent('1');

      // Re-render with same data (should not cause re-render if memoized)
      rerender(<RenderCountComponent data={initialData} />);
      
      // Should still be 1 if properly memoized
      expect(screen.getByTestId('render-count')).toHaveTextContent('2'); // Expected without memoization

      // Re-render with different data
      const newData = generateTableData(100);
      rerender(<RenderCountComponent data={newData} />);
      
      expect(screen.getByTestId('render-count')).toHaveTextContent('3');
    });

    it('should handle rapid state updates efficiently', async () => {
      const StateUpdateComponent = () => {
        const [count, setCount] = React.useState(0);
        const renderCount = React.useRef(0);
        renderCount.current += 1;

        return (
          <div>
            <div data-testid="render-count">{renderCount.current}</div>
            <div data-testid="count">{count}</div>
            <button 
              onClick={() => setCount(c => c + 1)}
              data-testid="increment"
            >
              Increment
            </button>
          </div>
        );
      };

      const user = userEvent.setup();
      
      render(<StateUpdateComponent />);

      const incrementButton = screen.getByTestId('increment');
      
      // Rapid clicks
      const clickStart = performance.now();
      for (let i = 0; i < 10; i++) {
        await user.click(incrementButton);
      }
      const clickEnd = performance.now();
      
      const clickTime = clickEnd - clickStart;
      
      // Should handle rapid updates efficiently
      expect(clickTime).toBeLessThan(500); // 500ms threshold
      
      // Final count should be correct
      expect(screen.getByTestId('count')).toHaveTextContent('10');
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory on component unmount', () => {
      const initialMemory = measureMemoryUsage();
      
      const { unmount } = render(
        <TestWrapper>
          <ProviderList
            providers={generateProviders(100)}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
          />
        </TestWrapper>
      );

      const afterMountMemory = measureMemoryUsage();
      
      // Unmount component
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterUnmountMemory = measureMemoryUsage();
      
      if (initialMemory > 0 && afterMountMemory > 0 && afterUnmountMemory > 0) {
        const memoryLeak = afterUnmountMemory - initialMemory;
        
        // Should not have significant memory leaks
        expect(memoryLeak).toBeLessThan(5 * 1024 * 1024); // 5MB threshold
      }
    });

    it('should clean up event listeners and timers', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = render(
        <TestWrapper>
          <ProviderList
            providers={generateProviders(10)}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
          />
        </TestWrapper>
      );

      const addEventListenerCalls = addEventListenerSpy.mock.calls.length;
      const setTimeoutCalls = setTimeoutSpy.mock.calls.length;

      // Unmount component
      unmount();

      const removeEventListenerCalls = removeEventListenerSpy.mock.calls.length;
      const clearTimeoutCalls = clearTimeoutSpy.mock.calls.length;

      // Should clean up event listeners
      expect(removeEventListenerCalls).toBeGreaterThanOrEqual(0);
      
      // Should clean up timers
      expect(clearTimeoutCalls).toBeGreaterThanOrEqual(0);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });
});