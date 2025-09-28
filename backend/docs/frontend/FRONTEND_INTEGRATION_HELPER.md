# Frontend Integration Helper Guide

## Overview

This guide provides practical examples, utilities, and step-by-step instructions for integrating a frontend application with the Dyad CLI Gateway. It includes ready-to-use code snippets, React hooks, and common integration patterns.

## Quick Start Integration

### 1. Environment Setup

Create a `.env` file in your frontend project:

```bash
# Frontend .env
VITE_API_BASE_URL=http://localhost:3000/v1
VITE_WS_BASE_URL=ws://localhost:3000
VITE_APP_NAME=Dyad Gateway Admin
VITE_ENABLE_DEV_TOOLS=true
```

### 2. API Client Setup

Create a centralized API client with error handling and authentication:

```typescript
// src/lib/api-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ApiError {
  message: string;
  type: string;
  code: string;
  details?: any;
}

class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication headers
        if (this.accessToken && config.url?.startsWith('/admin')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        } else if (this.apiKey && !config.url?.startsWith('/admin')) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = crypto.randomUUID();
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError = this.handleApiError(error);
        return Promise.reject(apiError);
      }
    );
  }

  private handleApiError(error: AxiosError): ApiError {
    if (error.response?.data) {
      const errorData = error.response.data as any;
      return {
        message: errorData.error?.message || 'An error occurred',
        type: errorData.error?.type || 'unknown_error',
        code: errorData.error?.code || 'unknown_code',
        details: errorData.error?.details,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        message: 'Request timeout',
        type: 'timeout_error',
        code: 'request_timeout',
      };
    }

    return {
      message: error.message || 'Network error',
      type: 'network_error',
      code: 'network_error',
    };
  }

  // Authentication methods
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  clearAuth() {
    this.apiKey = null;
    this.accessToken = null;
  }

  // Generic request method
  async request<T>(method: string, url: string, data?: any): Promise<T> {
    const response = await this.client.request({
      method,
      url,
      data,
    });
    return response.data;
  }

  // Convenience methods
  get<T>(url: string): Promise<T> {
    return this.request<T>('GET', url);
  }

  post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>('POST', url, data);
  }

  patch<T>(url: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', url, data);
  }

  delete<T>(url: string): Promise<T> {
    return this.request<T>('DELETE', url);
  }
}

export const apiClient = new ApiClient();
```

### 3. React Query Setup

Configure React Query for efficient data fetching:

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.code?.startsWith('4')) return false;
        return failureCount < 3;
      },
      onError: (error: any) => {
        toast.error(error.message || 'An error occurred');
      },
    },
    mutations: {
      onError: (error: any) => {
        toast.error(error.message || 'An error occurred');
      },
    },
  },
});
```

## Authentication Integration

### 1. Auth Context & Hook

```typescript
// src/contexts/auth-context.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../lib/api-client';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setApiKey: (apiKey: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('dyad_access_token');
    if (token) {
      apiClient.setAccessToken(token);
      // Verify token and get user info
      verifyToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      // Assuming you have a /me endpoint
      const userData = await apiClient.get<User>('/auth/me');
      setUser(userData);
    } catch (error) {
      // Token is invalid, clear it
      localStorage.removeItem('dyad_access_token');
      apiClient.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.post<{
      user: User;
      tokens: { access: { token: string } };
    }>('/auth/login', { email, password });

    const { user: userData, tokens } = response;
    const accessToken = tokens.access.token;

    localStorage.setItem('dyad_access_token', accessToken);
    apiClient.setAccessToken(accessToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('dyad_access_token');
    localStorage.removeItem('dyad_api_key');
    apiClient.clearAuth();
    setUser(null);
  };

  const setApiKey = (apiKey: string) => {
    localStorage.setItem('dyad_api_key', apiKey);
    apiClient.setApiKey(apiKey);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setApiKey }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 2. Protected Route Component

```typescript
// src/components/protected-route.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

## Data Fetching Hooks

### 1. Provider Management Hooks

```typescript
// src/hooks/use-providers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from 'sonner';

export interface Provider {
  id: string;
  name: string;
  type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';
  enabled: boolean;
  config: Record<string, any>;
  models: string[];
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderRequest {
  name: string;
  type: Provider['type'];
  enabled?: boolean;
  config: Record<string, any>;
  models: string[];
  description?: string;
}

// Get all providers
export const useProviders = (params?: {
  page?: number;
  limit?: number;
  enabled?: boolean;
  type?: Provider['type'];
}) => {
  return useQuery({
    queryKey: ['providers', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.enabled !== undefined) searchParams.set('enabled', params.enabled.toString());
      if (params?.type) searchParams.set('type', params.type);

      return apiClient.get<{
        results: Provider[];
        totalResults: number;
        page: number;
        totalPages: number;
      }>(`/admin/providers?${searchParams.toString()}`);
    },
  });
};

// Get single provider
export const useProvider = (providerId: string) => {
  return useQuery({
    queryKey: ['provider', providerId],
    queryFn: () => apiClient.get<Provider>(`/admin/providers/${providerId}`),
    enabled: !!providerId,
  });
};

// Create provider
export const useCreateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProviderRequest) =>
      apiClient.post<Provider>('/admin/providers', data),
    onSuccess: (newProvider) => {
      queryClient.invalidateQueries(['providers']);
      toast.success(`Provider "${newProvider.name}" created successfully`);
    },
  });
};

// Update provider
export const useUpdateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProviderRequest> }) =>
      apiClient.patch<Provider>(`/admin/providers/${id}`, data),
    onSuccess: (updatedProvider) => {
      queryClient.invalidateQueries(['providers']);
      queryClient.invalidateQueries(['provider', updatedProvider.id]);
      toast.success(`Provider "${updatedProvider.name}" updated successfully`);
    },
  });
};

// Delete provider
export const useDeleteProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) =>
      apiClient.delete(`/admin/providers/${providerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['providers']);
      toast.success('Provider deleted successfully');
    },
  });
};

// Test provider
export const useTestProvider = () => {
  return useMutation({
    mutationFn: ({ providerId, dryRun = false }: { providerId: string; dryRun?: boolean }) =>
      apiClient.post<{
        status: 'success' | 'failure';
        message: string;
        details: any;
      }>(`/admin/providers/${providerId}/test`, { dryRun }),
    onSuccess: (result) => {
      if (result.status === 'success') {
        toast.success('Provider test successful');
      } else {
        toast.error(`Provider test failed: ${result.message}`);
      }
    },
  });
};
```

### 2. API Key Management Hooks

```typescript
// src/hooks/use-api-keys.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from 'sonner';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  permissions: ('chat' | 'embeddings' | 'models')[];
  allowedModels: string[];
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    lastUsed?: string;
  };
  expiresAt?: string;
  createdAt: string;
  userId: string;
}

export interface CreateApiKeyRequest {
  name: string;
  userId: string;
  permissions: ApiKey['permissions'];
  allowedModels?: string[];
  rateLimit?: Partial<ApiKey['rateLimit']>;
  expiresAt?: string;
}

export const useApiKeys = (params?: {
  page?: number;
  limit?: number;
  enabled?: boolean;
  userId?: string;
}) => {
  return useQuery({
    queryKey: ['apiKeys', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.enabled !== undefined) searchParams.set('enabled', params.enabled.toString());
      if (params?.userId) searchParams.set('userId', params.userId);

      return apiClient.get<{
        results: ApiKey[];
        totalResults: number;
        page: number;
        totalPages: number;
      }>(`/admin/apikeys?${searchParams.toString()}`);
    },
  });
};

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) =>
      apiClient.post<{ apiKey: ApiKey; key: string }>('/admin/apikeys', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['apiKeys']);
      toast.success(`API key "${result.apiKey.name}" created successfully`);
      
      // Show the key to user (only time it's visible)
      toast.info(`Your API key: ${result.key}`, {
        duration: 10000,
        action: {
          label: 'Copy',
          onClick: () => navigator.clipboard.writeText(result.key),
        },
      });
    },
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ apiKeyId, reason }: { apiKeyId: string; reason?: string }) =>
      apiClient.post(`/admin/apikeys/${apiKeyId}/revoke`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries(['apiKeys']);
      toast.success('API key revoked successfully');
    },
  });
};
```

### 3. Chat Completion Hook

```typescript
// src/hooks/use-chat.ts
import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export const useChat = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      if (request.stream && onChunk) {
        // Handle streaming
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dyad_api_key')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return fullContent;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  onChunk(content);
                }
              } catch (e) {
                // Ignore parsing errors for malformed chunks
              }
            }
          }
        }

        return fullContent;
      } else {
        // Handle non-streaming
        const response = await apiClient.post<{
          choices: Array<{ message: ChatMessage }>;
          usage: { total_tokens: number };
        }>('/chat/completions', request);

        return response.choices[0]?.message?.content || '';
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
  };
};
```

## UI Components

### 1. Provider Form Component

```typescript
// src/components/provider-form.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { useCreateProvider, useUpdateProvider, Provider } from '../hooks/use-providers';

const providerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: z.enum(['spawn-cli', 'http-sdk', 'proxy', 'local']),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  models: z.string().min(1, 'At least one model is required'),
  config: z.object({
    endpoint: z.string().url().optional(),
    apiKey: z.string().optional(),
    timeout: z.number().min(1000).max(300000).optional(),
  }),
});

type ProviderFormData = z.infer<typeof providerSchema>;

interface ProviderFormProps {
  provider?: Provider;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ProviderForm: React.FC<ProviderFormProps> = ({
  provider,
  onSuccess,
  onCancel,
}) => {
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();

  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: provider?.name || '',
      type: provider?.type || 'http-sdk',
      enabled: provider?.enabled ?? true,
      description: provider?.description || '',
      models: provider?.models.join(', ') || '',
      config: {
        endpoint: provider?.config.endpoint || '',
        apiKey: provider?.config.apiKey || '',
        timeout: provider?.config.timeout || 30000,
      },
    },
  });

  const onSubmit = async (data: ProviderFormData) => {
    try {
      const payload = {
        ...data,
        models: data.models.split(',').map(m => m.trim()).filter(Boolean),
      };

      if (provider) {
        await updateProvider.mutateAsync({ id: provider.id, data: payload });
      } else {
        await createProvider.mutateAsync(payload);
      }

      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isLoading = createProvider.isLoading || updateProvider.isLoading;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Provider Name</Label>
          <Input
            id="name"
            {...form.register('name')}
            placeholder="My Provider"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Provider Type</Label>
          <Select
            value={form.watch('type')}
            onValueChange={(value) => form.setValue('type', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http-sdk">HTTP SDK</SelectItem>
              <SelectItem value="spawn-cli">Spawn CLI</SelectItem>
              <SelectItem value="proxy">Proxy</SelectItem>
              <SelectItem value="local">Local Model</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="models">Supported Models (comma-separated)</Label>
        <Input
          id="models"
          {...form.register('models')}
          placeholder="gpt-3.5-turbo, gpt-4"
        />
        {form.formState.errors.models && (
          <p className="text-sm text-red-600">{form.formState.errors.models.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="endpoint">API Endpoint</Label>
        <Input
          id="endpoint"
          {...form.register('config.endpoint')}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <Input
          id="apiKey"
          type="password"
          {...form.register('config.apiKey')}
          placeholder="sk-..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...form.register('description')}
          placeholder="Optional description"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={form.watch('enabled')}
          onCheckedChange={(checked) => form.setValue('enabled', checked)}
        />
        <Label htmlFor="enabled">Enable Provider</Label>
      </div>

      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : provider ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
```

### 2. Provider List Component

```typescript
// src/components/provider-list.tsx
import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Play, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { useProviders, useDeleteProvider, useTestProvider } from '../hooks/use-providers';
import { ProviderForm } from './provider-form';

export const ProviderList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: providersData, isLoading } = useProviders();
  const deleteProvider = useDeleteProvider();
  const testProvider = useTestProvider();

  const providers = providersData?.results || [];

  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(search.toLowerCase()) ||
    provider.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleTest = async (providerId: string) => {
    try {
      await testProvider.mutateAsync({ providerId });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (providerId: string) => {
    if (confirm('Are you sure you want to delete this provider?')) {
      try {
        await deleteProvider.mutateAsync(providerId);
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      unhealthy: 'destructive',
      unknown: 'secondary',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading providers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Providers</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Provider</DialogTitle>
            </DialogHeader>
            <ProviderForm
              onSuccess={() => setIsCreateDialogOpen(false)}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProviders.map((provider) => (
          <Card key={provider.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">{provider.name}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setSelectedProvider(provider);
                    setIsEditDialogOpen(true);
                  }}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTest(provider.id)}>
                    <Play className="h-4 w-4 mr-2" />
                    Test
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(provider.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Badge variant="outline">{provider.type}</Badge>
                  {getStatusBadge(provider.healthStatus)}
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Models:</p>
                  <p className="text-sm font-mono">{provider.models.join(', ')}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Last Health Check:</p>
                  <p className="text-sm">
                    {new Date(provider.lastHealthCheck).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
          </DialogHeader>
          {selectedProvider && (
            <ProviderForm
              provider={selectedProvider}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setSelectedProvider(null);
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedProvider(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

### 3. Chat Playground Component

```typescript
// src/components/chat-playground.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { useChat, ChatMessage } from '../hooks/use-chat';

export const ChatPlayground: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([150]);
  const [streaming, setStreaming] = useState(true);
  const [currentResponse, setCurrentResponse] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, isLoading } = useChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setCurrentResponse('');

    try {
      if (streaming) {
        // Handle streaming response
        let assistantMessage: ChatMessage = { role: 'assistant', content: '' };
        setMessages([...newMessages, assistantMessage]);

        await sendMessage(
          {
            model,
            messages: newMessages,
            temperature: temperature[0],
            max_tokens: maxTokens[0],
            stream: true,
          },
          (chunk) => {
            assistantMessage.content += chunk;
            setCurrentResponse(assistantMessage.content);
            setMessages([...newMessages, { ...assistantMessage }]);
          }
        );
      } else {
        // Handle non-streaming response
        const response = await sendMessage({
          model,
          messages: newMessages,
          temperature: temperature[0],
          max_tokens: maxTokens[0],
          stream: false,
        });

        const assistantMessage: ChatMessage = { role: 'assistant', content: response };
        setMessages([...newMessages, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <h1 className="text-2xl font-bold">Chat Playground</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' ? 'bg-blue-500 ml-2' : 'bg-gray-500 mr-2'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="w-80 border-l bg-gray-50">
        <Card className="m-4">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Temperature: {temperature[0]}</Label>
              <Slider
                value={temperature}
                onValueChange={setTemperature}
                max={2}
                min={0}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Max Tokens: {maxTokens[0]}</Label>
              <Slider
                value={maxTokens}
                onValueChange={setMaxTokens}
                max={4000}
                min={1}
                step={1}
                className="mt-2"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="streaming"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
              />
              <Label htmlFor="streaming">Enable Streaming</Label>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setCurrentResponse('');
              }}
              className="w-full"
            >
              Clear Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

## Error Handling & Loading States

### 1. Error Boundary Component

```typescript
// src/components/error-boundary.tsx
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-sm">
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 2. Loading Skeleton Components

```typescript
// src/components/loading-skeleton.tsx
import React from 'react';

export const ProviderListSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="border rounded-lg p-6 animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-3">
          <div className="flex space-x-2">
            <div className="h-6 bg-gray-200 rounded w-16"></div>
            <div className="h-6 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex space-x-4 animate-pulse">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-10 bg-gray-200 rounded flex-1"></div>
        ))}
      </div>
    ))}
  </div>
);
```

This comprehensive integration guide provides everything needed to build a robust frontend for the Dyad CLI Gateway, with practical examples and reusable components that follow modern React best practices.