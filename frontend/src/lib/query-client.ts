/**
 * TanStack Query client configuration with persistence, error handling, and optimistic updates
 */

import { QueryClient, DefaultOptions, MutationCache, QueryCache } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { handleApiError, ApiError } from './api-client';
import { config } from './config';

// Default query options
const defaultQueryOptions: DefaultOptions = {
  queries: {
    // Stale time from config
    staleTime: config.cache.queryStaleTime,
    // Cache time from config
    gcTime: config.cache.queryCacheTime,
    // Retry failed requests 3 times with exponential backoff
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus for critical data
    refetchOnWindowFocus: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
    // Background refetch interval: 5 minutes for active queries
    refetchInterval: 5 * 60 * 1000,
  },
  mutations: {
    // Retry mutations once on network errors
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 500) {
        return failureCount < 1;
      }
      return false;
    },
    retryDelay: 1000,
  },
};

// Global error handler for queries
const queryCache = new QueryCache({
  onError: (error, query) => {
    const apiError = handleApiError(error);
    
    // Log error for debugging
    console.error('Query error:', {
      queryKey: query.queryKey,
      error: apiError,
    });

    // Show user-friendly error notifications for critical queries
    if (query.queryKey[0] === 'providers' || query.queryKey[0] === 'system-health') {
      // This will be handled by the error boundary or notification system
      window.dispatchEvent(new CustomEvent('query-error', {
        detail: {
          message: apiError.message,
          type: 'error',
          code: apiError.code,
        },
      }));
    }
  },
});

// Global error handler for mutations
const mutationCache = new MutationCache({
  onError: (error, variables, context, mutation) => {
    const apiError = handleApiError(error);
    
    // Log error for debugging
    console.error('Mutation error:', {
      mutationKey: mutation.options.mutationKey,
      error: apiError,
      variables,
    });

    // Show error notification
    window.dispatchEvent(new CustomEvent('mutation-error', {
      detail: {
        message: apiError.message,
        type: 'error',
        code: apiError.code,
      },
    }));
  },
  onSuccess: (data, variables, context, mutation) => {
    // Show success notification for important mutations
    const mutationKey = mutation.options.mutationKey?.[0];
    
    if (['create-provider', 'update-provider', 'delete-provider'].includes(mutationKey as string)) {
      window.dispatchEvent(new CustomEvent('mutation-success', {
        detail: {
          message: 'Operation completed successfully',
          type: 'success',
        },
      }));
    }
  },
});

// Create query client
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
  queryCache,
  mutationCache,
});

// Storage persister for offline support
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'dyad-admin-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Persist query client
export const persistOptions = {
  queryClient,
  persister: localStoragePersister,
  maxAge: config.cache.maxAge,
  hydrateOptions: {
    // Only persist certain query types
    dehydrateQuery: (query: any) => {
      const queryKey = query.queryKey[0];
      // Persist providers, models, and system info
      return ['providers', 'models', 'system-info'].includes(queryKey);
    },
  },
};

// Initialize persistence
export const initializeQueryPersistence = async () => {
  try {
    await persistQueryClient(persistOptions);
  } catch (error) {
    console.warn('Failed to initialize query persistence:', error);
  }
};

// Query key factories for consistent cache management
export const queryKeys = {
  // Provider queries
  providers: {
    all: ['providers'] as const,
    lists: () => [...queryKeys.providers.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.providers.lists(), filters] as const,
    details: () => [...queryKeys.providers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.providers.details(), id] as const,
    health: (id: string) => [...queryKeys.providers.detail(id), 'health'] as const,
    test: (id: string) => [...queryKeys.providers.detail(id), 'test'] as const,
  },
  
  // Model queries
  models: {
    all: ['models'] as const,
    list: () => [...queryKeys.models.all, 'list'] as const,
  },
  
  // System queries
  system: {
    all: ['system'] as const,
    health: () => [...queryKeys.system.all, 'health'] as const,
    metrics: () => [...queryKeys.system.all, 'metrics'] as const,
    logs: (filters?: any) => [...queryKeys.system.all, 'logs', filters] as const,
  },
  
  // API key queries
  apiKeys: {
    all: ['api-keys'] as const,
    lists: () => [...queryKeys.apiKeys.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.apiKeys.lists(), filters] as const,
    details: () => [...queryKeys.apiKeys.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.apiKeys.details(), id] as const,
    usage: (id: string) => [...queryKeys.apiKeys.detail(id), 'usage'] as const,
  },
  
  // Metrics queries
  metrics: {
    all: ['metrics'] as const,
    system: () => [...queryKeys.metrics.all, 'system'] as const,
    providers: () => [...queryKeys.metrics.all, 'providers'] as const,
    models: () => [...queryKeys.metrics.all, 'models'] as const,
    errors: () => [...queryKeys.metrics.all, 'errors'] as const,
    realtime: () => [...queryKeys.metrics.all, 'realtime'] as const,
  },
  
  // Chat queries
  chat: {
    all: ['chat'] as const,
    sessions: () => [...queryKeys.chat.all, 'sessions'] as const,
    session: (id: string) => [...queryKeys.chat.sessions(), id] as const,
  },
} as const;

// Optimistic update helpers
export const optimisticUpdateHelpers = {
  // Provider optimistic updates
  updateProvider: (providerId: string, updates: any) => {
    queryClient.setQueryData(
      queryKeys.providers.detail(providerId),
      (oldData: any) => oldData ? { ...oldData, ...updates } : oldData
    );
    
    // Update in lists as well
    queryClient.setQueriesData(
      { queryKey: queryKeys.providers.lists() },
      (oldData: any) => {
        if (!oldData?.results) return oldData;
        
        return {
          ...oldData,
          results: oldData.results.map((provider: any) =>
            provider.id === providerId ? { ...provider, ...updates } : provider
          ),
        };
      }
    );
  },
  
  // Add provider optimistically
  addProvider: (newProvider: any) => {
    queryClient.setQueriesData(
      { queryKey: queryKeys.providers.lists() },
      (oldData: any) => {
        if (!oldData?.results) return oldData;
        
        return {
          ...oldData,
          results: [newProvider, ...oldData.results],
          totalResults: oldData.totalResults + 1,
        };
      }
    );
  },
  
  // Remove provider optimistically
  removeProvider: (providerId: string) => {
    queryClient.setQueriesData(
      { queryKey: queryKeys.providers.lists() },
      (oldData: any) => {
        if (!oldData?.results) return oldData;
        
        return {
          ...oldData,
          results: oldData.results.filter((provider: any) => provider.id !== providerId),
          totalResults: oldData.totalResults - 1,
        };
      }
    );
    
    // Remove from cache
    queryClient.removeQueries({ queryKey: queryKeys.providers.detail(providerId) });
  },
};

// Cache invalidation helpers
export const invalidateQueries = {
  providers: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers.all }),
  provider: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.providers.detail(id) }),
  models: () => queryClient.invalidateQueries({ queryKey: queryKeys.models.all }),
  system: () => queryClient.invalidateQueries({ queryKey: queryKeys.system.all }),
  apiKeys: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all }),
  all: () => queryClient.invalidateQueries(),
};

// Prefetch helpers for better UX
export const prefetchQueries = {
  providers: () => queryClient.prefetchQuery({
    queryKey: queryKeys.providers.list(),
    staleTime: 30000, // 30 seconds
  }),
  
  models: () => queryClient.prefetchQuery({
    queryKey: queryKeys.models.list(),
    staleTime: 60000, // 1 minute
  }),
  
  systemHealth: () => queryClient.prefetchQuery({
    queryKey: queryKeys.system.health(),
    staleTime: 10000, // 10 seconds
  }),
};

export default queryClient;