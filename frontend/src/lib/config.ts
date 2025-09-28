/**
 * Application configuration from environment variables
 */

export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  
  // Environment
  nodeEnv: import.meta.env.VITE_NODE_ENV || 'development',
  isDevelopment: import.meta.env.VITE_NODE_ENV === 'development',
  isProduction: import.meta.env.VITE_NODE_ENV === 'production',
  
  // Feature Flags
  features: {
    devtools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    streaming: import.meta.env.VITE_ENABLE_STREAMING === 'true',
    bulkOperations: import.meta.env.VITE_ENABLE_BULK_OPERATIONS === 'true',
    advancedMetrics: import.meta.env.VITE_ENABLE_ADVANCED_METRICS === 'true',
    exportFeatures: import.meta.env.VITE_ENABLE_EXPORT_FEATURES === 'true',
    chatPlayground: import.meta.env.VITE_ENABLE_CHAT_PLAYGROUND === 'true',
  },
  
  // Security
  security: {
    csrfHeaderName: import.meta.env.VITE_CSRF_HEADER_NAME || 'X-CSRF-Token',
    csrfCookieName: import.meta.env.VITE_CSRF_COOKIE_NAME || 'csrf-token',
  },
  
  // Cache Configuration
  cache: {
    maxAge: parseInt(import.meta.env.VITE_CACHE_MAX_AGE || '86400000'), // 24 hours
    queryStaleTime: parseInt(import.meta.env.VITE_QUERY_STALE_TIME || '300000'), // 5 minutes
    queryCacheTime: parseInt(import.meta.env.VITE_QUERY_CACHE_TIME || '600000'), // 10 minutes
  },
  
  // Monitoring
  monitoring: {
    enableErrorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  },
  
  // Performance
  performance: {
    enableVirtualScrolling: import.meta.env.VITE_ENABLE_VIRTUAL_SCROLLING === 'true',
    pageSizeDefault: parseInt(import.meta.env.VITE_PAGE_SIZE_DEFAULT || '10'),
    pageSizeMax: parseInt(import.meta.env.VITE_PAGE_SIZE_MAX || '100'),
  },
} as const;

// Type-safe feature flag checker
export const isFeatureEnabled = (feature: keyof typeof config.features): boolean => {
  return config.features[feature];
};

// Environment checker utilities
export const isDev = () => config.isDevelopment;
export const isProd = () => config.isProduction;

// Configuration validation
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!config.apiBaseUrl) {
    errors.push('VITE_API_BASE_URL is required');
  }
  
  if (!config.apiBaseUrl.startsWith('http')) {
    errors.push('VITE_API_BASE_URL must be a valid URL');
  }
  
  if (config.cache.maxAge < 0) {
    errors.push('VITE_CACHE_MAX_AGE must be a positive number');
  }
  
  if (config.performance.pageSizeDefault < 1 || config.performance.pageSizeDefault > config.performance.pageSizeMax) {
    errors.push('VITE_PAGE_SIZE_DEFAULT must be between 1 and VITE_PAGE_SIZE_MAX');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Log configuration in development
if (isDev()) {
  console.log('App Configuration:', config);
  
  const validation = validateConfig();
  if (!validation.isValid) {
    console.error('Configuration errors:', validation.errors);
  }
}