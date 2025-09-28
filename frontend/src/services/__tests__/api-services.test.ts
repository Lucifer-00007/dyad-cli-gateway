/**
 * API services integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { 
  providersService, 
  apiKeysService, 
  metricsService, 
  chatService,
  systemService 
} from '@/services';
import { 
  useProviders, 
  useProvider, 
  useCreateProvider, 
  useUpdateProvider, 
  useDeleteProvider,
  useTestProvider 
} from '@/hooks/api/providers';
import { 
  useApiKeys, 
  useCreateApiKey, 
  useRevokeApiKey 
} from '@/hooks/api/api-keys';
import { 
  useSystemMetrics, 
  useProviderHealth 
} from '@/hooks/api/metrics';

// Mock data
const mockProvider = {
  _id: 'provider-1',
  name: 'Test Provider',
  slug: 'test-provider',
  type: 'http-sdk',
  description: 'A test provider',
  enabled: true,
  adapterConfig: {
    baseUrl: 'https://api.example.com',
    authType: 'api-key',
  },
  models: [
    {
      dyadModelId: 'gpt-4',
      adapterModelId: 'gpt-4-turbo',
      maxTokens: 4096,
    },
  ],
  healthStatus: {
    status: 'healthy',
    lastChecked: '2023-01-01T00:00:00Z',
    responseTime: 150,
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockApiKey = {
  _id: 'key-1',
  name: 'Test API Key',
  keyId: 'ak_test123',
  permissions: ['providers:read', 'providers:write'],
  rateLimit: {
    requestsPerMinute: 100,
    requestsPerHour: 1000,
  },
  usage: {
    totalRequests: 50,
    lastUsed: '2023-01-01T00:00:00Z',
  },
  enabled: true,
  createdAt: '2023-01-01T00:00:00Z',
  expiresAt: '2024-01-01T00:00:00Z',
};

const mockMetrics = {
  totalRequests: 1000,
  successRate: 0.95,
  averageLatency: 250,
  activeProviders: 5,
  errorRate: 0.05,
  uptime: 0.999,
  requestsOverTime: [
    { timestamp: '2023-01-01T00:00:00Z', value: 100 },
    { timestamp: '2023-01-01T01:00:00Z', value: 150 },
  ],
};

// MSW server setup
const server = setupServer(
  // Providers endpoints
  rest.get('/api/v1/admin/providers', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        results: [mockProvider],
        totalResults: 1,
        page: 1,
        totalPages: 1,
        limit: 10,
      },
    }));
  }),

  rest.get('/api/v1/admin/providers/:id', (req, res, ctx) => {
    const { id } = req.params;
    if (id === 'provider-1') {
      return res(ctx.json({
        success: true,
        data: mockProvider,
      }));
    }
    return res(ctx.status(404), ctx.json({
      success: false,
      message: 'Provider not found',
    }));
  }),

  rest.post('/api/v1/admin/providers', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: { ...mockProvider, _id: 'new-provider' },
    }));
  }),

  rest.put('/api/v1/admin/providers/:id', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: mockProvider,
    }));
  }),

  rest.delete('/api/v1/admin/providers/:id', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'Provider deleted successfully',
    }));
  }),

  rest.post('/api/v1/admin/providers/:id/test', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        success: true,
        latency: 150,
        response: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Test response',
              },
            },
          ],
        },
      },
    }));
  }),

  // API Keys endpoints
  rest.get('/api/v1/admin/api-keys', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        results: [mockApiKey],
        totalResults: 1,
        page: 1,
        totalPages: 1,
        limit: 10,
      },
    }));
  }),

  rest.post('/api/v1/admin/api-keys', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        ...mockApiKey,
        _id: 'new-key',
        key: 'ak_newkey123456789',
      },
    }));
  }),

  rest.delete('/api/v1/admin/api-keys/:id', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      message: 'API key revoked successfully',
    }));
  }),

  // Metrics endpoints
  rest.get('/api/v1/admin/metrics/system', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: mockMetrics,
    }));
  }),

  rest.get('/api/v1/admin/metrics/providers/health', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: [
        {
          providerId: 'provider-1',
          status: 'healthy',
          responseTime: 150,
          lastChecked: '2023-01-01T00:00:00Z',
        },
      ],
    }));
  }),

  // Chat endpoints
  rest.post('/api/v1/chat/completions', (req, res, ctx) => {
    return res(ctx.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18,
      },
    }));
  }),

  // System endpoints
  rest.get('/api/v1/admin/system/health', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: 86400,
        version: '1.0.0',
        database: 'connected',
        redis: 'connected',
      },
    }));
  }),
);

beforeEach(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Test wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Providers Service', () => {
  it('should fetch providers list', async () => {
    const result = await providersService.getProviders();
    
    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(1);
    expect(result.data.results[0]).toEqual(mockProvider);
  });

  it('should fetch single provider', async () => {
    const result = await providersService.getProvider('provider-1');
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockProvider);
  });

  it('should handle provider not found', async () => {
    await expect(providersService.getProvider('nonexistent')).rejects.toThrow();
  });

  it('should create provider', async () => {
    const providerData = {
      name: 'New Provider',
      slug: 'new-provider',
      type: 'http-sdk' as const,
      adapterConfig: {
        baseUrl: 'https://api.example.com',
        authType: 'api-key' as const,
      },
      models: [],
    };

    const result = await providersService.createProvider(providerData);
    
    expect(result.success).toBe(true);
    expect(result.data._id).toBe('new-provider');
  });

  it('should update provider', async () => {
    const updateData = {
      name: 'Updated Provider',
      description: 'Updated description',
    };

    const result = await providersService.updateProvider('provider-1', updateData);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockProvider);
  });

  it('should delete provider', async () => {
    const result = await providersService.deleteProvider('provider-1');
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Provider deleted successfully');
  });

  it('should test provider', async () => {
    const testRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const result = await providersService.testProvider('provider-1', testRequest);
    
    expect(result.success).toBe(true);
    expect(result.data.success).toBe(true);
    expect(result.data.latency).toBe(150);
  });
});

describe('API Keys Service', () => {
  it('should fetch API keys list', async () => {
    const result = await apiKeysService.getApiKeys();
    
    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(1);
    expect(result.data.results[0]).toEqual(mockApiKey);
  });

  it('should create API key', async () => {
    const keyData = {
      name: 'New API Key',
      permissions: ['providers:read'],
      rateLimit: {
        requestsPerMinute: 50,
        requestsPerHour: 500,
      },
    };

    const result = await apiKeysService.createApiKey(keyData);
    
    expect(result.success).toBe(true);
    expect(result.data._id).toBe('new-key');
    expect(result.data.key).toBe('ak_newkey123456789');
  });

  it('should revoke API key', async () => {
    const result = await apiKeysService.revokeApiKey('key-1');
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('API key revoked successfully');
  });
});

describe('Metrics Service', () => {
  it('should fetch system metrics', async () => {
    const result = await metricsService.getSystemMetrics();
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockMetrics);
  });

  it('should fetch provider health', async () => {
    const result = await metricsService.getProviderHealth();
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].providerId).toBe('provider-1');
    expect(result.data[0].status).toBe('healthy');
  });
});

describe('Chat Service', () => {
  it('should send chat completion request', async () => {
    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const result = await chatService.sendMessage(request);
    
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
    expect(result.usage.total_tokens).toBe(18);
  });
});

describe('System Service', () => {
  it('should fetch system health', async () => {
    const result = await systemService.getHealth();
    
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('healthy');
    expect(result.data.database).toBe('connected');
  });
});

describe('React Query Hooks', () => {
  describe('useProviders', () => {
    it('should fetch providers', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProviders(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0]).toEqual(mockProvider);
    });

    it('should handle loading state', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProviders(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useProvider', () => {
    it('should fetch single provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProvider('provider-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProvider);
    });

    it('should handle error for nonexistent provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProvider('nonexistent'), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useCreateProvider', () => {
    it('should create provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateProvider(), { wrapper });

      const providerData = {
        name: 'New Provider',
        slug: 'new-provider',
        type: 'http-sdk' as const,
        adapterConfig: {
          baseUrl: 'https://api.example.com',
          authType: 'api-key' as const,
        },
        models: [],
      };

      result.current.mutate(providerData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data._id).toBe('new-provider');
    });
  });

  describe('useUpdateProvider', () => {
    it('should update provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProvider(), { wrapper });

      const updateData = {
        id: 'provider-1',
        data: {
          name: 'Updated Provider',
          description: 'Updated description',
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(mockProvider);
    });
  });

  describe('useDeleteProvider', () => {
    it('should delete provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteProvider(), { wrapper });

      result.current.mutate('provider-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.message).toBe('Provider deleted successfully');
    });
  });

  describe('useTestProvider', () => {
    it('should test provider', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTestProvider(), { wrapper });

      const testData = {
        providerId: 'provider-1',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user' as const, content: 'Hello' }],
        },
      };

      result.current.mutate(testData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data.success).toBe(true);
      expect(result.current.data?.data.latency).toBe(150);
    });
  });

  describe('useApiKeys', () => {
    it('should fetch API keys', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useApiKeys(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0]).toEqual(mockApiKey);
    });
  });

  describe('useCreateApiKey', () => {
    it('should create API key', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateApiKey(), { wrapper });

      const keyData = {
        name: 'New API Key',
        permissions: ['providers:read'],
        rateLimit: {
          requestsPerMinute: 50,
          requestsPerHour: 500,
        },
      };

      result.current.mutate(keyData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data._id).toBe('new-key');
      expect(result.current.data?.data.key).toBe('ak_newkey123456789');
    });
  });

  describe('useSystemMetrics', () => {
    it('should fetch system metrics', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useSystemMetrics(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockMetrics);
    });
  });

  describe('useProviderHealth', () => {
    it('should fetch provider health', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProviderHealth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].providerId).toBe('provider-1');
    });
  });
});