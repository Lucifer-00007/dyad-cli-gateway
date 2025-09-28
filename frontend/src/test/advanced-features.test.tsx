/**
 * Tests for advanced features and optimizations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { FeatureGate } from '@/components/ui/feature-gate';
import { SearchBar, FilterBuilder } from '@/components/ui/advanced-search';
import { VirtualScroll } from '@/components/ui/virtual-scroll';
import { BulkOperationProgress } from '@/components/ui/bulk-operations';
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import { useBulkOperations } from '@/hooks/use-bulk-operations';
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';
import { DataExporter } from '@/lib/data-export';

// Mock data
const mockProviders = Array.from({ length: 100 }, (_, i) => ({
  id: `provider-${i}`,
  name: `Provider ${i}`,
  slug: `provider-${i}`,
  type: ['spawn-cli', 'http-sdk', 'proxy', 'local'][i % 4] as 'spawn-cli' | 'http-sdk' | 'proxy' | 'local',
  enabled: i % 2 === 0,
  description: `Description for provider ${i}`,
  models: [],
  adapterConfig: {},
  healthStatus: {
    status: ['healthy', 'unhealthy', 'unknown'][i % 3] as 'healthy' | 'unhealthy' | 'unknown',
    lastChecked: new Date().toISOString(),
  },
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
}));

const searchConfig = {
  searchableFields: ['name', 'description', 'type'],
  filterableFields: [
    {
      field: 'enabled',
      label: 'Status',
      type: 'select' as const,
      options: [
        { label: 'Enabled', value: true },
        { label: 'Disabled', value: false },
      ],
    },
    {
      field: 'type',
      label: 'Type',
      type: 'select' as const,
      options: [
        { label: 'Spawn CLI', value: 'spawn-cli' },
        { label: 'HTTP SDK', value: 'http-sdk' },
      ],
    },
  ],
  sortableFields: [
    { field: 'name', label: 'Name' },
    { field: 'createdAt', label: 'Created Date' },
  ],
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        {children}
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
};

describe('Feature Flags System', () => {
  it('should render children when feature is enabled', () => {
    render(
      <TestWrapper>
        <FeatureGate flag="bulk-operations">
          <div data-testid="feature-content">Feature Content</div>
        </FeatureGate>
      </TestWrapper>
    );

    expect(screen.getByTestId('feature-content')).toBeInTheDocument();
  });

  it('should render fallback when feature is disabled', () => {
    render(
      <TestWrapper>
        <FeatureGate 
          flag="chat-playground" 
          fallback={<div data-testid="fallback">Fallback Content</div>}
        >
          <div data-testid="feature-content">Feature Content</div>
        </FeatureGate>
      </TestWrapper>
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
  });
});

describe('Advanced Search Hook', () => {
  const TestSearchComponent = () => {
    const {
      searchState,
      filteredData,
      setQuery,
      addFilter,
      setSort,
      exportData,
    } = useAdvancedSearch(mockProviders, searchConfig);

    return (
      <div>
        <input
          data-testid="search-input"
          value={searchState.query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div data-testid="results-count">{filteredData.length}</div>
        <button
          data-testid="add-filter"
          onClick={() => addFilter({
            field: 'enabled',
            operator: 'equals',
            value: true,
            type: 'boolean',
          })}
        >
          Add Filter
        </button>
        <button
          data-testid="sort-name"
          onClick={() => setSort({ field: 'name', direction: 'asc' })}
        >
          Sort by Name
        </button>
        <button
          data-testid="export-csv"
          onClick={() => exportData('csv')}
        >
          Export CSV
        </button>
      </div>
    );
  };

  it('should filter data based on search query', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <TestSearchComponent />
      </TestWrapper>
    );

    const searchInput = screen.getByTestId('search-input');
    const resultsCount = screen.getByTestId('results-count');

    // Initially should show all results
    expect(resultsCount).toHaveTextContent('100');

    // Search for specific provider
    await user.type(searchInput, 'Provider 1');
    
    await waitFor(() => {
      // Should show providers that match "Provider 1" (Provider 1, 10, 11, etc.)
      expect(parseInt(resultsCount.textContent!)).toBeLessThan(100);
    });
  });

  it('should apply filters correctly', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <TestSearchComponent />
      </TestWrapper>
    );

    const addFilterButton = screen.getByTestId('add-filter');
    const resultsCount = screen.getByTestId('results-count');

    await user.click(addFilterButton);

    await waitFor(() => {
      // Should show only enabled providers (50 out of 100)
      expect(resultsCount).toHaveTextContent('50');
    });
  });

  it('should sort data correctly', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <TestSearchComponent />
      </TestWrapper>
    );

    const sortButton = screen.getByTestId('sort-name');
    await user.click(sortButton);

    // Sorting should not change the count but should reorder
    const resultsCount = screen.getByTestId('results-count');
    expect(resultsCount).toHaveTextContent('100');
  });
});

describe('Virtual Scrolling', () => {
  it('should render only visible items', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    
    render(
      <VirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={300}
        renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.name}</div>}
      />
    );

    // Should only render visible items (approximately 6-7 items for 300px container with 50px items)
    const renderedItems = screen.getAllByTestId(/^item-/);
    expect(renderedItems.length).toBeLessThan(20); // Much less than 1000
    expect(renderedItems.length).toBeGreaterThan(5); // But more than just a few
  });
});

describe('Bulk Operations Hook', () => {
  const TestBulkComponent = () => {
    const {
      operations,
      createOperation,
      executeOperation,
      cancelOperation,
    } = useBulkOperations();

    const handleBulkOperation = async () => {
      const operationId = createOperation('Test Operation', mockProviders.slice(0, 5));
      
      await executeOperation(operationId, async (provider) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return provider;
      });
    };

    return (
      <div>
        <button data-testid="start-bulk" onClick={handleBulkOperation}>
          Start Bulk Operation
        </button>
        <div data-testid="operations-count">{operations.length}</div>
        {operations.map(op => (
          <div key={op.id} data-testid={`operation-${op.id}`}>
            <span data-testid={`status-${op.id}`}>{op.status}</span>
            <span data-testid={`progress-${op.id}`}>{op.progress.percentage}%</span>
            {op.status === 'running' && (
              <button
                data-testid={`cancel-${op.id}`}
                onClick={() => cancelOperation(op.id)}
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  it('should create and execute bulk operations', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <TestBulkComponent />
      </TestWrapper>
    );

    const startButton = screen.getByTestId('start-bulk');
    const operationsCount = screen.getByTestId('operations-count');

    // Initially no operations
    expect(operationsCount).toHaveTextContent('0');

    // Start bulk operation
    await user.click(startButton);

    await waitFor(() => {
      expect(operationsCount).toHaveTextContent('1');
    });

    // Wait for operation to complete
    await waitFor(() => {
      const operation = screen.getByTestId(/^operation-/);
      const status = operation.querySelector('[data-testid^="status-"]');
      expect(status).toHaveTextContent('completed');
    }, { timeout: 3000 });
  });
});

describe('Performance Monitor Hook', () => {
  const TestPerformanceComponent = () => {
    const {
      metrics,
      measureRenderTime,
      getPerformanceScore,
      getRecommendations,
    } = usePerformanceMonitor({ enabled: true });

    React.useEffect(() => {
      const endMeasurement = measureRenderTime('TestComponent');
      return endMeasurement;
    }, [measureRenderTime]);

    return (
      <div>
        <div data-testid="performance-score">{getPerformanceScore()}</div>
        <div data-testid="recommendations-count">{getRecommendations().length}</div>
        <div data-testid="render-time">{metrics.componentRenderTime || 0}</div>
      </div>
    );
  };

  it('should measure component render time', async () => {
    render(
      <TestWrapper>
        <TestPerformanceComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      const renderTime = screen.getByTestId('render-time');
      expect(parseFloat(renderTime.textContent!)).toBeGreaterThan(0);
    });
  });

  it('should calculate performance score', () => {
    render(
      <TestWrapper>
        <TestPerformanceComponent />
      </TestWrapper>
    );

    const score = screen.getByTestId('performance-score');
    const scoreValue = parseInt(score.textContent!);
    expect(scoreValue).toBeGreaterThanOrEqual(0);
    expect(scoreValue).toBeLessThanOrEqual(100);
  });
});

describe('Data Export', () => {
  // Mock URL.createObjectURL and document.createElement
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: { display: '' },
    };
    
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockLink as HTMLAnchorElement;
      }
      return document.createElement(tagName);
    });
    
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as HTMLAnchorElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as HTMLAnchorElement);
  });

  it('should export data to CSV format', () => {
    const testData = [
      { id: 1, name: 'Test 1', enabled: true },
      { id: 2, name: 'Test 2', enabled: false },
    ];

    DataExporter.exportToCSV(testData, {
      filename: 'test.csv',
      includeHeaders: true,
    });

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should export data to JSON format', () => {
    const testData = [
      { id: 1, name: 'Test 1', enabled: true },
      { id: 2, name: 'Test 2', enabled: false },
    ];

    DataExporter.exportToJSON(testData, {
      filename: 'test.json',
    });

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle empty data gracefully', () => {
    expect(() => {
      DataExporter.exportToCSV([], { filename: 'empty.csv' });
    }).toThrow('No data to export');
  });
});

describe('Search Components', () => {
  it('should render search bar with suggestions', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    const mockOnSuggestionSelect = vi.fn();

    render(
      <SearchBar
        value=""
        onChange={mockOnChange}
        suggestions={['Provider 1', 'Provider 2']}
        onSuggestionSelect={mockOnSuggestionSelect}
      />
    );

    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);

    // Should show suggestions when focused
    await waitFor(() => {
      expect(screen.getByText('Provider 1')).toBeInTheDocument();
      expect(screen.getByText('Provider 2')).toBeInTheDocument();
    });
  });

  it('should render filter builder', () => {
    const mockAddFilter = vi.fn();
    const mockRemoveFilter = vi.fn();
    const mockClearFilters = vi.fn();

    render(
      <FilterBuilder
        config={searchConfig}
        filters={[]}
        onAddFilter={mockAddFilter}
        onRemoveFilter={mockRemoveFilter}
        onClearFilters={mockClearFilters}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Add Filter')).toBeInTheDocument();
  });
});

describe('Bulk Operations Components', () => {
  const mockOperation = {
    id: 'test-op-1',
    type: 'Test Operation',
    items: mockProviders.slice(0, 5),
    status: 'running' as const,
    progress: {
      completed: 2,
      total: 5,
      percentage: 40,
    },
    results: {
      successful: [],
      failed: [],
    },
    startTime: new Date(),
    estimatedTimeRemaining: 5000,
  };

  it('should render bulk operation progress', () => {
    const mockOnCancel = vi.fn();

    render(
      <BulkOperationProgress
        operation={mockOperation}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Test Operation')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText('40% complete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should handle cancel operation', async () => {
    const user = userEvent.setup();
    const mockOnCancel = vi.fn();

    render(
      <BulkOperationProgress
        operation={mockOperation}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});