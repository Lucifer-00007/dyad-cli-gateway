import { analytics } from './analytics';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
  source?: string;
  sessionId: string;
  url: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number;
}

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info',
      enableConsole: import.meta.env.DEV || import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true',
      enableRemote: import.meta.env.VITE_ENABLE_REMOTE_LOGS === 'true',
      enableStorage: import.meta.env.VITE_ENABLE_LOG_STORAGE !== 'false',
      maxStorageEntries: parseInt(import.meta.env.VITE_MAX_LOG_ENTRIES || '1000'),
      remoteEndpoint: import.meta.env.VITE_LOGGING_ENDPOINT,
      batchSize: 20,
      flushInterval: 60000, // 1 minute
      ...config,
    };

    this.sessionId = this.getSessionId();

    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.startBatchFlush();
    }

    // Setup error handlers
    this.setupGlobalErrorHandlers();
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('dyad-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('dyad-session-id', sessionId);
    }
    return sessionId;
  }

  private startBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushRemoteLogs();
    }, this.config.flushInterval);
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise,
      });
    });

    // Catch global errors
    window.addEventListener('error', (event) => {
      this.error('Global error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    source?: string
  ): LogEntry {
    return {
      level,
      message,
      timestamp: Date.now(),
      context,
      error,
      source,
      sessionId: this.sessionId,
      url: window.location.href,
    };
  }

  private processLog(entry: LogEntry): void {
    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Storage logging
    if (this.config.enableStorage) {
      this.logToStorage(entry);
    }

    // Remote logging
    if (this.config.enableRemote) {
      this.logs.push(entry);
      this.checkBatchFlush();
    }

    // Analytics integration for errors and warnings
    if (entry.level === 'error' || entry.level === 'warn') {
      analytics.trackSystemEvent({
        event: `log_${entry.level}`,
        level: entry.level === 'error' ? 'error' : 'warn',
        data: {
          message: entry.message,
          context: entry.context,
          source: entry.source,
        },
      });
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    const message = entry.source ? `${prefix} [${entry.source}] ${entry.message}` : `${prefix} ${entry.message}`;

    const consoleMethod = entry.level === 'debug' ? 'debug' :
                         entry.level === 'info' ? 'info' :
                         entry.level === 'warn' ? 'warn' : 'error';

    if (entry.context || entry.error) {
      console[consoleMethod](message, {
        context: entry.context,
        error: entry.error,
      });
    } else {
      console[consoleMethod](message);
    }
  }

  private logToStorage(entry: LogEntry): void {
    try {
      const storageKey = 'dyad-logs';
      const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      existingLogs.push({
        ...entry,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      });

      // Limit storage size
      if (existingLogs.length > this.config.maxStorageEntries) {
        existingLogs.splice(0, existingLogs.length - this.config.maxStorageEntries);
      }

      localStorage.setItem(storageKey, JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('Failed to store log entry:', error);
    }
  }

  private checkBatchFlush(): void {
    if (this.logs.length >= this.config.batchSize) {
      this.flushRemoteLogs();
    }
  }

  private async flushRemoteLogs(): Promise<void> {
    if (this.logs.length === 0 || !this.config.remoteEndpoint) return;

    const logsToSend = [...this.logs];
    this.logs = [];

    try {
      const response = await fetch(`${this.config.remoteEndpoint}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend.map(log => ({
            ...log,
            error: log.error ? {
              name: log.error.name,
              message: log.error.message,
              stack: log.error.stack,
            } : undefined,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Logging API error: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send logs to remote endpoint:', error);
      
      // Re-queue logs for retry (up to a limit)
      if (this.logs.length < 500) {
        this.logs.unshift(...logsToSend);
      }
    }
  }

  // Public logging methods
  public debug(message: string, context?: Record<string, unknown>, source?: string): void {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.createLogEntry('debug', message, context, undefined, source);
    this.processLog(entry);
  }

  public info(message: string, context?: Record<string, unknown>, source?: string): void {
    if (!this.shouldLog('info')) return;
    
    const entry = this.createLogEntry('info', message, context, undefined, source);
    this.processLog(entry);
  }

  public warn(message: string, context?: Record<string, unknown>, source?: string): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, context, undefined, source);
    this.processLog(entry);
  }

  public error(message: string, context?: Record<string, unknown>, error?: Error, source?: string): void {
    if (!this.shouldLog('error')) return;
    
    const entry = this.createLogEntry('error', message, context, error, source);
    this.processLog(entry);
  }

  // Utility methods
  public getStoredLogs(): LogEntry[] {
    try {
      const storageKey = 'dyad-logs';
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (error) {
      console.warn('Failed to retrieve stored logs:', error);
      return [];
    }
  }

  public clearStoredLogs(): void {
    try {
      localStorage.removeItem('dyad-logs');
    } catch (error) {
      console.warn('Failed to clear stored logs:', error);
    }
  }

  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.getStoredLogs().filter(log => log.level === level);
  }

  public getLogsByTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.getStoredLogs().filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  public exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.getStoredLogs();
    
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'source', 'url'];
      const csvRows = [
        headers.join(','),
        ...logs.map(log => [
          new Date(log.timestamp).toISOString(),
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.source || '',
          log.url,
        ].join(','))
      ];
      return csvRows.join('\n');
    }
    
    return JSON.stringify(logs, null, 2);
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushRemoteLogs();
  }
}

// Singleton instance
export const logger = new Logger();

// React hook for logging
export const useLogger = (source?: string) => {
  const debug = (message: string, context?: Record<string, unknown>) => {
    logger.debug(message, context, source);
  };

  const info = (message: string, context?: Record<string, unknown>) => {
    logger.info(message, context, source);
  };

  const warn = (message: string, context?: Record<string, unknown>) => {
    logger.warn(message, context, source);
  };

  const error = (message: string, context?: Record<string, unknown>, error?: Error) => {
    logger.error(message, context, error, source);
  };

  return { debug, info, warn, error };
};

// HOC for automatic component logging
export const withLogging = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const LoggedComponent = (props: P) => {
    const { info, error } = useLogger(displayName);

    React.useEffect(() => {
      info(`Component ${displayName} mounted`);
      
      return () => {
        info(`Component ${displayName} unmounted`);
      };
    }, [info]);

    // Error boundary for the component
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      const handleError = (errorEvent: ErrorEvent) => {
        error(`Error in component ${displayName}`, {
          message: errorEvent.message,
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
        });
        setHasError(true);
      };

      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, [error]);

    if (hasError) {
      return React.createElement('div', {
        className: 'error-boundary',
        children: `Error in ${displayName}`,
      });
    }

    return React.createElement(WrappedComponent, props);
  };

  LoggedComponent.displayName = `withLogging(${displayName})`;
  return LoggedComponent;
};

export default logger;

// React import for HOC
import React from 'react';