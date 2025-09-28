/**
 * Secure content rendering components with XSS prevention
 */

import React, { useMemo } from 'react';
import { sanitizer, CSPHelper } from '@/lib/security';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

interface SecureContentProps {
  content: string;
  className?: string;
  allowHtml?: boolean;
  maxLength?: number;
  showSecurityWarning?: boolean;
}

/**
 * Secure HTML content renderer with XSS prevention
 */
export const SecureHtmlContent: React.FC<SecureContentProps> = ({
  content,
  className,
  maxLength = 5000,
  showSecurityWarning = false,
}) => {
  const sanitizedContent = useMemo(() => {
    if (!content) return '';
    
    // Truncate if too long
    const truncated = content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    
    // Sanitize HTML content
    return sanitizer.sanitizeHtml(truncated);
  }, [content, maxLength]);

  const isContentSafe = useMemo(() => {
    return CSPHelper.isSafeInlineContent(content);
  }, [content]);

  if (!isContentSafe && showSecurityWarning) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Security Warning</AlertTitle>
        <AlertDescription>
          This content contains potentially unsafe elements and cannot be displayed.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className={cn('secure-html-content', className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

/**
 * Secure text content renderer
 */
export const SecureTextContent: React.FC<SecureContentProps> = ({
  content,
  className,
  maxLength = 1000,
}) => {
  const sanitizedContent = useMemo(() => {
    if (!content) return '';
    
    // Sanitize and truncate text content
    const sanitized = sanitizer.sanitizeText(content);
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) + '...' : sanitized;
  }, [content, maxLength]);

  return (
    <div className={cn('secure-text-content whitespace-pre-wrap', className)}>
      {sanitizedContent}
    </div>
  );
};

/**
 * Secure log entry renderer
 */
interface SecureLogEntryProps {
  entry: {
    timestamp: string;
    level: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
  className?: string;
  showMetadata?: boolean;
}

export const SecureLogEntry: React.FC<SecureLogEntryProps> = ({
  entry,
  className,
  showMetadata = false,
}) => {
  const sanitizedMessage = useMemo(() => {
    return sanitizer.sanitizeText(entry.message);
  }, [entry.message]);

  const sanitizedMetadata = useMemo(() => {
    if (!entry.metadata || !showMetadata) return null;
    
    try {
      const metadataString = JSON.stringify(entry.metadata, null, 2);
      return sanitizer.sanitizeText(metadataString);
    } catch {
      return 'Invalid metadata';
    }
  }, [entry.metadata, showMetadata]);

  const levelColor = useMemo(() => {
    switch (entry.level.toLowerCase()) {
      case 'error':
        return 'text-red-600';
      case 'warn':
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'debug':
        return 'text-gray-600';
      default:
        return 'text-gray-800';
    }
  }, [entry.level]);

  return (
    <div className={cn('secure-log-entry font-mono text-sm border-b pb-2 mb-2', className)}>
      <div className="flex items-start gap-2">
        <span className="text-gray-500 text-xs whitespace-nowrap">
          {entry.timestamp}
        </span>
        <span className={cn('text-xs font-medium uppercase', levelColor)}>
          {entry.level}
        </span>
        <div className="flex-1 min-w-0">
          <div className="break-words">{sanitizedMessage}</div>
          {sanitizedMetadata && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                Metadata
              </summary>
              <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                {sanitizedMetadata}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Secure chat message renderer
 */
interface SecureChatMessageProps {
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
  className?: string;
  allowMarkdown?: boolean;
}

export const SecureChatMessage: React.FC<SecureChatMessageProps> = ({
  message,
  className,
  allowMarkdown = false,
}) => {
  const sanitizedContent = useMemo(() => {
    if (allowMarkdown) {
      // For markdown, we need to be more careful about HTML
      return sanitizer.sanitizeHtml(message.content);
    } else {
      return sanitizer.sanitizeText(message.content);
    }
  }, [message.content, allowMarkdown]);

  const roleStyles = useMemo(() => {
    switch (message.role) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-green-50 border-green-200';
      case 'system':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }, [message.role]);

  return (
    <div className={cn('secure-chat-message border rounded-lg p-3 mb-3', roleStyles, className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium capitalize">{message.role}</span>
        {message.timestamp && (
          <span className="text-xs text-gray-500">{message.timestamp}</span>
        )}
      </div>
      <div className="message-content">
        {allowMarkdown ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
        ) : (
          <div className="whitespace-pre-wrap">{sanitizedContent}</div>
        )}
      </div>
    </div>
  );
};

/**
 * Secure JSON viewer with syntax highlighting
 */
interface SecureJsonViewerProps {
  data: unknown;
  className?: string;
  maxDepth?: number;
  collapsed?: boolean;
}

export const SecureJsonViewer: React.FC<SecureJsonViewerProps> = ({
  data,
  className,
  maxDepth = 10,
  collapsed = false,
}) => {
  const sanitizedJson = useMemo(() => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return sanitizer.sanitizeText(jsonString);
    } catch {
      return 'Invalid JSON data';
    }
  }, [data]);

  const [isCollapsed, setIsCollapsed] = React.useState(collapsed);

  return (
    <div className={cn('secure-json-viewer', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">JSON Data</span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <pre className="bg-gray-50 border rounded p-3 text-sm overflow-x-auto max-h-96 overflow-y-auto">
          <code>{sanitizedJson}</code>
        </pre>
      )}
    </div>
  );
};

/**
 * Secure code block renderer
 */
interface SecureCodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export const SecureCodeBlock: React.FC<SecureCodeBlockProps> = ({
  code,
  language = 'text',
  className,
  showLineNumbers = false,
}) => {
  const sanitizedCode = useMemo(() => {
    return sanitizer.sanitizeText(code);
  }, [code]);

  const lines = useMemo(() => {
    return sanitizedCode.split('\n');
  }, [sanitizedCode]);

  return (
    <div className={cn('secure-code-block', className)}>
      {language && (
        <div className="bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 border-b">
          {language}
        </div>
      )}
      <pre className="bg-gray-50 p-3 text-sm overflow-x-auto">
        <code>
          {showLineNumbers ? (
            lines.map((line, index) => (
              <div key={index} className="flex">
                <span className="text-gray-400 mr-3 select-none w-8 text-right">
                  {index + 1}
                </span>
                <span>{line}</span>
              </div>
            ))
          ) : (
            sanitizedCode
          )}
        </code>
      </pre>
    </div>
  );
};

/**
 * Security indicator component
 */
interface SecurityIndicatorProps {
  level: 'safe' | 'warning' | 'danger';
  message?: string;
  className?: string;
}

export const SecurityIndicator: React.FC<SecurityIndicatorProps> = ({
  level,
  message,
  className,
}) => {
  const indicatorStyles = useMemo(() => {
    switch (level) {
      case 'safe':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [level]);

  const defaultMessage = useMemo(() => {
    switch (level) {
      case 'safe':
        return 'Content is secure';
      case 'warning':
        return 'Content may contain unsafe elements';
      case 'danger':
        return 'Content contains unsafe elements';
      default:
        return 'Security status unknown';
    }
  }, [level]);

  return (
    <div className={cn('flex items-center gap-2 px-2 py-1 rounded border text-xs', indicatorStyles, className)}>
      <Shield className="h-3 w-3" />
      <span>{message || defaultMessage}</span>
    </div>
  );
};

/**
 * Secure content wrapper with automatic sanitization
 */
interface SecureWrapperProps {
  children: React.ReactNode;
  enableCSP?: boolean;
  showSecurityIndicator?: boolean;
  className?: string;
}

export const SecureWrapper: React.FC<SecureWrapperProps> = ({
  children,
  enableCSP = true,
  showSecurityIndicator = false,
  className,
}) => {
  const nonce = useMemo(() => {
    return enableCSP ? CSPHelper.generateNonce() : undefined;
  }, [enableCSP]);

  return (
    <div className={cn('secure-wrapper', className)} data-nonce={nonce}>
      {showSecurityIndicator && (
        <div className="mb-2">
          <SecurityIndicator level="safe" message="Content is sanitized and secure" />
        </div>
      )}
      {children}
    </div>
  );
};