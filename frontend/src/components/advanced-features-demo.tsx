/**
 * Comprehensive demo component showcasing all advanced features
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

// Advanced feature components
import { FeatureGate, ConditionalFeature, FeatureBadge } from '@/components/ui/feature-gate';
import { SearchBar, FilterBuilder, SortControl, ExportControl } from '@/components/ui/advanced-search';
import { BulkOperationManager, BulkSelectionBar } from '@/components/ui/bulk-operations';
import { VirtualTable } from '@/components/ui/virtual-scroll';
import { PerformanceDashboard } from '@/components/ui/performance-dashboard';

// Hooks
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import { useBulkOperations } from '@/hooks/use-bulk-operations';
import { useFeatureFlags } from '@/lib/feature-flags';

// Mock data for demonstration
const generateMockProviders = (count: number) => {
  const types = ['spawn-cli', 'http-sdk', 'proxy', 'local'];
  const statuses = ['enabled', 'disabled', 'error'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `provider-${i}`,
    name: `Provider ${i + 1}`,
    type: types[i % types.length],
    status: statuses[i % statuses.length],
    enabled: Math.random() > 0.3,
    lastHealthCheck: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    requestCount: Math.floor(Math.random() * 10000),
    errorRate: Math.random() * 0.1,
    avgLatency: Math.random() * 1000,
  }));
};

const mockProviders = generateMockProviders(1000);

const searchConfig = {
  searchableFields: ['name', 'type', 'status'],
  filterableFields: [
    { field: 'type', label: 'Type', type: 'select' as const, options: [
      { label: 'Spawn CLI', value: 'spawn-cli' },
      { label: 'HTTP SDK', value: 'http-sdk' },
      { label: 'Proxy', value: 'proxy' },
      { label: 'Local', value: 'local' },
    ]},
    { field: 'status', label: 'Status', type: 'select' as const, options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' },
      { label: 'Error', value: 'error' },
    ]},
    { field: 'enabled', label: 'Enabled', type: 'boolean' as const },
    { field: 'requestCount', label: 'Request Count', type: 'number' as const },
    { field: 'errorRate', label: 'Error Rate', type: 'number' as const },
  ],
  sortableFields: [
    { field: 'name', label: 'Name' },
    { field: 'type', label: 'Type' },
    { field: 'requestCount', label: 'Request Count' },
    { field: 'errorRate', label: 'Error Rate' },
    { field: 'avgLatency', label: 'Average Latency' },
  ],
};

export const AdvancedFeaturesDemo: React.FC = () => {
  const { isEnabled } = useFeatureFlags();
  const [selectedItems, setSelectedItems] = useState<typeof mockProviders>([]);
  
  // Advanced search functionality
  const {
    searchState,
    filteredData,
    paginatedData,
    totalResults,
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    setSort,
    exportData,
    hasActiveFilters,
  } = useAdvancedSearch(mockProviders, searchConfig);

  // Bulk operations functionality
  const {
    operations,
    createOperation,
    executeOperation,
    cancelOperation,
    clearOperation,
    clearAllOperations,
  } = useBulkOperations();

  // Virtual table columns
  const columns = useMemo(() => [
    {
      key: 'select',
      header: '',
      width: 50,
      render: (item: typeof mockProviders[0]) => (
        <input
          type="checkbox"
          checked={selectedItems.some(selected => selected.id === item.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedItems(prev => [...prev, item]);
            } else {
              setSelectedItems(prev => prev.filter(selected => selected.id !== item.id));
            }
          }}
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: 200,
    },
    {
      key: 'type',
      header: 'Type',
      width: 120,
      render: (item: typeof mockProviders[0]) => (
        <Badge variant="outline">{item.type}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (item: typeof mockProviders[0]) => (
        <Badge variant={item.enabled ? 'default' : 'secondary'}>
          {item.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'requestCount',
      header: 'Requests',
      width: 100,
      render: (item: typeof mockProviders[0]) => item.requestCount.toLocaleString(),
    },
    {
      key: 'errorRate',
      header: 'Error Rate',
      width: 100,
      render: (item: typeof mockProviders[0]) => `${(item.errorRate * 100).toFixed(2)}%`,
    },
    {
      key: 'avgLatency',
      header: 'Avg Latency',
      width: 120,
      render: (item: typeof mockProviders[0]) => `${item.avgLatency.toFixed(0)}ms`,
    },
  ], [selectedItems]);

  // Bulk operation handlers
  const handleBulkEnable = async (items: typeof mockProviders) => {
    const operationId = createOperation('enable-providers', items);
    
    await executeOperation(operationId, async (item) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      if (Math.random() > 0.9) {
        throw new Error(`Failed to enable ${item.name}`);
      }
    });
    
    setSelectedItems([]);
  };

  const handleBulkDisable = async (items: typeof mockProviders) => {
    const operationId = createOperation('disable-providers', items);
    
    await executeOperation(operationId, async (item) => {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      if (Math.random() > 0.95) {
        throw new Error(`Failed to disable ${item.name}`);
      }
    });
    
    setSelectedItems([]);
  };

  const handleBulkDelete = async (items: typeof mockProviders) => {
    const operationId = createOperation('delete-providers', items);
    
    await executeOperation(operationId, async (item) => {
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 300));
      if (Math.random() > 0.85) {
        throw new Error(`Failed to delete ${item.name}`);
      }
    });
    
    setSelectedItems([]);
  };

  const bulkActions = [
    {
      label: 'Enable',
      onClick: handleBulkEnable,
      disabled: !isEnabled('bulk-operations'),
    },
    {
      label: 'Disable',
      onClick: handleBulkDisable,
      disabled: !isEnabled('bulk-operations'),
    },
    {
      label: 'Delete',
      onClick: handleBulkDelete,
      variant: 'destructive' as const,
      disabled: !isEnabled('bulk-operations'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Features Demo</h1>
          <p className="text-muted-foreground">
            Showcasing feature flags, bulk operations, advanced search, virtual scrolling, and performance monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <FeatureBadge feature="bulk-operations" />
          <FeatureBadge feature="advanced-filtering" />
          <FeatureBadge feature="virtual-scrolling" />
          <FeatureBadge feature="data-export" />
        </div>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Provider Management</TabsTrigger>
          <TabsTrigger value="performance">Performance Dashboard</TabsTrigger>
          <TabsTrigger value="operations">Bulk Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Management with Advanced Features</CardTitle>
              <CardDescription>
                Search, filter, sort, and perform bulk operations on {mockProviders.length} providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <FeatureGate feature="advanced-filtering">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <SearchBar
                        value={searchState.query}
                        onChange={setQuery}
                        placeholder="Search providers..."
                      />
                    </div>
                    <SortControl
                      config={searchConfig}
                      sort={searchState.sort}
                      onSortChange={setSort}
                    />
                    <ConditionalFeature feature="data-export">
                      <ExportControl
                        onExport={exportData}
                        itemCount={totalResults}
                      />
                    </ConditionalFeature>
                  </div>

                  <FilterBuilder
                    config={searchConfig}
                    filters={searchState.filters}
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    onClearFilters={clearFilters}
                  />

                  {hasActiveFilters && (
                    <div className="text-sm text-muted-foreground">
                      Showing {totalResults} of {mockProviders.length} providers
                    </div>
                  )}
                </div>
              </FeatureGate>

              <Separator />

              {/* Virtual Table */}
              <FeatureGate feature="virtual-scrolling">
                <VirtualTable
                  data={paginatedData}
                  columns={columns}
                  containerHeight={400}
                  onRowClick={(item) => console.log('Row clicked:', item)}
                  getRowKey={(item) => item.id}
                />
              </FeatureGate>
            </CardContent>
          </Card>

          {/* Bulk Selection Bar */}
          <ConditionalFeature feature="bulk-operations">
            <BulkSelectionBar
              selectedItems={selectedItems}
              totalItems={paginatedData.length}
              onSelectAll={() => setSelectedItems([...paginatedData])}
              onClearSelection={() => setSelectedItems([])}
              actions={bulkActions}
            />
          </ConditionalFeature>
        </TabsContent>

        <TabsContent value="performance">
          <FeatureGate
            feature="performance-monitoring"
            fallbackMessage="Performance monitoring is not available in your current plan."
          >
            <PerformanceDashboard
              showRecommendations={true}
              autoRefresh={true}
              refreshInterval={30000}
            />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Operations Management</CardTitle>
              <CardDescription>
                Monitor and manage bulk operations with progress tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureGate feature="bulk-operations">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Active Operations</h3>
                      <p className="text-sm text-muted-foreground">
                        {operations.filter(op => ['pending', 'running'].includes(op.status)).length} active,{' '}
                        {operations.filter(op => ['completed', 'failed', 'cancelled'].includes(op.status)).length} completed
                      </p>
                    </div>
                    <BulkOperationManager
                      operations={operations}
                      onCancel={cancelOperation}
                      onClear={clearOperation}
                      onClearAll={clearAllOperations}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => handleBulkEnable(mockProviders.slice(0, 10))}
                      disabled={operations.some(op => op.status === 'running')}
                    >
                      Demo: Enable 10 Providers
                    </Button>
                    <Button
                      onClick={() => handleBulkDisable(mockProviders.slice(10, 25))}
                      disabled={operations.some(op => op.status === 'running')}
                    >
                      Demo: Disable 15 Providers
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleBulkDelete(mockProviders.slice(25, 30))}
                      disabled={operations.some(op => op.status === 'running')}
                    >
                      Demo: Delete 5 Providers
                    </Button>
                  </div>
                </div>
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};