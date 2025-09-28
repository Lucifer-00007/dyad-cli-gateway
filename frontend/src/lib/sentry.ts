import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  enabled: boolean;
}

const getSentryConfig = (): SentryConfig => ({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  sampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  enabled: import.meta.env.VITE_ENVIRONMENT === 'production' && !!import.meta.env.VITE_SENTRY_DSN,
});

export const initializeSentry = (): void => {
  const config = getSentryConfig();
  
  if (!config.enabled) {
    console.log('Sentry disabled in development or missing DSN');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    sampleRate: config.sampleRate,
    tracesSampleRate: config.tracesSampleRate,
    integrations: [
      new BrowserTracing({
        // Set up automatic route change tracking for React Router
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
    ],
    beforeSend(event, hint) {
      // Filter out development errors
      if (config.environment === 'development') {
        return null;
      }

      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Skip network errors that are expected
        if (error.message.includes('NetworkError') || 
            error.message.includes('Failed to fetch')) {
          return null;
        }
        
        // Skip React hydration errors in development
        if (error.message.includes('Hydration')) {
          return null;
        }
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      if (breadcrumb.category === 'ui.click' && breadcrumb.message?.includes('button')) {
        // Add more context to button clicks
        breadcrumb.data = {
          ...breadcrumb.data,
          timestamp: new Date().toISOString(),
        };
      }
      
      return breadcrumb;
    },
  });
};

// Custom error boundary with Sentry integration
export const SentryErrorBoundary = Sentry.withErrorBoundary;

// Custom hooks for error tracking
export const useSentryUser = () => {
  const setUser = (user: { id: string; email?: string; username?: string }) => {
    Sentry.setUser(user);
  };

  const clearUser = () => {
    Sentry.setUser(null);
  };

  return { setUser, clearUser };
};

export const useSentryContext = () => {
  const setContext = (key: string, context: Record<string, unknown>) => {
    Sentry.setContext(key, context);
  };

  const setTag = (key: string, value: string) => {
    Sentry.setTag(key, value);
  };

  const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
    Sentry.addBreadcrumb(breadcrumb);
  };

  return { setContext, setTag, addBreadcrumb };
};

// Manual error reporting
export const reportError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  return Sentry.startTransaction({ name, op });
};

export const measurePerformance = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const transaction = startTransaction(name, 'function');
  
  try {
    const result = await operation();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
};

// React imports for routing instrumentation
import React, { useEffect } from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';