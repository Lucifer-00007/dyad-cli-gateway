import { useEffect, useRef, useCallback, useState } from 'react';

// Hook for managing focus traps in modals and dialogs
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // This should be handled by the parent component
        // but we can provide a way to escape focus trap
        previousFocusRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
      // Restore focus to the previously focused element
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  return containerRef;
};

// Hook for keyboard navigation in lists
export const useKeyboardNavigation = <T>(
  items: T[],
  onSelect: (item: T, index: number) => void,
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
  } = {}
) => {
  const { loop = true, orientation = 'vertical', disabled = false } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Update item refs array when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // Ensure focused index is within bounds
  useEffect(() => {
    if (focusedIndex >= items.length) {
      setFocusedIndex(Math.max(0, items.length - 1));
    }
  }, [focusedIndex, items.length]);

  // Focus the currently focused element
  useEffect(() => {
    if (!disabled) {
      const focusedElement = itemRefs.current[focusedIndex];
      focusedElement?.focus();
    }
  }, [focusedIndex, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled || items.length === 0) return;

      const isVertical = orientation === 'vertical';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev < items.length - 1) {
              return prev + 1;
            }
            return loop ? 0 : prev;
          });
          break;

        case prevKey:
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev > 0) {
              return prev - 1;
            }
            return loop ? items.length - 1 : prev;
          });
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(items.length - 1);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (items[focusedIndex]) {
            onSelect(items[focusedIndex], focusedIndex);
          }
          break;

        case 'Escape':
          e.preventDefault();
          listRef.current?.blur();
          break;
      }
    },
    [items, focusedIndex, onSelect, loop, orientation, disabled]
  );

  useEffect(() => {
    const element = listRef.current;
    if (element && !disabled) {
      element.addEventListener('keydown', handleKeyDown);
      return () => element.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, disabled]);

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[index] = el;
      },
      tabIndex: index === focusedIndex ? 0 : -1,
      'data-focused': index === focusedIndex,
      onFocus: () => setFocusedIndex(index),
      onClick: () => onSelect(items[index], index),
    }),
    [focusedIndex, onSelect, items]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    listRef,
    getItemProps,
  };
};

// Hook for screen reader announcements
export const useAnnouncements = () => {
  const announce = useCallback(
    (
      message: string,
      priority: 'polite' | 'assertive' = 'polite',
      delay: number = 100
    ) => {
      // Small delay to ensure screen readers pick up the announcement
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;

        document.body.appendChild(announcement);

        // Clean up after announcement
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 1000);
      }, delay);
    },
    []
  );

  return { announce };
};

// Hook for managing skip links
export const useSkipLinks = () => {
  const skipLinksRef = useRef<HTMLDivElement>(null);

  const addSkipLink = useCallback((target: string, label: string) => {
    if (!skipLinksRef.current) return;

    const link = document.createElement('a');
    link.href = `#${target}`;
    link.textContent = label;
    link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md';
    
    skipLinksRef.current.appendChild(link);

    return () => {
      if (skipLinksRef.current?.contains(link)) {
        skipLinksRef.current.removeChild(link);
      }
    };
  }, []);

  return { skipLinksRef, addSkipLink };
};

// Hook for detecting reduced motion preference
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Hook for managing ARIA live regions
export const useLiveRegion = () => {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const updateLiveRegion = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (liveRegionRef.current) {
        liveRegionRef.current.setAttribute('aria-live', priority);
        liveRegionRef.current.textContent = message;
      }
    },
    []
  );

  const clearLiveRegion = useCallback(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
  }, []);

  return { liveRegionRef, updateLiveRegion, clearLiveRegion };
};

// Hook for managing focus restoration
export const useFocusRestore = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  return { saveFocus, restoreFocus };
};

// Hook for accessible form validation
export const useAccessibleValidation = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { announce } = useAnnouncements();

  const setFieldError = useCallback(
    (fieldName: string, error: string) => {
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
      announce(`${fieldName}: ${error}`, 'assertive');
    },
    [announce]
  );

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const getFieldProps = useCallback(
    (fieldName: string) => ({
      'aria-invalid': !!errors[fieldName],
      'aria-describedby': errors[fieldName] ? `${fieldName}-error` : undefined,
    }),
    [errors]
  );

  const getErrorProps = useCallback(
    (fieldName: string) => ({
      id: `${fieldName}-error`,
      role: 'alert',
      'aria-live': 'polite' as const,
    }),
    []
  );

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    getFieldProps,
    getErrorProps,
  };
};