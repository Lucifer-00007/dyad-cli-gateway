/**
 * Enhanced Zod validation schemas for adapter configurations
 * Provides comprehensive validation for all adapter types with detailed error messages
 */

import { z } from 'zod';

// Common validation patterns
const urlSchema = z.string().url('Must be a valid URL');
const positiveIntSchema = z.number().int().positive('Must be a positive integer');
const timeoutSchema = z.number().int().min(1, 'Minimum 1 second').max(300, 'Maximum 300 seconds');
const slugSchema = z.string()
  .min(1, 'Required')
  .max(50, 'Maximum 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed');

// Model mapping schema with enhanced validation
export const modelMappingSchema = z.object({
  dyadModelId: z.string()
    .min(1, 'Dyad model ID is required')
    .max(100, 'Maximum 100 characters')
    .regex(/^[a-zA-Z0-9\-_.]+$/, 'Only alphanumeric characters, hyphens, underscores, and dots allowed'),
  adapterModelId: z.string()
    .min(1, 'Adapter model ID is required')
    .max(100, 'Maximum 100 characters'),
  maxTokens: z.number()
    .int('Must be an integer')
    .positive('Must be positive')
    .max(1000000, 'Maximum 1,000,000 tokens')
    .optional(),
  contextWindow: z.number()
    .int('Must be an integer')
    .positive('Must be positive')
    .max(2000000, 'Maximum 2,000,000 tokens')
    .optional(),
  supportsStreaming: z.boolean().default(false),
  supportsEmbeddings: z.boolean().default(false),
  costPerToken: z.number()
    .positive('Must be positive')
    .max(1, 'Maximum cost per token is 1.0')
    .optional(),
});

// Spawn-CLI adapter configuration schema
export const spawnCliConfigSchema = z.object({
  command: z.string()
    .min(1, 'Command is required')
    .max(500, 'Maximum 500 characters')
    .refine(
      (cmd) => !cmd.includes('..') && !cmd.includes(';') && !cmd.includes('|'),
      'Command contains potentially unsafe characters'
    ),
  args: z.array(z.string().max(200, 'Argument too long')).default([]),
  dockerSandbox: z.boolean().default(false),
  sandboxImage: z.string()
    .max(200, 'Maximum 200 characters')
    .regex(/^[a-zA-Z0-9\-_./:]+$/, 'Invalid Docker image format')
    .optional(),
  memoryLimit: z.string()
    .regex(/^\d+[kmg]?$/i, 'Format: number followed by k, m, or g (e.g., 512m)')
    .optional(),
  cpuLimit: z.string()
    .regex(/^\d*\.?\d+$/, 'Must be a decimal number (e.g., 0.5, 1.0)')
    .optional(),
  timeoutSeconds: timeoutSchema.default(30),
  workingDirectory: z.string()
    .max(500, 'Maximum 500 characters')
    .optional(),
  environmentVariables: z.record(
    z.string().max(100, 'Environment variable name too long'),
    z.string().max(1000, 'Environment variable value too long')
  ).optional(),
  retryAttempts: z.number()
    .int('Must be an integer')
    .min(0, 'Minimum 0 retries')
    .max(5, 'Maximum 5 retries')
    .default(1),
});

// HTTP-SDK adapter configuration schema
export const httpSdkConfigSchema = z.object({
  baseUrl: urlSchema,
  authType: z.enum(['none', 'api-key', 'bearer', 'basic', 'oauth2'], {
    errorMap: () => ({ message: 'Must be one of: none, api-key, bearer, basic, oauth2' })
  }).default('api-key'),
  headers: z.record(
    z.string()
      .min(1, 'Header name required')
      .max(100, 'Header name too long')
      .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid header name format'),
    z.string().max(1000, 'Header value too long')
  ).optional(),
  timeoutSeconds: timeoutSchema.default(30),
  retryAttempts: z.number()
    .int('Must be an integer')
    .min(0, 'Minimum 0 retries')
    .max(5, 'Maximum 5 retries')
    .default(3),
  maxConcurrentRequests: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 concurrent request')
    .max(100, 'Maximum 100 concurrent requests')
    .default(10),
  region: z.string()
    .max(50, 'Maximum 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Invalid region format')
    .optional(),
  modelPrefix: z.string()
    .max(50, 'Maximum 50 characters')
    .optional(),
});

// Proxy adapter configuration schema
export const proxyConfigSchema = z.object({
  proxyUrl: urlSchema,
  apiKeyHeaderName: z.string()
    .min(1, 'API key header name is required')
    .max(100, 'Maximum 100 characters')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid header name format')
    .default('Authorization'),
  forwardHeaders: z.array(
    z.string()
      .min(1, 'Header name required')
      .max(100, 'Header name too long')
      .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid header name format')
  ).default([]),
  transformRequest: z.boolean().default(false),
  transformResponse: z.boolean().default(false),
  timeoutSeconds: timeoutSchema.default(30),
  retryAttempts: z.number()
    .int('Must be an integer')
    .min(0, 'Minimum 0 retries')
    .max(5, 'Maximum 5 retries')
    .default(3),
  maxConcurrentRequests: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 concurrent request')
    .max(100, 'Maximum 100 concurrent requests')
    .default(10),
});

// Local adapter configuration schema
export const localConfigSchema = z.object({
  localUrl: urlSchema,
  healthCheckPath: z.string()
    .min(1, 'Health check path is required')
    .max(200, 'Maximum 200 characters')
    .regex(/^\/[a-zA-Z0-9\-_./]*$/, 'Must start with / and contain valid path characters')
    .default('/health'),
  protocol: z.enum(['http', 'grpc'], {
    errorMap: () => ({ message: 'Must be either http or grpc' })
  }).default('http'),
  modelPath: z.string()
    .max(200, 'Maximum 200 characters')
    .regex(/^\/[a-zA-Z0-9\-_./]*$/, 'Must start with / and contain valid path characters')
    .optional(),
  timeoutSeconds: timeoutSchema.default(30),
  retryAttempts: z.number()
    .int('Must be an integer')
    .min(0, 'Minimum 0 retries')
    .max(5, 'Maximum 5 retries')
    .default(3),
  maxConcurrentRequests: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 concurrent request')
    .max(100, 'Maximum 100 concurrent requests')
    .default(10),
  keepAlive: z.boolean().default(true),
  connectionPoolSize: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 connection')
    .max(50, 'Maximum 50 connections')
    .default(5),
});

// Base provider schema
export const baseProviderSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Maximum 100 characters')
    .trim(),
  slug: slugSchema,
  type: z.enum(['spawn-cli', 'http-sdk', 'proxy', 'local'], {
    errorMap: () => ({ message: 'Must be one of: spawn-cli, http-sdk, proxy, local' })
  }),
  description: z.string()
    .max(500, 'Maximum 500 characters')
    .trim()
    .optional(),
  enabled: z.boolean().default(true),
  models: z.array(modelMappingSchema)
    .min(1, 'At least one model mapping is required')
    .max(50, 'Maximum 50 model mappings'),
});

// Credentials schema with validation
export const credentialsSchema = z.record(
  z.string()
    .min(1, 'Credential key required')
    .max(100, 'Credential key too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric characters and underscores allowed'),
  z.string()
    .min(1, 'Credential value required')
    .max(1000, 'Credential value too long')
).optional();

// Rate limits schema
export const rateLimitsSchema = z.object({
  requestsPerMinute: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 request per minute')
    .max(10000, 'Maximum 10,000 requests per minute'),
  tokensPerMinute: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum 1 token per minute')
    .max(1000000, 'Maximum 1,000,000 tokens per minute'),
}).optional();

// Dynamic schema creator based on provider type
export const createProviderSchema = (type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local') => {
  const configSchemas = {
    'spawn-cli': spawnCliConfigSchema,
    'http-sdk': httpSdkConfigSchema,
    'proxy': proxyConfigSchema,
    'local': localConfigSchema,
  };

  return baseProviderSchema.extend({
    adapterConfig: configSchemas[type],
    credentials: credentialsSchema,
    rateLimits: rateLimitsSchema,
  });
};

// Export individual schemas for use in components
export const providerSchemas = {
  'spawn-cli': createProviderSchema('spawn-cli'),
  'http-sdk': createProviderSchema('http-sdk'),
  'proxy': createProviderSchema('proxy'),
  'local': createProviderSchema('local'),
};

// Type inference helpers
export type ModelMappingFormData = z.infer<typeof modelMappingSchema>;
export type SpawnCliConfigFormData = z.infer<typeof spawnCliConfigSchema>;
export type HttpSdkConfigFormData = z.infer<typeof httpSdkConfigSchema>;
export type ProxyConfigFormData = z.infer<typeof proxyConfigSchema>;
export type LocalConfigFormData = z.infer<typeof localConfigSchema>;
export type BaseProviderFormData = z.infer<typeof baseProviderSchema>;
export type CredentialsFormData = z.infer<typeof credentialsSchema>;
export type RateLimitsFormData = z.infer<typeof rateLimitsSchema>;

// Validation helper functions
export const validateAdapterConfig = (type: string, config: unknown) => {
  const schema = providerSchemas[type as keyof typeof providerSchemas];
  if (!schema) {
    throw new Error(`Unknown provider type: ${type}`);
  }
  return schema.safeParse({ ...config, type });
};

export const getValidationErrors = (error: z.ZodError) => {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return errors;
};