import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock data
const mockProvider = {
  _id: 'provider-1',
  name: 'Test Provider',
  slug: 'test-provider',
  type: 'http-sdk' as const,
  enabled: true,
  adapterConfig: {
    baseUrl: 'https://api.example.com',
    authType: 'api-key' as const,
  },
  models: [],
  healthStatus: {
    status: 'healthy' as const,
    lastCheck: new Date().toISOString(),
    latency: 150,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Test wrapper
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

describe('API Services', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup test environment
  });

  describe('Basic functionality', () => {
    it('should create test wrapper', () => {
      const wrapper = createWrapper();
      expect(wrapper).toBeDefined();
    });

    it('should have mock provider data', () => {
      expect(mockProvider._id).toBe('provider-1');
      expect(mockProvider.type).toBe('http-sdk');
    });
  });
});