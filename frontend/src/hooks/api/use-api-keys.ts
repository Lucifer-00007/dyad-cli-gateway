/**
 * React Query hooks for API key management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiKeysService, ListApiKeysParams } from '@/services/api-keys';
import { queryKeys } from '@/lib/query-client';
import { CreateApiKeyRequest } from '@/types';

// Query hooks
export const useApiKeys = (params?: ListApiKeysParams) => {
  return useQuery({
    queryKey: queryKeys.apiKeys.list(params),
    queryFn: () => ApiKeysService.getApiKeys(params),
    staleTime: 60000, // 1 minute
  });
};

export const useApiKey = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.apiKeys.detail(id),
    queryFn: () => ApiKeysService.getApiKey(id),
    enabled: enabled && !!id,
    staleTime: 60000, // 1 minute
  });
};

export const useApiKeyUsage = (id: string, timeRange?: { start: Date; end: Date }, enabled: boolean = true) => {
  return useQuery({
    queryKey: [...queryKeys.apiKeys.detail(id), 'usage', timeRange],
    queryFn: () => ApiKeysService.getApiKeyUsage(id, timeRange),
    enabled: enabled && !!id,
    staleTime: 30000, // 30 seconds
  });
};

export const useAllApiKeyUsage = (timeRange?: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: [...queryKeys.apiKeys.all, 'usage', timeRange],
    queryFn: () => ApiKeysService.getAllApiKeyUsage(timeRange),
    staleTime: 30000, // 30 seconds
  });
};

export const useApiKeyStats = () => {
  return useQuery({
    queryKey: [...queryKeys.apiKeys.all, 'stats'],
    queryFn: () => ApiKeysService.getApiKeyStats(),
    staleTime: 60000, // 1 minute
  });
};

// Mutation hooks
export const useCreateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-api-key'],
    mutationFn: (data: CreateApiKeyRequest) => ApiKeysService.createApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};

export const useUpdateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-api-key'],
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateApiKeyRequest> }) =>
      ApiKeysService.updateApiKey(id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.apiKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() });
    },
  });
};

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['delete-api-key'],
    mutationFn: (id: string) => ApiKeysService.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['revoke-api-key'],
    mutationFn: (id: string) => ApiKeysService.revokeApiKey(id),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.apiKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() });
    },
  });
};

export const useRegenerateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['regenerate-api-key'],
    mutationFn: (id: string) => ApiKeysService.regenerateApiKey(id),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.apiKeys.detail(data.apiKey.id), data.apiKey);
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() });
    },
  });
};

export const useTestApiKey = () => {
  return useMutation({
    mutationKey: ['test-api-key'],
    mutationFn: (id: string) => ApiKeysService.testApiKey(id),
  });
};

export const useBulkUpdateApiKeys = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['bulk-update-api-keys'],
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<CreateApiKeyRequest> }) =>
      ApiKeysService.bulkUpdateApiKeys(ids, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};

export const useBulkDeleteApiKeys = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['bulk-delete-api-keys'],
    mutationFn: (ids: string[]) => ApiKeysService.bulkDeleteApiKeys(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};