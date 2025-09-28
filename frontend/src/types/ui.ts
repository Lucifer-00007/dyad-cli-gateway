/**
 * UI-specific types for components, forms, and application state
 */

import { ReactNode } from 'react';
import { Provider, ProviderType, ModelMapping, AdapterConfig } from './api';

// Theme and UI State
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
}

// Navigation and Layout
export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: NavigationItem[];
}

// Data Table Types
export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => ReactNode;
}

export interface TableAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: (row: T) => void;
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  key: string;
  value: unknown;
  operator?: 'eq' | 'ne' | 'contains' | 'startsWith' | 'endsWith';
}

// Form Types
export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'file';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: unknown) => string | undefined;
  };
  dependsOn?: string;
  showWhen?: (values: Record<string, unknown>) => boolean;
}

export interface ProviderFormData {
  name: string;
  slug: string;
  type: ProviderType;
  description: string;
  enabled: boolean;
  models: ModelMapping[];
  adapterConfig: AdapterConfig;
  credentials: Record<string, string>;
}

// Provider-specific form configurations
export interface SpawnCliFormConfig {
  command: string;
  args: string[];
  dockerSandbox: boolean;
  sandboxImage: string;
  timeoutSeconds: number;
  memoryLimit: string;
  cpuLimit: string;
}

export interface HttpSdkFormConfig {
  baseUrl: string;
  headers: Array<{ key: string; value: string }>;
  timeoutSeconds: number;
  retryAttempts: number;
}

export interface ProxyFormConfig {
  proxyUrl: string;
  timeoutSeconds: number;
  retryAttempts: number;
}

export interface LocalFormConfig {
  localUrl: string;
  healthCheckPath: string;
  timeoutSeconds: number;
  retryAttempts: number;
}

// Modal and Dialog Types
export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ModalState {
  isOpen: boolean;
  type: 'create' | 'edit' | 'delete' | 'test' | 'view';
  data?: unknown;
}

// Loading and Error States
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  details?: string;
  code?: string;
}

// Chat Playground Types
export interface ChatSession {
  id: string;
  name: string;
  model: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    latency?: number;
    model?: string;
  };
}

export interface StreamingState {
  isStreaming: boolean;
  content: string;
  isComplete: boolean;
  error?: string;
}

// Test and Monitoring Types
export interface TestConfiguration {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface TestResult {
  id: string;
  providerId: string;
  providerName: string;
  configuration: TestConfiguration;
  response?: {
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
  duration: number;
  timestamp: string;
  status: 'success' | 'failure';
}

// Monitoring Dashboard Types
export interface MetricsTimeRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  color?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: Array<{
    id: string;
    name: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastChecked: string;
  }>;
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    averageLatency: number;
    uptime: number;
  };
}

// Log Viewer Types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  providerId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface LogFilter {
  level?: string[];
  source?: string[];
  providerId?: string;
  timeRange?: MetricsTimeRange;
  search?: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

// Feature Flags
export interface FeatureFlags {
  enableStreaming: boolean;
  enableBulkOperations: boolean;
  enableAdvancedMetrics: boolean;
  enableExportFeatures: boolean;
  enableChatPlayground: boolean;
}

// Application State
export interface AppState {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  } | null;
  theme: ThemeConfig;
  featureFlags: FeatureFlags;
  notifications: Notification[];
}

// Accessibility Types
export interface AccessibilityConfig {
  announcements: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
}

// Export utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;