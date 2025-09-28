/**
 * React Query hooks for provider management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProvidersService } from '@/services';
import { queryKeys, optimisticUpdateHelpers } from '@/lib/query-client';
import {
  Provider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ListProvidersParams,
} from '@/types';

// Query hooks
export const useProviders = (params?: ListProvidersParams) => {
  return useQuery({
    queryKey: queryKeys.providers.list(params),
    queryFn: () => ProvidersService.getProviders(params),
    staleTime: 30000, // 30 seconds
  });
};

export const useProvider = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.providers.detail(id),
    queryFn: () => ProvidersService.getProvider(id),
    enabled: enabled && !!id,
    staleTime: 60000, // 1 minute
  });
};

export const useProviderHealth = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.providers.health(id),
    queryFn: () => ProvidersService.checkProviderHealth(id),
    enabled: enabled && !!id,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useProviderStats = () => {
  return useQuery({
    queryKey: [...queryKeys.providers.all, 'stats'],
    queryFn: () => ProvidersService.getProviderStats(),
    staleTime: 60000, // 1 minute
  });
};

// Mutation hooks
export const useCreateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-provider'],
    mutationFn: (data: CreateProviderRequest) => ProvidersService.createProvider(data),
    onMutate: async (newProvider) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.lists() });

      // Optimistically add the new provider
      const tempProvider = {
        id: `temp_${Date.now()}`,
        ...newProvider,
        healthStatus: { status: 'unknown' as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      optimisticUpdateHelpers.addProvider(tempProvider);

      return { tempProvider };
    },
    onSuccess: (data, variables, context) => {
      // Replace temp provider with real one
      queryClient.setQueriesData(
        { queryKey: queryKeys.providers.lists() },
        (oldData: any) => {
          if (!oldData?.results) return oldData;
          
          return {
            ...oldData,
            results: oldData.results.map((provider: any) =>
              provider.id === context?.tempProvider.id ? data : provider
            ),
          };
        }
      );

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
    onError: (error, variables, context) => {
      // Remove temp provider on error
      if (context?.tempProvider) {
        optimisticUpdateHelpers.removeProvider(context.tempProvider.id);
      }
    },
  });
};

export const useUpdateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-provider'],
    mutationFn: ({ id, data }: { id: string; data: UpdateProviderRequest }) =>
      ProvidersService.updateProvider(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.detail(id) });
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.lists() });

      // Snapshot previous value
      const previousProvider = queryClient.getQueryData(queryKeys.providers.detail(id));

      // Optimistically update
      optimisticUpdateHelpers.updateProvider(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });

      return { previousProvider, id };
    },
    onSuccess: (data) => {
      // Update with server response
      queryClient.setQueryData(queryKeys.providers.detail(data.id), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.lists() });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousProvider) {
        queryClient.setQueryData(
          queryKeys.providers.detail(context.id),
          context.previousProvider
        );
      }
    },
  });
};

export const useDeleteProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['delete-provider'],
    mutationFn: (id: string) => ProvidersService.deleteProvider(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.all });

      // Snapshot previous value
      const previousProviders = queryClient.getQueryData(queryKeys.providers.lists());

      // Optimistically remove
      optimisticUpdateHelpers.removeProvider(id);

      return { previousProviders, id };
    },
    onSuccess: (data, id) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
    onError: (error, id, context) => {
      // Rollback on error
      if (context?.previousProviders) {
        queryClient.setQueriesData(
          { queryKey: queryKeys.providers.lists() },
          context.previousProviders
        );
      }
    },
  });
};

export const useTestProvider = () => {
  return useMutation({
    mutationKey: ['test-provider'],
    mutationFn: ({ id, dryRun = false }: { id: string; dryRun?: boolean }) =>
      ProvidersService.testProvider(id, dryRun),
  });
};

export const useRunProviderTest = () => {
  return useMutation({
    mutationKey: ['run-provider-test'],
    mutationFn: ({ 
      id, 
      testRequest 
    }: { 
      id: string; 
      testRequest: Omit<TestRequest, 'id' | 'providerId'> 
    }) => ProvidersService.runProviderTest(id, testRequest),
  });
};

export const useCancelTest = () => {
  return useMutation({
    mutationKey: ['cancel-test'],
    mutationFn: (testId: string) => ProvidersService.cancelTest(testId),
  });
};

export const useTestResult = (testId: string | null) => {
  return useQuery({
    queryKey: ['test-result', testId],
    queryFn: () => testId ? ProvidersService.getTestResult(testId) : null,
    enabled: !!testId,
    refetchInterval: (data) => {
      // Keep polling if test is still running
      return data?.status === 'running' ? 2000 : false;
    },
  });
};

export const useTestHistory = (providerId: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['test-history', providerId, params],
    queryFn: () => ProvidersService.getTestHistory(providerId, params),
    enabled: !!providerId,
  });
};

export const useTestTemplates = () => {
  return useQuery({
    queryKey: ['test-templates'],
    queryFn: async () => {
      // For now, use local templates. In a real implementation,
      // this would fetch from the API
      const { testTemplates } = await import('@/lib/test-templates');
      return testTemplates;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useConfigureHealthCheck = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['configure-health-check'],
    mutationFn: ({ 
      providerId, 
      config 
    }: { 
      providerId: string; 
      config: HealthCheckConfig 
    }) => ProvidersService.configureHealthCheck(providerId, config),
    onSuccess: (_, { providerId }) => {
      queryClient.invalidateQueries({ queryKey: ['provider', providerId] });
    },
  });
};

export const useHealthHistory = (providerId: string, params?: { hours?: number }) => {
  return useQuery({
    queryKey: ['health-history', providerId, params],
    queryFn: () => ProvidersService.getHealthHistory(providerId, params),
    enabled: !!providerId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useToggleProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['toggle-provider'],
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      ProvidersService.toggleProvider(id, enabled),
    onMutate: async ({ id, enabled }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.detail(id) });
      await queryClient.cancelQueries({ queryKey: queryKeys.providers.lists() });

      // Snapshot previous value
      const previousProvider = queryClient.getQueryData(queryKeys.providers.detail(id));

      // Optimistically update
      optimisticUpdateHelpers.updateProvider(id, {
        enabled,
        updatedAt: new Date().toISOString(),
      });

      return { previousProvider, id };
    },
    onSuccess: (data) => {
      // Update with server response
      queryClient.setQueryData(queryKeys.providers.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.lists() });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousProvider) {
        queryClient.setQueryData(
          queryKeys.providers.detail(context.id),
          context.previousProvider
        );
      }
    },
  });
};

export const useBulkUpdateProviders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['bulk-update-providers'],
    mutationFn: ({ ids, updates }: { ids: string[]; updates: UpdateProviderRequest }) =>
      ProvidersService.bulkUpdateProviders(ids, updates),
    onSuccess: () => {
      // Invalidate all provider queries
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
  });
};

export const useBulkDeleteProviders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['bulk-delete-providers'],
    mutationFn: (ids: string[]) => ProvidersService.bulkDeleteProviders(ids),
    onSuccess: () => {
      // Invalidate all provider queries
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
  });
};