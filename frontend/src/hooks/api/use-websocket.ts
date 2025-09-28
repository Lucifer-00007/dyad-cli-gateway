/**
 * React hooks for WebSocket real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  webSocketService, 
  WebSocketEvent, 
  WebSocketEventType, 
  WebSocketConnectionStatus 
} from '@/services/websocket';
import { LogEntry } from '@/types/api';
import { queryKeys, invalidateQueries } from '@/lib/query-client';

/**
 * Hook for subscribing to WebSocket events
 */
export const useWebSocketEvent = <T = unknown>(
  eventType: WebSocketEventType,
  handler: (event: WebSocketEvent<T>) => void,
  deps: unknown[] = []
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = webSocketService.on(eventType, (event) => {
      handlerRef.current(event);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, ...deps]);
};

/**
 * Hook for WebSocket connection status
 */
export const useWebSocketConnection = () => {
  const [status, setStatus] = useState<WebSocketConnectionStatus>({
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
  });

  useEffect(() => {
    const unsubscribe = webSocketService.onConnectionStatus(setStatus);
    return unsubscribe;
  }, []);

  const connect = useCallback(() => {
    webSocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  return {
    ...status,
    connect,
    disconnect,
  };
};

/**
 * Hook for real-time provider status updates
 */
export const useProviderStatusUpdates = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('provider_status_changed', (event) => {
    const { providerId, status, enabled } = event.data;

    // Update provider in cache
    queryClient.setQueryData(
      queryKeys.providers.detail(providerId),
      (oldData: unknown) => oldData ? { ...oldData, enabled, healthStatus: { status } } : oldData
    );

    // Update provider in lists
    queryClient.setQueriesData(
      { queryKey: queryKeys.providers.lists() },
      (oldData: unknown) => {
        if (!oldData?.results) return oldData;
        
        return {
          ...oldData,
          results: oldData.results.map((provider: unknown) =>
            provider.id === providerId 
              ? { ...provider, enabled, healthStatus: { status } }
              : provider
          ),
        };
      }
    );

    // Invalidate related queries
    invalidateQueries.providers();
  });
};

/**
 * Hook for real-time provider health updates
 */
export const useProviderHealthUpdates = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('provider_health_updated', (event) => {
    const { providerId, healthStatus } = event.data;

    // Update provider health in cache
    queryClient.setQueryData(
      queryKeys.providers.health(providerId),
      healthStatus
    );

    // Update provider in detail cache
    queryClient.setQueryData(
      queryKeys.providers.detail(providerId),
      (oldData: unknown) => oldData ? { ...oldData, healthStatus } : oldData
    );
  });
};

/**
 * Hook for real-time system metrics updates
 */
export const useSystemMetricsUpdates = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('system_metrics_updated', (event) => {
    const metrics = event.data;

    // Update system metrics in cache
    queryClient.setQueryData(
      [...queryKeys.system.metrics(), 'realtime'],
      metrics
    );

    // Optionally invalidate other metric queries
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.system.metrics(),
      exact: false,
    });
  });
};

/**
 * Hook for real-time log updates
 */
export const useLogUpdates = (
  onNewLog?: (logEntry: unknown) => void,
  filters?: {
    level?: string[];
    source?: string[];
    providerId?: string;
  }
) => {
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  useWebSocketEvent('new_log_entry', (event) => {
    const logEntry = event.data;

    // Apply filters if provided
    if (filters) {
      if (filters.level && !filters.level.includes(logEntry.level)) {
        return;
      }
      if (filters.source && !filters.source.includes(logEntry.source)) {
        return;
      }
      if (filters.providerId && logEntry.providerId !== filters.providerId) {
        return;
      }
    }

    // Add to recent logs (keep last 100)
    setRecentLogs(prev => [logEntry, ...prev.slice(0, 99)]);

    // Call custom handler if provided
    if (onNewLog) {
      onNewLog(logEntry);
    }
  });

  return recentLogs;
};

/**
 * Hook for real-time API key usage updates
 */
export const useApiKeyUsageUpdates = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('api_key_used', (event) => {
    const { keyId, usage } = event.data;

    // Update API key usage in cache
    queryClient.setQueryData(
      [...queryKeys.apiKeys.detail(keyId), 'usage'],
      usage
    );

    // Invalidate API key stats
    queryClient.invalidateQueries({ 
      queryKey: [...queryKeys.apiKeys.all, 'stats'],
    });
  });
};

/**
 * Hook for real-time error notifications
 */
export const useErrorNotifications = (
  onError?: (error: unknown) => void,
  severity?: 'low' | 'medium' | 'high' | 'critical'
) => {
  const [recentErrors, setRecentErrors] = useState<unknown[]>([]);

  useWebSocketEvent('error_occurred', (event) => {
    const error = event.data;

    // Filter by severity if specified
    if (severity && error.severity !== severity) {
      return;
    }

    // Add to recent errors (keep last 50)
    setRecentErrors(prev => [error, ...prev.slice(0, 49)]);

    // Call custom handler if provided
    if (onError) {
      onError(error);
    }
  });

  return recentErrors;
};

/**
 * Composite hook for dashboard real-time updates
 */
export const useDashboardUpdates = () => {
  const connection = useWebSocketConnection();
  
  // Subscribe to all relevant updates
  useProviderStatusUpdates();
  useProviderHealthUpdates();
  useSystemMetricsUpdates();
  useApiKeyUsageUpdates();

  const recentLogs = useLogUpdates(undefined, { level: ['error', 'warn'] });
  const recentErrors = useErrorNotifications(undefined, 'high');

  return {
    connection,
    recentLogs: recentLogs.slice(0, 10), // Last 10 logs
    recentErrors: recentErrors.slice(0, 5), // Last 5 errors
  };
};

/**
 * Hook for sending WebSocket messages
 */
export const useWebSocketSend = () => {
  const send = useCallback((message: unknown) => {
    webSocketService.send(message);
  }, []);

  return send;
};

/**
 * Hook for WebSocket event history
 */
export const useWebSocketEventHistory = <T = unknown>(
  eventType: WebSocketEventType,
  maxEvents: number = 100
) => {
  const [events, setEvents] = useState<WebSocketEvent<T>[]>([]);

  useWebSocketEvent(eventType, (event) => {
    setEvents(prev => [event, ...prev.slice(0, maxEvents - 1)]);
  });

  const clearHistory = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    clearHistory,
    count: events.length,
  };
};