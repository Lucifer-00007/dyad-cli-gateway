/**
 * WebSocket service for real-time updates
 */

import { config } from '@/lib/config';
import { authManager } from '@/lib/api-client';

export type WebSocketEventType = 
  | 'provider_status_changed'
  | 'provider_health_updated'
  | 'system_metrics_updated'
  | 'new_log_entry'
  | 'api_key_used'
  | 'error_occurred'
  | 'connection_status';

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  data: T;
  timestamp: string;
  id?: string;
}

export interface WebSocketConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
}

export type WebSocketEventHandler<T = any> = (event: WebSocketEvent<T>) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map();
  private connectionStatusHandlers: Set<(status: WebSocketConnectionStatus) => void> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor() {
    // Auto-connect when service is instantiated
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.notifyConnectionStatus();

    try {
      const wsUrl = this.buildWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnecting = false;
    this.notifyConnectionStatus();
  }

  /**
   * Subscribe to specific event type
   */
  on<T = any>(eventType: WebSocketEventType, handler: WebSocketEventHandler<T>): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatus(handler: (status: WebSocketConnectionStatus) => void): () => void {
    this.connectionStatusHandlers.add(handler);
    
    // Immediately notify current status
    handler(this.getConnectionStatus());
    
    return () => {
      this.connectionStatusHandlers.delete(handler);
    };
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): WebSocketConnectionStatus {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      reconnecting: this.isConnecting,
      lastConnected: this.ws?.readyState === WebSocket.OPEN ? new Date() : undefined,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private buildWebSocketUrl(): string {
    const baseUrl = config.apiBaseUrl.replace(/^http/, 'ws');
    const token = authManager.getAccessToken();
    return `${baseUrl}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  private handleOpen(): void {
    console.log('WebSocket connected');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.notifyConnectionStatus();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketEvent;
      this.notifyEventHandlers(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.isConnecting = false;
    this.clearTimers();
    this.notifyConnectionStatus();

    if (this.shouldReconnect && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.isConnecting = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notifyEventHandlers(event: WebSocketEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  private notifyConnectionStatus(): void {
    const status = this.getConnectionStatus();
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('Error in connection status handler:', error);
      }
    });
  }
}

// Global WebSocket service instance
export const webSocketService = new WebSocketService();

// Convenience hooks for common events
export const createWebSocketHooks = () => ({
  useProviderStatusUpdates: (callback: (data: any) => void) => 
    webSocketService.on('provider_status_changed', callback),
  
  useSystemMetricsUpdates: (callback: (data: any) => void) => 
    webSocketService.on('system_metrics_updated', callback),
  
  useLogUpdates: (callback: (data: any) => void) => 
    webSocketService.on('new_log_entry', callback),
  
  useConnectionStatus: (callback: (status: WebSocketConnectionStatus) => void) => 
    webSocketService.onConnectionStatus(callback),
});