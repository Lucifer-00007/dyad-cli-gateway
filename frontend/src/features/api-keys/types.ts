/**
 * API Keys feature types
 */

import { ApiKey, RateLimits } from '@/types';

export interface ApiKeyFormData {
  name: string;
  description?: string;
  permissions: ApiKeyPermission[];
  rateLimits: RateLimits;
  expiresAt?: Date;
  allowedProviders?: string[];
  allowedModels?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApiKeyPermission {
  id: string;
  name: string;
  description: string;
  category: 'read' | 'write' | 'admin';
  enabled: boolean;
}

export interface ApiKeyUsageMetrics {
  keyId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageLatency: number;
    requestsByHour: Array<{
      hour: string;
      requests: number;
      tokens: number;
    }>;
    requestsByProvider: Array<{
      providerId: string;
      providerName: string;
      requests: number;
      tokens: number;
    }>;
    requestsByModel: Array<{
      model: string;
      requests: number;
      tokens: number;
    }>;
    errorsByType: Array<{
      errorType: string;
      count: number;
    }>;
  };
}

export interface ApiKeyAuditLog {
  id: string;
  keyId: string;
  action: 'created' | 'updated' | 'revoked' | 'regenerated' | 'used' | 'failed_auth';
  timestamp: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details: {
    oldValues?: Partial<ApiKey>;
    newValues?: Partial<ApiKey>;
    requestPath?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ApiKeyStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  totalRequestsToday: number;
  totalTokensToday: number;
  totalRequestsThisMonth: number;
  totalTokensThisMonth: number;
  averageRequestsPerKey: number;
  topKeysByUsage: Array<{
    keyId: string;
    keyName: string;
    requests: number;
    tokens: number;
  }>;
}

export interface ApiKeySecureDisplayState {
  isVisible: boolean;
  hasBeenViewed: boolean;
  expiresAt: Date;
}

export interface BulkApiKeyOperation {
  action: 'enable' | 'disable' | 'revoke' | 'delete' | 'update_permissions' | 'update_rate_limits';
  keyIds: string[];
  parameters?: {
    permissions?: string[];
    rateLimits?: RateLimits;
  };
}