/**
 * Central export for all TypeScript types and interfaces
 */

// API types
export * from './api';

// UI types
export * from './ui';

// Re-export commonly used types for convenience
export type {
  Provider,
  ProviderType,
  ModelMapping,
  AdapterConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProvidersListResponse,
  ProviderTestResponse,
  ProviderHealthResponse,
  TestRequest,
  TestResult,
  TestHistory,
  TestTemplate,
  HealthCheckConfig,
  ProviderHealthHistory,
  SystemMetrics,
  ApiKey,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ErrorResponse,
} from './api';

export type {
  ProviderFormData,
  ConfirmationDialogProps,
  LoadingState,
  ErrorState,
  TestResult,
  SystemHealth,
  LogEntry,
  Notification,
  AppState,
  ThemeConfig,
  FeatureFlags,
} from './ui';