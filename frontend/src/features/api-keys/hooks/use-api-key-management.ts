/**
 * API Key Management Hook
 * Provides comprehensive API key management functionality
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useCreateApiKey, 
  useUpdateApiKey, 
  useDeleteApiKey, 
  useRevokeApiKey,
  useRegenerateApiKey,
  useBulkUpdateApiKeys,
  useBulkDeleteApiKeys
} from '@/hooks/api/use-api-keys';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-client';
import { ApiKey, CreateApiKeyRequest } from '@/types';
import { BulkApiKeyOperation } from '../types';

export const useApiKeyManagement = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateApiKey();
  const updateMutation = useUpdateApiKey();
  const deleteMutation = useDeleteApiKey();
  const revokeMutation = useRevokeApiKey();
  const regenerateMutation = useRegenerateApiKey();
  const bulkUpdateMutation = useBulkUpdateApiKeys();
  const bulkDeleteMutation = useBulkDeleteApiKeys();

  // Create API Key
  const createApiKey = useCallback(async (data: CreateApiKeyRequest) => {
    setIsProcessing(true);
    try {
      const result = await createMutation.mutateAsync(data);
      
      toast({
        title: "API Key Created",
        description: `${data.name} has been created successfully.`,
        variant: "default",
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create API key. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [createMutation, toast]);

  // Update API Key
  const updateApiKey = useCallback(async (id: string, data: Partial<CreateApiKeyRequest>) => {
    setIsProcessing(true);
    try {
      const result = await updateMutation.mutateAsync({ id, data });
      
      toast({
        title: "API Key Updated",
        description: "API key has been updated successfully.",
        variant: "default",
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update API key. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [updateMutation, toast]);

  // Delete API Key
  const deleteApiKey = useCallback(async (id: string, keyName?: string) => {
    setIsProcessing(true);
    try {
      await deleteMutation.mutateAsync(id);
      
      toast({
        title: "API Key Deleted",
        description: `${keyName || 'API key'} has been permanently deleted.`,
        variant: "default",
      });
      
      // Remove from selected keys if it was selected
      setSelectedKeys(prev => prev.filter(keyId => keyId !== id));
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete API key. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [deleteMutation, toast]);

  // Revoke API Key
  const revokeApiKey = useCallback(async (id: string, keyName?: string) => {
    setIsProcessing(true);
    try {
      const result = await revokeMutation.mutateAsync(id);
      
      toast({
        title: "API Key Revoked",
        description: `${keyName || 'API key'} has been revoked and is no longer valid.`,
        variant: "default",
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke API key. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [revokeMutation, toast]);

  // Regenerate API Key
  const regenerateApiKey = useCallback(async (id: string, keyName?: string) => {
    setIsProcessing(true);
    try {
      const result = await regenerateMutation.mutateAsync(id);
      
      toast({
        title: "API Key Regenerated",
        description: `A new key has been generated for ${keyName || 'the API key'}. The old key is no longer valid.`,
        variant: "default",
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate API key. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [regenerateMutation, toast]);

  // Bulk Operations
  const performBulkOperation = useCallback(async (operation: BulkApiKeyOperation) => {
    if (operation.keyIds.length === 0) {
      toast({
        title: "No Keys Selected",
        description: "Please select at least one API key to perform this operation.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      switch (operation.action) {
        case 'delete':
          await bulkDeleteMutation.mutateAsync(operation.keyIds);
          toast({
            title: "Keys Deleted",
            description: `${operation.keyIds.length} API keys have been deleted.`,
            variant: "default",
          });
          setSelectedKeys([]);
          break;

        case 'enable':
        case 'disable':
          await bulkUpdateMutation.mutateAsync({
            ids: operation.keyIds,
            updates: { enabled: operation.action === 'enable' } as any,
          });
          toast({
            title: `Keys ${operation.action === 'enable' ? 'Enabled' : 'Disabled'}`,
            description: `${operation.keyIds.length} API keys have been ${operation.action}d.`,
            variant: "default",
          });
          break;

        case 'update_permissions':
          if (!operation.parameters?.permissions) {
            throw new Error('Permissions are required for this operation');
          }
          await bulkUpdateMutation.mutateAsync({
            ids: operation.keyIds,
            updates: { permissions: operation.parameters.permissions } as any,
          });
          toast({
            title: "Permissions Updated",
            description: `Permissions have been updated for ${operation.keyIds.length} API keys.`,
            variant: "default",
          });
          break;

        case 'update_rate_limits':
          if (!operation.parameters?.rateLimits) {
            throw new Error('Rate limits are required for this operation');
          }
          await bulkUpdateMutation.mutateAsync({
            ids: operation.keyIds,
            updates: { rateLimits: operation.parameters.rateLimits } as any,
          });
          toast({
            title: "Rate Limits Updated",
            description: `Rate limits have been updated for ${operation.keyIds.length} API keys.`,
            variant: "default",
          });
          break;

        default:
          throw new Error(`Unsupported bulk operation: ${operation.action}`);
      }
    } catch (error: any) {
      toast({
        title: "Bulk Operation Failed",
        description: error.message || "Failed to perform bulk operation. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [bulkUpdateMutation, bulkDeleteMutation, toast]);

  // Selection Management
  const toggleKeySelection = useCallback((keyId: string) => {
    setSelectedKeys(prev => 
      prev.includes(keyId) 
        ? prev.filter(id => id !== keyId)
        : [...prev, keyId]
    );
  }, []);

  const selectAllKeys = useCallback((keyIds: string[]) => {
    setSelectedKeys(keyIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const isKeySelected = useCallback((keyId: string) => {
    return selectedKeys.includes(keyId);
  }, [selectedKeys]);

  // Refresh data
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
  }, [queryClient]);

  return {
    // State
    selectedKeys,
    isProcessing,
    
    // CRUD Operations
    createApiKey,
    updateApiKey,
    deleteApiKey,
    revokeApiKey,
    regenerateApiKey,
    
    // Bulk Operations
    performBulkOperation,
    
    // Selection Management
    toggleKeySelection,
    selectAllKeys,
    clearSelection,
    isKeySelected,
    
    // Utilities
    refreshData,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isRegenerating: regenerateMutation.isPending,
  };
};