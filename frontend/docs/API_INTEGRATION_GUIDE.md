# API Integration Guide

This guide covers how to integrate with the Dyad CLI Gateway backend API from the frontend admin UI.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Client Setup](#api-client-setup)
- [Service Layer](#service-layer)
- [Error Handling](#error-handling)
- [Real-time Updates](#real-time-updates)
- [Caching Strategy](#caching-strategy)
- [Testing API Integration](#testing-api-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The frontend communicates with the backend through a RESTful API that follows OpenAI v1 compatibility standards. All API endpoints are prefixed with `/api/v1/` and use JSON for data exchange.

### Base Configuration

```typescript
// src/lib/config.ts
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};
```

### Environment Variables

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_ENVIRONMENT=development

# .env.production
VITE_API_BASE_URL=https://api.dyad-cli-gateway.com
VITE_WS_BASE_URL=wss://api.dyad-cli-gateway.com
VITE_ENVIRONMENT=production
```

## Authentication

### Token-Based Authentication

The application uses JWT tokens with automatic refresh:

```typescript
// Authentication flow
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Login
const login = async (credentials: LoginCredentials): Promise<AuthTokens> => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

// Token refresh
const refreshToken = async (): Promise<AuthTokens> => {
  const response = await apiClient.post('/auth/refresh', {}, {
    withCredentials: true, // Include HttpOnly cookie
  });
  return response.data;
};
```

### Automatic Token Management

```typescript
// src/lib/api-client.ts
class AuthManager {
  private tokens: AuthTokens | null = null;
  
  // Automatic token injection
  getAuthHeaders(): Record<string, string> {
    const token = this.getValidToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  
  // Auto-refresh on expiration
  async ensureValidToken(): Promise<string | null> {
    if (this.isTokenExpired()) {
      await this.refreshTokens();
    }
    return this.tokens?.accessToken || null;
  }
}
```

## API Client Setup

### Axios Configuration

```typescript
// src/lib/api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    async (config) => {
      // Add authentication
      const token = await authManager.ensureValidToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add CSRF token for state-changing operations
      if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Handle 401 errors with token refresh
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        try {
          await authManager.refreshTokens();
          const token = authManager.getAccessToken();
          error.config.headers.Authorization = `Bearer ${token}`;
          return client.request(error.config);
        } catch (refreshError) {
          // Redirect to login
          window.location.href = '/login';
        }
      }
      
      return Promise.reject(new ApiError(error));
    }
  );

  return client;
};
```

### Custom Error Class

```typescript
// src/lib/error-handling.ts
export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, any>;

  constructor(error: any) {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    super(message);
    
    this.name = 'ApiError';
    this.status = error.response?.status || 500;
    this.code = error.response?.data?.code || 'UNKNOWN_ERROR';
    this.details = error.response?.data?.details;
  }

  isNetworkError(): boolean {
    return !this.status || this.status === 0;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}
```

## Service Layer

### Provider Service

```typescript
// src/services/providers.ts
export class ProviderService {
  // Get all providers
  static async getProviders(params?: GetProvidersParams): Promise<PaginatedResponse<Provider>> {
    const response = await apiClient.get('/admin/providers', { params });
    return response.data;
  }

  // Create provider
  static async createProvider(data: CreateProviderRequest): Promise<Provider> {
    const response = await apiClient.post('/admin/providers', data);
    return response.data;
  }

  // Update provider
  static async updateProvider(id: string, data: UpdateProviderRequest): Promise<Provider> {
    const response = await apiClient.put(`/admin/providers/${id}`, data);
    return response.data;
  }

  // Delete provider
  static async deleteProvider(id: string): Promise<void> {
    await apiClient.delete(`/admin/providers/${id}`);
  }

  // Test provider
  static async testProvider(id: string, testData: ProviderTestRequest): Promise<ProviderTestResult> {
    const response = await apiClient.post(`/admin/providers/${id}/test`, testData);
    return response.data;
  }

  // Bulk operations
  static async bulkUpdateProviders(operations: BulkOperation[]): Promise<BulkOperationResult> {
    const response = await apiClient.post('/admin/providers/bulk', { operations });
    return response.data;
  }
}
```

### Chat Service with Streaming

```typescript
// src/services/chat.ts
export class ChatService {
  // Standard chat completion
  static async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await apiClient.post('/v1/chat/completions', request);
    return response.data;
  }

  // Streaming chat completion
  static async createStreamingChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authManager.getValidToken()}`,
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                onChunk(content);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', data);
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Streaming failed'));
    }
  }
}
```

## Error Handling

### Global Error Handler

```typescript
// src/lib/error-handling.ts
export const handleApiError = (error: ApiError, context?: string): void => {
  // Log error for debugging
  console.error(`API Error${context ? ` in ${context}` : ''}:`, {
    message: error.message,
    status: error.status,
    code: error.code,
    details: error.details,
  });

  // Show user-friendly message
  if (error.isNetworkError()) {
    toast.error('Network error. Please check your connection.');
  } else if (error.status === 401) {
    toast.error('Authentication required. Please log in.');
  } else if (error.status === 403) {
    toast.error('You do not have permission to perform this action.');
  } else if (error.status === 404) {
    toast.error('The requested resource was not found.');
  } else if (error.status === 429) {
    toast.error('Too many requests. Please try again later.');
  } else if (error.isServerError()) {
    toast.error('Server error. Please try again later.');
  } else {
    toast.error(error.message || 'An unexpected error occurred.');
  }
};

// React Query error handler
export const queryErrorHandler = (error: unknown): void => {
  if (error instanceof ApiError) {
    handleApiError(error, 'Query');
  } else {
    console.error('Query error:', error);
    toast.error('An unexpected error occurred.');
  }
};
```

### Component Error Boundaries

```typescript
// src/components/ui/error-boundary.tsx
export const ApiErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof ApiError ? error.message : 'An unexpected error occurred'}
          </p>
          <Button onClick={resetError}>Try again</Button>
        </div>
      )}
      onError={(error) => {
        if (error instanceof ApiError) {
          handleApiError(error, 'Component');
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

## Real-time Updates

### WebSocket Integration

```typescript
// src/services/websocket.ts
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): void {
    const wsUrl = `${import.meta.env.VITE_WS_BASE_URL}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Authenticate WebSocket connection
      this.send({
        type: 'auth',
        token: authManager.getAccessToken(),
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'provider_updated':
        // Invalidate provider queries
        queryClient.invalidateQueries({ queryKey: ['providers'] });
        break;
      case 'system_metrics':
        // Update metrics cache
        queryClient.setQueryData(['system', 'metrics'], data.payload);
        break;
      case 'health_check':
        // Update health status
        queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        break;
    }
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
}
```

## Caching Strategy

### React Query Configuration

```typescript
// src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 404) {
          return false; // Don't retry 404s
        }
        return failureCount < 3;
      },
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Global mutation error handler
      onError: (error) => {
        if (error instanceof ApiError) {
          handleApiError(error, 'Mutation');
        }
      },
    },
  },
});

// Cache invalidation patterns
export const invalidateProviderQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['providers'] });
};

export const invalidateSystemQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['system'] });
};
```

### Optimistic Updates

```typescript
// src/hooks/api/use-providers.ts
export const useUpdateProvider = () => {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProviderRequest }) =>
      ProviderService.updateProvider(id, data),
    
    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['providers'] });
      
      // Snapshot previous value
      const previousProviders = queryClient.getQueryData(['providers']);
      
      // Optimistically update
      queryClient.setQueryData(['providers'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((provider: Provider) =>
            provider._id === id ? { ...provider, ...data } : provider
          ),
        };
      });
      
      return { previousProviders };
    },
    
    // Rollback on error
    onError: (error, variables, context) => {
      if (context?.previousProviders) {
        queryClient.setQueryData(['providers'], context.previousProviders);
      }
      handleApiError(error as ApiError, 'Update Provider');
    },
    
    // Refetch on success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });
};
```

## Testing API Integration

### Mock Service Worker Setup

```typescript
// src/test/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Providers
  rest.get('/api/v1/admin/providers', (req, res, ctx) => {
    return res(
      ctx.json({
        results: mockProviders,
        totalResults: mockProviders.length,
        page: 1,
        totalPages: 1,
        limit: 10,
      })
    );
  }),

  rest.post('/api/v1/admin/providers', (req, res, ctx) => {
    return res(ctx.json(mockProvider));
  }),

  // Chat completions
  rest.post('/api/v1/chat/completions', (req, res, ctx) => {
    return res(ctx.json(mockChatCompletion));
  }),

  // System health
  rest.get('/api/v1/system/health', (req, res, ctx) => {
    return res(ctx.json({ status: 'healthy', uptime: 12345 }));
  }),
];
```

### Integration Tests

```typescript
// src/test/api-integration.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProviders } from '@/hooks/api/use-providers';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('API Integration', () => {
  it('should fetch providers successfully', async () => {
    const { result } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.results).toHaveLength(mockProviders.length);
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    server.use(
      rest.get('/api/v1/admin/providers', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );

    const { result } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: 401 Unauthorized errors
**Solution**: 
- Check if tokens are properly stored and sent
- Verify token expiration and refresh logic
- Ensure CSRF tokens are included for state-changing operations

```typescript
// Debug authentication
const debugAuth = () => {
  console.log('Access Token:', authManager.getAccessToken());
  console.log('Token Expired:', authManager.isTokenExpired());
  console.log('CSRF Token:', getCSRFToken());
};
```

#### 2. CORS Issues

**Problem**: Cross-origin request blocked
**Solution**:
- Ensure backend CORS configuration includes frontend domain
- Check if credentials are properly included in requests

```typescript
// CORS debugging
const testCORS = async () => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/api/v1/system/health`, {
      method: 'GET',
      credentials: 'include',
    });
    console.log('CORS test successful:', response.status);
  } catch (error) {
    console.error('CORS test failed:', error);
  }
};
```

#### 3. Network Timeouts

**Problem**: Requests timing out
**Solution**:
- Increase timeout values for slow operations
- Implement proper loading states
- Add retry logic with exponential backoff

```typescript
// Custom timeout configuration
const createProviderWithTimeout = async (data: CreateProviderRequest) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

  try {
    const response = await apiClient.post('/admin/providers', data, {
      signal: controller.signal,
    });
    return response.data;
  } finally {
    clearTimeout(timeoutId);
  }
};
```

#### 4. WebSocket Connection Issues

**Problem**: WebSocket disconnections
**Solution**:
- Implement reconnection logic with exponential backoff
- Handle authentication for WebSocket connections
- Gracefully degrade when WebSocket is unavailable

```typescript
// WebSocket debugging
const debugWebSocket = () => {
  console.log('WebSocket State:', ws?.readyState);
  console.log('Reconnect Attempts:', reconnectAttempts);
  console.log('WebSocket URL:', wsUrl);
};
```

### Debug Mode

Enable comprehensive API debugging:

```typescript
// Enable debug mode
localStorage.setItem('dyad-api-debug', 'true');

// This will log:
// - All API requests and responses
// - Authentication token status
// - WebSocket messages
// - Cache operations
// - Error details
```

### Performance Monitoring

Monitor API performance:

```typescript
// src/lib/performance-monitoring.ts
export const monitorApiPerformance = () => {
  // Track API response times
  apiClient.interceptors.request.use((config) => {
    config.metadata = { startTime: Date.now() };
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => {
      const duration = Date.now() - response.config.metadata.startTime;
      console.log(`API ${response.config.method?.toUpperCase()} ${response.config.url}: ${duration}ms`);
      return response;
    },
    (error) => {
      const duration = Date.now() - error.config?.metadata?.startTime;
      console.log(`API ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${duration}ms (ERROR)`);
      return Promise.reject(error);
    }
  );
};
```

## Best Practices

1. **Always handle errors gracefully** with user-friendly messages
2. **Use optimistic updates** for better user experience
3. **Implement proper loading states** for all async operations
4. **Cache data appropriately** to reduce API calls
5. **Use TypeScript** for type safety across the API layer
6. **Test API integration** with both unit and integration tests
7. **Monitor performance** and implement timeouts
8. **Handle offline scenarios** gracefully
9. **Implement proper authentication** with secure token storage
10. **Use WebSocket** for real-time updates when available

## API Endpoints Reference

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

### Providers
- `GET /api/v1/admin/providers` - List providers
- `POST /api/v1/admin/providers` - Create provider
- `GET /api/v1/admin/providers/:id` - Get provider
- `PUT /api/v1/admin/providers/:id` - Update provider
- `DELETE /api/v1/admin/providers/:id` - Delete provider
- `POST /api/v1/admin/providers/:id/test` - Test provider

### OpenAI v1 Compatibility
- `GET /api/v1/models` - List available models
- `POST /api/v1/chat/completions` - Chat completions
- `POST /api/v1/embeddings` - Generate embeddings

### System
- `GET /api/v1/system/health` - System health
- `GET /api/v1/system/metrics` - System metrics
- `GET /api/v1/system/logs` - System logs

For complete API documentation, refer to the OpenAPI specification in the backend repository.