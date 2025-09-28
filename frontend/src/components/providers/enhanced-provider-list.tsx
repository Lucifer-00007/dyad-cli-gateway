/**
 * Enhanced provider list with advanced features and optimizations
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { VirtualTable } from '@/components/ui/virtual-scroll';
import { FeatureGate } from '@/components/ui/feature-gate';
import {
  BulkSelectionBar,
  BulkOperationManager,
  BulkOperationDialog,
} from '@/components/ui/bulk-operations';
import {
  SearchBar,
  FilterBuilder,
  SortControl,
  ExportControl,
} from '@/components/ui/advanced-search';
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import { useBulkOperations } from '@/hooks/use-bulk-operations';
import { useFeatureFlag } from '@/lib/feature-flags';
import { DataExporter } from '@/lib/data-export';
import { ProvidersService } from '@/services/providers';
import { Provider, ProviderType } from '@/types';
import {
  Edit,
  Trash2,
  Play,
  Pause,
  TestTube,
  MoreHorizontal,
  Eye,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

const SEARCH_CONFIG = {
  searchableFields: ['name', 'slug', 'description', 'type'],
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
        { label: 'Proxy', value: 'proxy' },
        { label: 'Local', value: 'local' },
      ],
    },
    {
      field: 'healthStatus.status',
      label: 'Health Status',
      type: 'select' as const,
      options: [
        { label: 'Healthy', value: 'healthy' },
        { label: 'Unhealthy', value: 'unhealthy' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      field: 'createdAt',
      label: 'Created Date',
      type: 'date' as const,
    },
  ],
  sortableFields: [
    { field: 'name', label: 'Name' },
    { field: 'type', label: 'Type' },
    { field: 'createdAt', label: 'Created Date' },
    { field: 'updatedAt', label: 'Updated Date' },
  ],
};

export interface EnhancedProviderListProps {
  onEdit?: (provider: Provider) => void;
  onView?: (provider: Provider) => void;
  onTest?: (provider: Provider) => void;
  onDelete?: (provider: Provider) => void;
}

export const EnhancedProviderList: React.FC<EnhancedProviderListProps> = ({
  onEdit,
  onView,
  onTest,
  onDelete,
}) => {
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);
  const [bulkOperationDialog, setBulkOperationDialog] = useState<{
    open: boolean;
    type: 'enable' | 'disable' | 'delete' | null;
  }>({ open: false, type: null });

  // Feature flags
  const bulkOperationsEnabled = useFeatureFlag('bulk-operations');
  const advancedFilteringEnabled = useFeatureFlag('advanced-filtering');
  const dataExportEnabled = useFeatureFlag('data-export');
  const virtualScrollingEnabled = useFeatureFlag('virtual-scrolling');

  // Fetch providers
  const { data: providersResponse, isLoading, error } = useQuery({
    queryKey: ['providers', { limit: 1000 }], // Get all for client-side operations
    queryFn: () => ProvidersService.getProviders({ limit: 1000 }),
  });

  const providers = providersResponse?.results || [];

  // Advanced search and filtering
  const {
    searchState,
    filteredData,
    paginatedData,
    totalResults,
    totalPages,
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    setSort,
    setPage,
    setLimit,
    exportData,
    getSearchSuggestions,
    hasActiveFilters,
  } = useAdvancedSearch(providers, SEARCH_CONFIG, {
    limit: virtualScrollingEnabled ? 50 : 20,
  });

  // Bulk operations
  const {
    operations,
    createOperation,
    executeOperation,
    cancelOperation,
    clearOperation,
    clearAllOperations,
  } = useBulkOperations<Provider>();

  // Selection management
  const handleSelectProvider = useCallback((provider: Provider, selected: boolean) => {
    setSelectedProviders(prev => {
      if (selected) {
        return [...prev, provider];
      } else {
        return prev.filter(p => p.id !== provider.id);
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProviders([...filteredData]);
  }, [filteredData]);

  const handleClearSelection = useCallback(() => {
    setSelectedProviders([]);
  }, []);

  // Bulk operations handlers
  const handleBulkEnable = useCallback(async () => {
    const operationId = createOperation('Enable Providers', selectedProviders);
    
    try {
      await executeOperation(operationId, async (provider) => {
        await ProvidersService.updateProvider(provider.id, { enabled: true });
      });
      setSelectedProviders([]);
    } catch (error) {
      console.error('Bulk enable failed:', error);
    }
  }, [selectedProviders, createOperation, executeOperation]);

  const handleBulkDisable = useCallback(async () => {
    const operationId = createOperation('Disable Providers', selectedProviders);
    
    try {
      await executeOperation(operationId, async (provider) => {
        await ProvidersService.updateProvider(provider.id, { enabled: false });
      });
      setSelectedProviders([]);
    } catch (error) {
      console.error('Bulk disable failed:', error);
    }
  }, [selectedProviders, createOperation, executeOperation]);

  const handleBulkDelete = useCallback(async () => {
    const operationId = createOperation('Delete Providers', selectedProviders);
    
    try {
      await executeOperation(operationId, async (provider) => {
        await ProvidersService.deleteProvider(provider.id);
      });
      setSelectedProviders([]);
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  }, [selectedProviders, createOperation, executeOperation]);

  // Export handlers
  const handleExport = useCallback((format: 'csv' | 'json') => {
    const exportColumns = [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'type', label: 'Type' },
      { key: 'enabled', label: 'Enabled', transform: (value: boolean) => value ? 'Yes' : 'No' },
      { key: 'description', label: 'Description' },
      { key: 'healthStatus.status', label: 'Health Status' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ];

    if (format === 'csv') {
      DataExporter.exportToCSV(filteredData, {
        columns: exportColumns,
        filename: `providers-${new Date().toISOString().split('T')[0]}.csv`,
      });
    } else {
      DataExporter.exportToJSON(filteredData, {
        filename: `providers-${new Date().toISOString().split('T')[0]}.json`,
      });
    }
  }, [filteredData]);

  // Table columns for virtual scrolling
  const tableColumns = useMemo(() => [
    {
      key: 'selection',
      header: '',
      width: 50,
      render: (provider: Provider) => (
        <Checkbox
          checked={selectedProviders.some(p => p.id === provider.id)}
          onCheckedChange={(checked) => handleSelectProvider(provider, !!checked)}
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: 200,
      render: (provider: Provider) => (
        <div>
          <div className="font-medium">{provider.name}</div>
          <div className="text-sm text-muted-foreground">{provider.slug}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: 120,
      render: (provider: Provider) => (
        <Badge variant="outline">{provider.type}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (provider: Provider) => (
        <div className="flex items-center space-x-2">
          <Badge variant={provider.enabled ? 'default' : 'secondary'}>
            {provider.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {provider.healthStatus && (
            <Badge
              variant={
                provider.healthStatus.status === 'healthy'
                  ? 'default'
                  : provider.healthStatus.status === 'unhealthy'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {provider.healthStatus.status}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'models',
      header: 'Models',
      width: 100,
      render: (provider: Provider) => (
        <span className="text-sm">{provider.models?.length || 0} models</span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      width: 120,
      render: (provider: Provider) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(provider.updatedAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 100,
      render: (provider: Provider) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView?.(provider)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(provider)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTest?.(provider)}>
              <TestTube className="h-4 w-4 mr-2" />
              Test
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(provider)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [selectedProviders, handleSelectProvider, onView, onEdit, onTest, onDelete]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Failed to load providers. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Providers ({totalResults})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <SearchBar
                value={searchState.query}
                onChange={setQuery}
                placeholder="Search providers..."
                suggestions={getSearchSuggestions(searchState.query)}
                onSuggestionSelect={setQuery}
              />
            </div>
            
            <FeatureGate flag="advanced-filtering">
              <SortControl
                config={SEARCH_CONFIG}
                sort={searchState.sort}
                onSortChange={setSort}
              />
            </FeatureGate>

            <FeatureGate flag="data-export">
              <ExportControl
                onExport={handleExport}
                itemCount={filteredData.length}
              />
            </FeatureGate>

            <FeatureGate flag="bulk-operations">
              <BulkOperationManager
                operations={operations}
                onCancel={cancelOperation}
                onClear={clearOperation}
                onClearAll={clearAllOperations}
              />
            </FeatureGate>
          </div>

          <FeatureGate flag="advanced-filtering">
            <FilterBuilder
              config={SEARCH_CONFIG}
              filters={searchState.filters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onClearFilters={clearFilters}
            />
          </FeatureGate>
        </CardContent>
      </Card>

      {/* Provider List */}
      <Card>
        <CardContent className="p-0">
          <FeatureGate
            flag="virtual-scrolling"
            fallback={
              <div className="divide-y">
                {paginatedData.map((provider) => (
                  <div key={provider.id} className="p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <FeatureGate flag="bulk-operations">
                          <Checkbox
                            checked={selectedProviders.some(p => p.id === provider.id)}
                            onCheckedChange={(checked) => handleSelectProvider(provider, !!checked)}
                          />
                        </FeatureGate>
                        <div>
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-sm text-muted-foreground">{provider.slug}</div>
                        </div>
                        <Badge variant="outline">{provider.type}</Badge>
                        <Badge variant={provider.enabled ? 'default' : 'secondary'}>
                          {provider.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => onView?.(provider)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEdit?.(provider)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onTest?.(provider)}>
                          <TestTube className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <VirtualTable
              data={paginatedData}
              columns={tableColumns}
              containerHeight={600}
              onRowClick={(provider) => onView?.(provider)}
              getRowKey={(provider) => provider.id}
            />
          </FeatureGate>
        </CardContent>
      </Card>

      {/* Bulk Selection Bar */}
      <FeatureGate flag="bulk-operations">
        <BulkSelectionBar
          selectedItems={selectedProviders}
          totalItems={filteredData.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          actions={[
            {
              label: 'Enable',
              icon: <Play className="h-4 w-4 mr-1" />,
              onClick: () => setBulkOperationDialog({ open: true, type: 'enable' }),
            },
            {
              label: 'Disable',
              icon: <Pause className="h-4 w-4 mr-1" />,
              onClick: () => setBulkOperationDialog({ open: true, type: 'disable' }),
            },
            {
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4 mr-1" />,
              onClick: () => setBulkOperationDialog({ open: true, type: 'delete' }),
              variant: 'destructive',
            },
          ]}
        />
      </FeatureGate>

      {/* Bulk Operation Confirmation Dialogs */}
      <BulkOperationDialog
        open={bulkOperationDialog.open && bulkOperationDialog.type === 'enable'}
        onOpenChange={(open) => setBulkOperationDialog({ open, type: open ? 'enable' : null })}
        title="Enable Providers"
        description="Are you sure you want to enable the selected providers?"
        itemCount={selectedProviders.length}
        onConfirm={() => {
          handleBulkEnable();
          setBulkOperationDialog({ open: false, type: null });
        }}
      />

      <BulkOperationDialog
        open={bulkOperationDialog.open && bulkOperationDialog.type === 'disable'}
        onOpenChange={(open) => setBulkOperationDialog({ open, type: open ? 'disable' : null })}
        title="Disable Providers"
        description="Are you sure you want to disable the selected providers?"
        itemCount={selectedProviders.length}
        onConfirm={() => {
          handleBulkDisable();
          setBulkOperationDialog({ open: false, type: null });
        }}
      />

      <BulkOperationDialog
        open={bulkOperationDialog.open && bulkOperationDialog.type === 'delete'}
        onOpenChange={(open) => setBulkOperationDialog({ open, type: open ? 'delete' : null })}
        title="Delete Providers"
        description="Are you sure you want to delete the selected providers? This action cannot be undone."
        itemCount={selectedProviders.length}
        onConfirm={() => {
          handleBulkDelete();
          setBulkOperationDialog({ open: false, type: null });
        }}
      />
    </div>
  );
};