/**
 * Enhanced error handling utilities and API response normalization
 */

import { AxiosError } from 'axios';
import { ApiError, ErrorResponse } from '@/types';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories for better handling
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'authorization' 
  | 'validation'
  | 'server'
  | 'client'
  | 'timeout'
  | 'rate_limit'
  | 'unknown';

// Enhanced error interface
export interface EnhancedApiError extends ApiError {
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  timestamp: string;
  context?: Record<string, any>;
}

// Error classification rules
const ERROR_CLASSIFICATION: Record<number, { category: ErrorCategory; severity: ErrorSeverity; retryable: boolean }> = {
  400: { category: 'validation', severity: 'medium', retryable: false },
  401: { category: 'authentication', severity: 'high', retryable: false },
  403: { category: 'authorization', severity: 'high', retryable: false },
  404: { category: 'client', severity: 'low', retryable: false },
  408: { category: 'timeout', severity: 'medium', retryable: true },
  409: { category: 'validation', severity: 'medium', retryable: false },
  422: { category: 'validation', severity: 'medium', retryable: false },
  429: { category: 'rate_limit', severity: 'medium', retryable: true },
  500: { category: 'server', severity: 'high', retryable: true },
  502: { category: 'server', severity: 'high', retryable: true },
  503: { category: 'server', severity: 'critical', retryable: true },
  504: { category: 'timeout', severity: 'high', retryable: true },
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Network connection issue. Please check your internet connection.',
  authentication: 'Authentication failed. Please log in again.',
  authorization: 'You don\'t have permission to perform this action.',
  validation: 'Please check your input and try again.',
  server: 'Server error occurred. Please try again later.',
  client: 'The requested resource was not found.',
  timeout: 'Request timed out. Please try again.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  unknown: 'An unexpected error occurred. Please try again.',
};

/**
 * Enhanced error handler that provides better error classification and user messages
 */
export const enhanceApiError = (error: unknown, context?: Record<string, any>): EnhancedApiError => {
  let baseError: ApiError;
  let status = 500;

  // Handle different error types
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    status = axiosError.response?.status || 500;
    baseError = {
      message: axiosError.response?.data?.error?.message || axiosError.message,
      type: axiosError.response?.data?.error?.type || 'unknown_error',
      code: axiosError.response?.data?.error?.code || 'unknown_code',
      request_id: axiosError.response?.data?.error?.request_id,
    };
  } else if (error instanceof Error) {
    baseError = {
      message: error.message,
      type: 'client_error',
      code: 'client_error',
    };
  } else {
    baseError = {
      message: 'Unknown error occurred',
      type: 'unknown_error',
      code: 'unknown_error',
    };
  }

  // Classify the error
  const classification = ERROR_CLASSIFICATION[status] || {
    category: 'unknown' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
  };

  // Create enhanced error
  const enhancedError: EnhancedApiError = {
    ...baseError,
    severity: classification.severity,
    category: classification.category,
    retryable: classification.retryable,
    userMessage: getUserFriendlyMessage(baseError, classification.category),
    technicalMessage: baseError.message,
    timestamp: new Date().toISOString(),
    context,
  };

  return enhancedError;
};

/**
 * Get user-friendly error message
 */
const getUserFriendlyMessage = (error: ApiError, category: ErrorCategory): string => {
  // Check for specific error codes that need custom messages
  switch (error.code) {
    case 'duplicate_slug':
      return 'A provider with this name already exists. Please choose a different name.';
    case 'provider_not_found':
      return 'The requested provider was not found.';
    case 'invalid_model_config':
      return 'The model configuration is invalid. Please check your settings.';
    case 'provider_test_failed':
      return 'Provider test failed. Please check the configuration and try again.';
    case 'insufficient_permissions':
      return 'You don\'t have sufficient permissions for this action.';
    default:
      return USER_FRIENDLY_MESSAGES[category];
  }
};

/**
 * Error retry logic
 */
export const shouldRetryError = (error: EnhancedApiError, attemptCount: number): boolean => {
  if (!error.retryable || attemptCount >= 3) {
    return false;
  }

  // Don't retry client errors (4xx)
  if (error.category === 'validation' || error.category === 'authentication' || error.category === 'authorization') {
    return false;
  }

  // Retry server errors and timeouts
  return error.category === 'server' || error.category === 'timeout' || error.category === 'rate_limit';
};

/**
 * Calculate retry delay with exponential backoff
 */
export const getRetryDelay = (attemptCount: number, baseDelay: number = 1000): number => {
  return Math.min(baseDelay * Math.pow(2, attemptCount), 30000); // Max 30 seconds
};

/**
 * Error reporting utility
 */
export const reportError = (error: EnhancedApiError, additionalContext?: Record<string, any>): void => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Enhanced API Error:', {
      ...error,
      additionalContext,
    });
  }

  // Report to error tracking service (e.g., Sentry)
  if (window.Sentry && error.severity === 'critical') {
    window.Sentry.captureException(new Error(error.technicalMessage), {
      tags: {
        category: error.category,
        severity: error.severity,
        code: error.code,
      },
      extra: {
        ...error.context,
        ...additionalContext,
      },
    });
  }

  // Emit custom event for error handling components
  window.dispatchEvent(new CustomEvent('api-error', {
    detail: { error, additionalContext },
  }));
};

/**
 * API response normalization utilities
 */
export interface NormalizedResponse<T = any> {
  data: T;
  success: boolean;
  error?: EnhancedApiError;
  metadata?: {
    requestId?: string;
    timestamp: string;
    cached?: boolean;
  };
}

/**
 * Normalize API response to consistent format
 */
export const normalizeApiResponse = <T>(
  response: any,
  cached: boolean = false
): NormalizedResponse<T> => {
  return {
    data: response,
    success: true,
    metadata: {
      timestamp: new Date().toISOString(),
      cached,
    },
  };
};

/**
 * Normalize API error to consistent format
 */
export const normalizeApiError = (
  error: unknown,
  context?: Record<string, any>
): NormalizedResponse<null> => {
  const enhancedError = enhanceApiError(error, context);
  
  return {
    data: null,
    success: false,
    error: enhancedError,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Error boundary helper for React components
 */
export class ApiErrorBoundary {
  static getDerivedStateFromError(error: Error): { hasError: boolean; error: EnhancedApiError } {
    const enhancedError = enhanceApiError(error);
    reportError(enhancedError);
    
    return {
      hasError: true,
      error: enhancedError,
    };
  }

  static componentDidCatch(error: Error, errorInfo: any): void {
    const enhancedError = enhanceApiError(error, { errorInfo });
    reportError(enhancedError);
  }
}

/**
 * Validation error helpers
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export const parseValidationErrors = (error: EnhancedApiError): ValidationError[] => {
  if (error.category !== 'validation') {
    return [];
  }

  // Parse validation errors from different formats
  const context = error.context;
  if (context?.validationErrors) {
    return context.validationErrors;
  }

  // Fallback: try to extract field errors from message
  const fieldErrorRegex = /(\w+): (.+)/g;
  const errors: ValidationError[] = [];
  let match;

  while ((match = fieldErrorRegex.exec(error.message)) !== null) {
    errors.push({
      field: match[1],
      message: match[2],
      code: 'validation_error',
    });
  }

  return errors;
};

/**
 * Network status utilities
 */
export const isNetworkError = (error: EnhancedApiError): boolean => {
  return error.category === 'network' || error.category === 'timeout';
};

export const isServerError = (error: EnhancedApiError): boolean => {
  return error.category === 'server';
};

export const isClientError = (error: EnhancedApiError): boolean => {
  return ['validation', 'authentication', 'authorization', 'client'].includes(error.category);
};

/**
 * Error recovery suggestions
 */
export const getErrorRecoverySuggestions = (error: EnhancedApiError): string[] => {
  const suggestions: string[] = [];

  switch (error.category) {
    case 'network':
      suggestions.push('Check your internet connection');
      suggestions.push('Try refreshing the page');
      break;
    case 'authentication':
      suggestions.push('Log out and log back in');
      suggestions.push('Clear your browser cache');
      break;
    case 'authorization':
      suggestions.push('Contact your administrator for access');
      break;
    case 'validation':
      suggestions.push('Check your input data');
      suggestions.push('Ensure all required fields are filled');
      break;
    case 'server':
      suggestions.push('Try again in a few minutes');
      suggestions.push('Contact support if the problem persists');
      break;
    case 'rate_limit':
      suggestions.push('Wait a moment before trying again');
      suggestions.push('Reduce the frequency of your requests');
      break;
    default:
      suggestions.push('Try refreshing the page');
      suggestions.push('Contact support if the problem persists');
  }

  return suggestions;
};