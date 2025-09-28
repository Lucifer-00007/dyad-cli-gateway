/**
 * React Query hooks for models management
 */

import { useQuery } from '@tanstack/react-query';
import { ModelsService } from '@/services';
import { queryKeys } from '@/lib/query-client';

export const useModels = () => {
  return useQuery({
    queryKey: queryKeys.models.list(),
    queryFn: () => ModelsService.getModels(),
    staleTime: 5 * 60 * 1000, // 5 minutes - models don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useModelsByProvider = () => {
  return useQuery({
    queryKey: [...queryKeys.models.all, 'by-provider'],
    queryFn: () => ModelsService.getModelsByProvider(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useStreamingModels = () => {
  return useQuery({
    queryKey: [...queryKeys.models.all, 'streaming'],
    queryFn: () => ModelsService.getStreamingModels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useEmbeddingModels = () => {
  return useQuery({
    queryKey: [...queryKeys.models.all, 'embeddings'],
    queryFn: () => ModelsService.getEmbeddingModels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useModel = (modelId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: [...queryKeys.models.all, 'detail', modelId],
    queryFn: () => ModelsService.getModel(modelId),
    enabled: enabled && !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useModelStats = () => {
  return useQuery({
    queryKey: [...queryKeys.models.all, 'stats'],
    queryFn: () => ModelsService.getModelStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};