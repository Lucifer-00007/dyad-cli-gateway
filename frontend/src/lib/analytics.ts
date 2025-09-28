import { reportError } from './sentry';

export interface AnalyticsEvent {
  name: string;
  category: 'user_action' | 'system' | 'error' | 'performance';
  properties?: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  url: string;
  userAgent: string;
}

export interface UserAction {
  action: string;
  target: string;
  context?: Record<string, unknown>;
  metadata?: {
    duration?: number;
    success?: boolean;
    errorMessage?: string;
  };
}

export interface SystemEvent {
  event: string;
  level: 'info' | 'warn' | 'error';
  data?: Record<string, unknown>;
}

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private isEnabled: boolean;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.isEnabled = import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';
    this.sessionId = this.generateSessionId();
    
    if (this.isEnabled) {
      this.startBatchFlush();
      this.setupPageViewTracking();
      this.setupUnloadHandler();
    }
  }

  private generateSessionId(): string {
    let sessionId = sessionStorage.getItem('dyad-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('dyad-session-id', sessionId);
    }
    return sessionId;
  }

  private startBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private setupPageViewTracking(): void {
    // Track initial page view
    this.trackPageView();

    // Track route changes (for SPA)
    let currentPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        this.trackPageView();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private setupUnloadHandler(): void {
    // Flush events before page unload
    window.addEventListener('beforeunload', () => {
      this.flush(true); // Force synchronous flush
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  private createEvent(
    name: string,
    category: AnalyticsEvent['category'],
    properties?: Record<string, unknown>
  ): AnalyticsEvent {
    return {
      name,
      category,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
  }

  // Public methods
  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public clearUserId(): void {
    this.userId = undefined;
  }

  public trackUserAction(action: UserAction): void {
    if (!this.isEnabled) return;

    const event = this.createEvent(`user_${action.action}`, 'user_action', {
      target: action.target,
      context: action.context,
      metadata: action.metadata,
    });

    this.events.push(event);
    this.checkBatchFlush();

    // Log in development
    if (import.meta.env.DEV) {
      console.log('User action tracked:', action);
    }
  }

  public trackSystemEvent(systemEvent: SystemEvent): void {
    if (!this.isEnabled) return;

    const event = this.createEvent(`system_${systemEvent.event}`, 'system', {
      level: systemEvent.level,
      data: systemEvent.data,
    });

    this.events.push(event);
    this.checkBatchFlush();

    // Log in development
    if (import.meta.env.DEV) {
      console.log('System event tracked:', systemEvent);
    }
  }

  public trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const event = this.createEvent('error_occurred', 'error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
    });

    this.events.push(event);
    this.flush(); // Immediately flush errors

    // Also report to Sentry
    reportError(error, context);
  }

  public trackPageView(path?: string): void {
    if (!this.isEnabled) return;

    const event = this.createEvent('page_view', 'user_action', {
      path: path || window.location.pathname,
      referrer: document.referrer,
      title: document.title,
    });

    this.events.push(event);
    this.checkBatchFlush();
  }

  public trackFeatureUsage(feature: string, properties?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const event = this.createEvent(`feature_${feature}`, 'user_action', {
      feature,
      ...properties,
    });

    this.events.push(event);
    this.checkBatchFlush();
  }

  public trackPerformance(metric: string, value: number, properties?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const event = this.createEvent(`performance_${metric}`, 'performance', {
      metric,
      value,
      ...properties,
    });

    this.events.push(event);
    this.checkBatchFlush();
  }

  private checkBatchFlush(): void {
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush(synchronous: boolean = false): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
    
    if (!analyticsEndpoint) {
      if (import.meta.env.DEV) {
        console.log('Analytics events (no endpoint configured):', eventsToSend);
      }
      return;
    }

    const sendEvents = async () => {
      try {
        const response = await fetch(`${analyticsEndpoint}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ events: eventsToSend }),
        });

        if (!response.ok) {
          throw new Error(`Analytics API error: ${response.status}`);
        }

        if (import.meta.env.DEV) {
          console.log(`Sent ${eventsToSend.length} analytics events`);
        }
      } catch (error) {
        console.warn('Failed to send analytics events:', error);
        
        // Re-queue events for retry (up to a limit)
        if (this.events.length < 100) {
          this.events.unshift(...eventsToSend);
        }
      }
    };

    if (synchronous) {
      // Use sendBeacon for synchronous sending during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events: eventsToSend })], {
          type: 'application/json',
        });
        navigator.sendBeacon(`${analyticsEndpoint}/events`, blob);
      }
    } else {
      await sendEvents();
    }
  }

  public getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  public clearEvents(): void {
    this.events = [];
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(true);
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// React hooks for analytics
export const useAnalytics = () => {
  const trackClick = (target: string, context?: Record<string, unknown>) => {
    analytics.trackUserAction({
      action: 'click',
      target,
      context,
    });
  };

  const trackFormSubmit = (formName: string, success: boolean, context?: Record<string, unknown>) => {
    analytics.trackUserAction({
      action: 'form_submit',
      target: formName,
      context,
      metadata: { success },
    });
  };

  const trackNavigation = (from: string, to: string) => {
    analytics.trackUserAction({
      action: 'navigate',
      target: to,
      context: { from },
    });
  };

  const trackSearch = (query: string, results: number, context?: Record<string, unknown>) => {
    analytics.trackUserAction({
      action: 'search',
      target: 'search_box',
      context: { query, results, ...context },
    });
  };

  const trackFeature = (feature: string, properties?: Record<string, unknown>) => {
    analytics.trackFeatureUsage(feature, properties);
  };

  const trackError = (error: Error, context?: Record<string, unknown>) => {
    analytics.trackError(error, context);
  };

  return {
    trackClick,
    trackFormSubmit,
    trackNavigation,
    trackSearch,
    trackFeature,
    trackError,
  };
};

// HOC for automatic click tracking
export const withClickTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  const TrackedComponent = (props: P) => {
    const { trackClick } = useAnalytics();

    const handleClick = (event: React.MouseEvent) => {
      trackClick(componentName, {
        elementType: (event.target as HTMLElement).tagName,
        elementId: (event.target as HTMLElement).id,
        elementClass: (event.target as HTMLElement).className,
      });

      // Call original onClick if it exists
      if ('onClick' in props && typeof props.onClick === 'function') {
        (props.onClick as (event: React.MouseEvent) => void)(event);
      }
    };

    return React.createElement(WrappedComponent, {
      ...props,
      onClick: handleClick,
    });
  };

  TrackedComponent.displayName = `withClickTracking(${componentName})`;
  return TrackedComponent;
};

// Utility functions for common tracking patterns
export const trackProviderAction = (action: string, providerId: string, success: boolean) => {
  analytics.trackUserAction({
    action: `provider_${action}`,
    target: providerId,
    metadata: { success },
  });
};

export const trackApiKeyAction = (action: string, keyId: string, success: boolean) => {
  analytics.trackUserAction({
    action: `api_key_${action}`,
    target: keyId,
    metadata: { success },
  });
};

export const trackChatAction = (action: string, model: string, context?: Record<string, unknown>) => {
  analytics.trackUserAction({
    action: `chat_${action}`,
    target: model,
    context,
  });
};

export default analytics;

// React import for HOC
import React from 'react';