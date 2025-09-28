import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize monitoring services
import { initializeSentry } from './lib/sentry';
import { performanceMonitor } from './lib/performance-monitoring';
import { analytics } from './lib/analytics';
import { logger } from './lib/logger';
import { healthCheckService } from './lib/health-check';

// Initialize Sentry for error tracking
initializeSentry();

// Log application startup
logger.info('Application starting', {
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  timestamp: new Date().toISOString(),
});

// Track application start
analytics.trackSystemEvent({
  event: 'app_start',
  level: 'info',
  data: {
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',
    userAgent: navigator.userAgent,
    url: window.location.href,
  },
});

// Start health monitoring in production
if (import.meta.env.VITE_ENVIRONMENT === 'production') {
  healthCheckService.start();
}

createRoot(document.getElementById('root')!).render(<App />);
