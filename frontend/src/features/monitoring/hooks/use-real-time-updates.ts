/**
 * Custom hook for real-time monitoring updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { StreamingLogEntry } from '../types';

interface UseRealTimeUpdatesOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const {
    enabled = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [logs, setLogs] = useState<StreamingLogEntry[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // In a real implementation, this would connect to your WebSocket endpoint
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/monitoring`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'log':
              setLogs(prev => {
                const newLogs = [data.payload, ...prev].slice(0, 1000); // Keep last 1000 logs
                return newLogs;
              });
              break;
              
            case 'metrics':
              setMetrics(prev => ({
                ...prev,
                ...data.payload,
                timestamp: new Date().toISOString(),
              }));
              break;
              
            case 'alert':
              // Handle real-time alerts
              console.log('Real-time alert:', data.payload);
              break;
              
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error occurred');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setConnectionError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Failed to reconnect. Please refresh the page.');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to establish connection');
    }
  }, [enabled, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Subscribe to specific log sources
  const subscribeToLogs = useCallback((filters: {
    level?: string[];
    source?: string[];
    providerId?: string;
  }) => {
    sendMessage({
      type: 'subscribe_logs',
      payload: filters,
    });
  }, [sendMessage]);

  // Subscribe to specific metrics
  const subscribeToMetrics = useCallback((metricTypes: string[]) => {
    sendMessage({
      type: 'subscribe_metrics',
      payload: { metrics: metricTypes },
    });
  }, [sendMessage]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    logs,
    metrics,
    connect,
    disconnect,
    clearLogs,
    subscribeToLogs,
    subscribeToMetrics,
  };
};