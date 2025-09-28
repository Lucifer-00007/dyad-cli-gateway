/**
 * Advanced search and filtering hook with multiple data types support
 */

import { useState, useMemo, useCallback, useRef } from 'react';

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn' | 'between';
  value: unknown;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
}

export interface SearchConfig {
  searchableFields: string[];
  filterableFields: Array<{
    field: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
    options?: Array<{ label: string; value: unknown }>;
  }>;
  sortableFields: Array<{
    field: string;
    label: string;
  }>;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchState {
  query: string;
  filters: SearchFilter[];
  sort: SortConfig | null;
  page: number;
  limit: number;
}

export const useAdvancedSearch = <T extends Record<string, unknown>>(
  data: T[],
  config: SearchConfig,
  initialState?: Partial<SearchState>
) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: [],
    sort: null,
    page: 1,
    limit: 20,
    ...initialState,
  });

  // Debounced search query update
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedSetQuery = useCallback((query: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setSearchState(prev => ({ ...prev, query, page: 1 }));
    }, 300);
  }, []);

  const setQuery = useCallback((query: string) => {
    debouncedSetQuery(query);
  }, [debouncedSetQuery]);

  const addFilter = useCallback((filter: SearchFilter) => {
    setSearchState(prev => ({
      ...prev,
      filters: [...prev.filters.filter(f => f.field !== filter.field), filter],
      page: 1,
    }));
  }, []);

  const removeFilter = useCallback((field: string) => {
    setSearchState(prev => ({
      ...prev,
      filters: prev.filters.filter(f => f.field !== field),
      page: 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: [], page: 1 }));
  }, []);

  const setSort = useCallback((sort: SortConfig | null) => {
    setSearchState(prev => ({ ...prev, sort, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setSearchState(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setSearchState(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  // Search and filter logic
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply text search
    if (searchState.query.trim()) {
      const query = searchState.query.toLowerCase();
      result = result.filter(item => {
        return config.searchableFields.some(field => {
          const value = getNestedValue(item, field);
          return value && value.toString().toLowerCase().includes(query);
        });
      });
    }

    // Apply filters
    searchState.filters.forEach(filter => {
      result = result.filter(item => {
        const value = getNestedValue(item, filter.field);
        return applyFilter(value, filter);
      });
    });

    // Apply sorting
    if (searchState.sort) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, searchState.sort!.field);
        const bValue = getNestedValue(b, searchState.sort!.field);
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return searchState.sort!.direction === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, searchState, config.searchableFields]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (searchState.page - 1) * searchState.limit;
    const endIndex = startIndex + searchState.limit;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, searchState.page, searchState.limit]);

  const totalPages = Math.ceil(filteredData.length / searchState.limit);

  // Helper function to get nested object values
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Helper function to apply filters
  const applyFilter = (value: unknown, filter: SearchFilter): boolean => {
    if (value === null || value === undefined) return false;

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return value.toString().toLowerCase().includes(filter.value.toLowerCase());
      case 'startsWith':
        return value.toString().toLowerCase().startsWith(filter.value.toLowerCase());
      case 'endsWith':
        return value.toString().toLowerCase().endsWith(filter.value.toLowerCase());
      case 'gt':
        return value > filter.value;
      case 'lt':
        return value < filter.value;
      case 'gte':
        return value >= filter.value;
      case 'lte':
        return value <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'notIn':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'between':
        return Array.isArray(filter.value) && 
               filter.value.length === 2 && 
               value >= filter.value[0] && 
               value <= filter.value[1];
      default:
        return true;
    }
  };

  // Helper functions for export
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const exportToCSV = useCallback((data: T[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    downloadFile(csvContent, filename, 'text/csv');
  }, [downloadFile]);

  const exportToJSON = useCallback((data: T[], filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, filename, 'application/json');
  }, [downloadFile]);

  // Export data functionality
  const exportData = useCallback((format: 'csv' | 'json', filename?: string) => {
    const dataToExport = filteredData;
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `export-${timestamp}`;

    if (format === 'csv') {
      exportToCSV(dataToExport, filename || `${defaultFilename}.csv`);
    } else {
      exportToJSON(dataToExport, filename || `${defaultFilename}.json`);
    }
  }, [filteredData, exportToCSV, exportToJSON]);

  // Search suggestions
  const getSearchSuggestions = useCallback((query: string): string[] => {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    data.forEach(item => {
      config.searchableFields.forEach(field => {
        const value = getNestedValue(item, field);
        if (value && value.toString().toLowerCase().includes(queryLower)) {
          suggestions.add(value.toString());
        }
      });
    });

    return Array.from(suggestions).slice(0, 10);
  }, [data, config.searchableFields]);

  return {
    // State
    searchState,
    
    // Data
    filteredData,
    paginatedData,
    totalResults: filteredData.length,
    totalPages,
    
    // Actions
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    setSort,
    setPage,
    setLimit,
    exportData,
    getSearchSuggestions,
    
    // Computed
    hasActiveFilters: searchState.filters.length > 0 || searchState.query.trim() !== '',
    isFirstPage: searchState.page === 1,
    isLastPage: searchState.page === totalPages,
  };
};