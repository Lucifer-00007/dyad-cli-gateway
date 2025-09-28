import React, { useEffect, useRef, useCallback } from 'react';
import { useAnnouncements, useLiveRegion } from '@/hooks/use-accessibility';

// Live region component for screen reader announcements
export const LiveRegion: React.FC<{
  level?: 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  className?: string;
  children?: React.ReactNode;
}> = ({ 
  level = 'polite', 
  atomic = true, 
  relevant = 'all',
  className = 'sr-only',
  children 
}) => {
  return (
    <div
      aria-live={level}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={className}
    >
      {children}
    </div>
  );
};

// Status announcer component
export const StatusAnnouncer: React.FC<{
  message: string;
  level?: 'polite' | 'assertive';
  delay?: number;
}> = ({ message, level = 'polite', delay = 100 }) => {
  const { announce } = useAnnouncements();

  useEffect(() => {
    if (message) {
      announce(message, level, delay);
    }
  }, [message, level, delay, announce]);

  return null;
};

// Progress announcer for long-running operations
export const ProgressAnnouncer: React.FC<{
  value: number;
  max: number;
  label?: string;
  announceInterval?: number;
}> = ({ value, max, label = 'Progress', announceInterval = 25 }) => {
  const { announce } = useAnnouncements();
  const lastAnnouncedRef = useRef<number>(0);

  useEffect(() => {
    const percentage = Math.round((value / max) * 100);
    const shouldAnnounce = percentage - lastAnnouncedRef.current >= announceInterval;

    if (shouldAnnounce || percentage === 100) {
      announce(`${label}: ${percentage}%`, 'polite');
      lastAnnouncedRef.current = percentage;
    }
  }, [value, max, label, announceInterval, announce]);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="sr-only"
    >
      {Math.round((value / max) * 100)}%
    </div>
  );
};

// Loading announcer
export const LoadingAnnouncer: React.FC<{
  isLoading: boolean;
  message?: string;
  completedMessage?: string;
}> = ({ 
  isLoading, 
  message = 'Loading content', 
  completedMessage = 'Content loaded' 
}) => {
  const { announce } = useAnnouncements();
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      announce(message, 'polite');
      wasLoadingRef.current = true;
    } else if (!isLoading && wasLoadingRef.current) {
      announce(completedMessage, 'polite');
      wasLoadingRef.current = false;
    }
  }, [isLoading, message, completedMessage, announce]);

  return isLoading ? (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className="sr-only"
    >
      {message}
    </div>
  ) : null;
};

// Error announcer
export const ErrorAnnouncer: React.FC<{
  error: string | null;
  prefix?: string;
}> = ({ error, prefix = 'Error' }) => {
  const { announce } = useAnnouncements();

  useEffect(() => {
    if (error) {
      announce(`${prefix}: ${error}`, 'assertive');
    }
  }, [error, prefix, announce]);

  return error ? (
    <div
      role="alert"
      aria-live="assertive"
      className="sr-only"
    >
      {prefix}: {error}
    </div>
  ) : null;
};

// Form validation announcer
export const ValidationAnnouncer: React.FC<{
  errors: Record<string, string>;
  fieldLabels?: Record<string, string>;
}> = ({ errors, fieldLabels = {} }) => {
  const { announce } = useAnnouncements();
  const previousErrorsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const newErrors = Object.keys(errors).filter(
      field => errors[field] && errors[field] !== previousErrorsRef.current[field]
    );

    newErrors.forEach(field => {
      const fieldLabel = fieldLabels[field] || field;
      const errorMessage = errors[field];
      announce(`${fieldLabel}: ${errorMessage}`, 'assertive');
    });

    previousErrorsRef.current = { ...errors };
  }, [errors, fieldLabels, announce]);

  const errorCount = Object.keys(errors).length;

  return errorCount > 0 ? (
    <div
      role="alert"
      aria-live="assertive"
      className="sr-only"
    >
      {errorCount === 1 
        ? 'There is 1 validation error' 
        : `There are ${errorCount} validation errors`
      }
    </div>
  ) : null;
};

// Search results announcer
export const SearchResultsAnnouncer: React.FC<{
  resultCount: number;
  query?: string;
  isLoading?: boolean;
}> = ({ resultCount, query, isLoading = false }) => {
  const { announce } = useAnnouncements();
  const previousCountRef = useRef<number>(-1);

  useEffect(() => {
    if (!isLoading && resultCount !== previousCountRef.current) {
      let message = '';
      
      if (resultCount === 0) {
        message = query ? `No results found for "${query}"` : 'No results found';
      } else if (resultCount === 1) {
        message = query ? `1 result found for "${query}"` : '1 result found';
      } else {
        message = query 
          ? `${resultCount} results found for "${query}"` 
          : `${resultCount} results found`;
      }

      announce(message, 'polite');
      previousCountRef.current = resultCount;
    }
  }, [resultCount, query, isLoading, announce]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="sr-only"
    >
      {isLoading ? 'Searching...' : 
       resultCount === 0 ? 'No results' :
       resultCount === 1 ? '1 result' :
       `${resultCount} results`}
    </div>
  );
};

// Navigation announcer
export const NavigationAnnouncer: React.FC<{
  currentPage: string;
  totalPages?: number;
  currentItem?: number;
  totalItems?: number;
}> = ({ currentPage, totalPages, currentItem, totalItems }) => {
  const { announce } = useAnnouncements();
  const previousPageRef = useRef<string>('');

  useEffect(() => {
    if (currentPage && currentPage !== previousPageRef.current) {
      let message = `Navigated to ${currentPage}`;
      
      if (totalPages) {
        message += ` (page ${currentItem || 1} of ${totalPages})`;
      } else if (currentItem && totalItems) {
        message += ` (item ${currentItem} of ${totalItems})`;
      }

      announce(message, 'polite');
      previousPageRef.current = currentPage;
    }
  }, [currentPage, totalPages, currentItem, totalItems, announce]);

  return null;
};

// Table announcer for dynamic content
export const TableAnnouncer: React.FC<{
  rowCount: number;
  columnCount: number;
  selectedRows?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}> = ({ rowCount, columnCount, selectedRows, sortColumn, sortDirection }) => {
  const { announce } = useAnnouncements();
  const previousSortRef = useRef<{ column?: string; direction?: string }>({});

  useEffect(() => {
    if (sortColumn && sortDirection && 
        (sortColumn !== previousSortRef.current.column || 
         sortDirection !== previousSortRef.current.direction)) {
      
      const directionText = sortDirection === 'asc' ? 'ascending' : 'descending';
      announce(`Table sorted by ${sortColumn}, ${directionText}`, 'polite');
      
      previousSortRef.current = { column: sortColumn, direction: sortDirection };
    }
  }, [sortColumn, sortDirection, announce]);

  return (
    <div className="sr-only">
      <div role="status" aria-live="polite">
        Table with {rowCount} rows and {columnCount} columns
        {selectedRows !== undefined && selectedRows > 0 && 
          `, ${selectedRows} rows selected`}
      </div>
    </div>
  );
};

// Screen reader instructions component
export const ScreenReaderInstructions: React.FC<{
  instructions: string[];
  className?: string;
}> = ({ instructions, className = 'sr-only' }) => {
  return (
    <div className={className}>
      <h2>Screen Reader Instructions</h2>
      <ul>
        {instructions.map((instruction, index) => (
          <li key={index}>{instruction}</li>
        ))}
      </ul>
    </div>
  );
};

// Keyboard shortcuts announcer
export const KeyboardShortcutsAnnouncer: React.FC<{
  shortcuts: Array<{ key: string; description: string }>;
  triggerKey?: string;
}> = ({ shortcuts, triggerKey = '?' }) => {
  const { announce } = useAnnouncements();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === triggerKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const shortcutList = shortcuts
          .map(s => `${s.key}: ${s.description}`)
          .join(', ');
        announce(`Available keyboard shortcuts: ${shortcutList}`, 'polite');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, triggerKey, announce]);

  return (
    <div className="sr-only">
      <h2>Keyboard Shortcuts</h2>
      <dl>
        {shortcuts.map((shortcut, index) => (
          <React.Fragment key={index}>
            <dt>{shortcut.key}</dt>
            <dd>{shortcut.description}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
};

// Context announcer for complex interactions
export const ContextAnnouncer: React.FC<{
  context: string;
  level?: 'polite' | 'assertive';
  children: React.ReactNode;
}> = ({ context, level = 'polite', children }) => {
  const { announce } = useAnnouncements();

  const announceContext = useCallback(() => {
    announce(context, level);
  }, [context, level, announce]);

  return (
    <div
      onFocus={announceContext}
      onMouseEnter={announceContext}
    >
      {children}
    </div>
  );
};

export default {
  LiveRegion,
  StatusAnnouncer,
  ProgressAnnouncer,
  LoadingAnnouncer,
  ErrorAnnouncer,
  ValidationAnnouncer,
  SearchResultsAnnouncer,
  NavigationAnnouncer,
  TableAnnouncer,
  ScreenReaderInstructions,
  KeyboardShortcutsAnnouncer,
  ContextAnnouncer,
};