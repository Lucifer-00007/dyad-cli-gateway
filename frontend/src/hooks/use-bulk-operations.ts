/**
 * Hook for managing bulk operations with progress tracking
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface BulkOperation<T = unknown> {
  id: string;
  type: string;
  items: T[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  results: {
    successful: T[];
    failed: Array<{ item: T; error: string }>;
  };
  startTime?: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface BulkOperationConfig<T> {
  batchSize?: number;
  delayBetweenBatches?: number;
  maxRetries?: number;
  onProgress?: (operation: BulkOperation<T>) => void;
  onComplete?: (operation: BulkOperation<T>) => void;
  onError?: (operation: BulkOperation<T>, error: Error) => void;
}

export const useBulkOperations = <T = unknown>() => {
  const [operations, setOperations] = useState<Map<string, BulkOperation<T>>>(new Map());
  const { toast } = useToast();

  const createOperation = useCallback((
    type: string,
    items: T[],
    config?: BulkOperationConfig<T>
  ): string => {
    const id = `bulk-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const operation: BulkOperation<T> = {
      id,
      type,
      items,
      status: 'pending',
      progress: {
        completed: 0,
        total: items.length,
        percentage: 0,
      },
      results: {
        successful: [],
        failed: [],
      },
    };

    setOperations(prev => new Map(prev).set(id, operation));
    return id;
  }, []);

  const executeOperation = useCallback(async <R>(
    operationId: string,
    executor: (item: T) => Promise<R>,
    config: BulkOperationConfig<T> = {}
  ): Promise<BulkOperation<T>> => {
    const {
      batchSize = 5,
      delayBetweenBatches = 100,
      maxRetries = 3,
      onProgress,
      onComplete,
      onError,
    } = config;

    const operation = operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    // Update operation status
    const updateOperation = (updates: Partial<BulkOperation<T>>) => {
      setOperations(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(operationId);
        if (current) {
          const updated = { ...current, ...updates };
          newMap.set(operationId, updated);
          onProgress?.(updated);
        }
        return newMap;
      });
    };

    try {
      updateOperation({
        status: 'running',
        startTime: new Date(),
      });

      const items = [...operation.items];
      const successful: T[] = [];
      const failed: Array<{ item: T; error: string }> = [];

      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Process batch items in parallel
        const batchPromises = batch.map(async (item) => {
          let retries = 0;
          while (retries <= maxRetries) {
            try {
              await executor(item);
              return { success: true, item };
            } catch (error) {
              retries++;
              if (retries > maxRetries) {
                return {
                  success: false,
                  item,
                  error: error instanceof Error ? error.message : 'Unknown error',
                };
              }
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        batchResults.forEach(result => {
          if (result.success) {
            successful.push(result.item);
          } else {
            failed.push({ item: result.item, error: result.error });
          }
        });

        // Update progress
        const completed = successful.length + failed.length;
        const percentage = Math.round((completed / items.length) * 100);
        const elapsed = Date.now() - (operation.startTime?.getTime() || Date.now());
        const estimatedTimeRemaining = completed > 0 
          ? Math.round((elapsed / completed) * (items.length - completed))
          : 0;

        updateOperation({
          progress: {
            completed,
            total: items.length,
            percentage,
          },
          results: {
            successful: [...successful],
            failed: [...failed],
          },
          estimatedTimeRemaining,
        });

        // Check if operation was cancelled
        const currentOp = operations.get(operationId);
        if (currentOp?.status === 'cancelled') {
          break;
        }

        // Delay between batches (except for the last batch)
        if (i + batchSize < items.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      const finalOperation: BulkOperation<T> = {
        ...operation,
        status: 'completed',
        endTime: new Date(),
        progress: {
          completed: successful.length + failed.length,
          total: items.length,
          percentage: 100,
        },
        results: {
          successful,
          failed,
        },
      };

      updateOperation(finalOperation);
      onComplete?.(finalOperation);

      // Show completion toast
      if (failed.length === 0) {
        toast({
          title: 'Bulk operation completed',
          description: `Successfully processed ${successful.length} items`,
        });
      } else {
        toast({
          title: 'Bulk operation completed with errors',
          description: `${successful.length} successful, ${failed.length} failed`,
          variant: 'destructive',
        });
      }

      return finalOperation;

    } catch (error) {
      const failedOperation: BulkOperation<T> = {
        ...operation,
        status: 'failed',
        endTime: new Date(),
      };

      updateOperation(failedOperation);
      onError?.(failedOperation, error as Error);

      toast({
        title: 'Bulk operation failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });

      throw error;
    }
  }, [operations, toast]);

  const cancelOperation = useCallback((operationId: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      const operation = newMap.get(operationId);
      if (operation && operation.status === 'running') {
        newMap.set(operationId, {
          ...operation,
          status: 'cancelled',
          endTime: new Date(),
        });
      }
      return newMap;
    });
  }, []);

  const getOperation = useCallback((operationId: string): BulkOperation<T> | undefined => {
    return operations.get(operationId);
  }, [operations]);

  const getAllOperations = useCallback((): BulkOperation<T>[] => {
    return Array.from(operations.values());
  }, [operations]);

  const clearOperation = useCallback((operationId: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(operationId);
      return newMap;
    });
  }, []);

  const clearAllOperations = useCallback(() => {
    setOperations(new Map());
  }, []);

  return {
    operations: Array.from(operations.values()),
    createOperation,
    executeOperation,
    cancelOperation,
    getOperation,
    getAllOperations,
    clearOperation,
    clearAllOperations,
  };
};