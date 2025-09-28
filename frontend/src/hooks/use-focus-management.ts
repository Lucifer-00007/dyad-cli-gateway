import { useEffect, useRef, useCallback, useState } from 'react';

// Focus management for complex interactions
export const useFocusManagement = () => {
  const focusHistoryRef = useRef<HTMLElement[]>([]);
  const currentFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      focusHistoryRef.current.push(activeElement);
      currentFocusRef.current = activeElement;
    }
  }, []);

  const restoreFocus = useCallback(() => {
    const lastFocused = focusHistoryRef.current.pop();
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus();
      currentFocusRef.current = lastFocused;
    }
  }, []);

  const clearFocusHistory = useCallback(() => {
    focusHistoryRef.current = [];
    currentFocusRef.current = null;
  }, []);

  const focusElement = useCallback((element: HTMLElement | null) => {
    if (element && document.contains(element)) {
      element.focus();
      currentFocusRef.current = element;
    }
  }, []);

  const focusFirstFocusable = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>;
    
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
      currentFocusRef.current = firstFocusable;
    }
  }, []);

  const focusLastFocusable = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>;
    
    const lastFocusable = focusableElements[focusableElements.length - 1];
    if (lastFocusable) {
      lastFocusable.focus();
      currentFocusRef.current = lastFocusable;
    }
  }, []);

  return {
    saveFocus,
    restoreFocus,
    clearFocusHistory,
    focusElement,
    focusFirstFocusable,
    focusLastFocusable,
    currentFocus: currentFocusRef.current,
  };
};

// Enhanced focus trap with better escape handling
export const useEnhancedFocusTrap = (
  isActive: boolean,
  options: {
    escapeDeactivates?: boolean;
    clickOutsideDeactivates?: boolean;
    returnFocusOnDeactivate?: boolean;
    onDeactivate?: () => void;
  } = {}
) => {
  const {
    escapeDeactivates = true,
    clickOutsideDeactivates = false,
    returnFocusOnDeactivate = true,
    onDeactivate,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isTrapping, setIsTrapping] = useState(false);

  const deactivate = useCallback(() => {
    setIsTrapping(false);
    if (returnFocusOnDeactivate && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
    onDeactivate?.();
  }, [returnFocusOnDeactivate, onDeactivate]);

  useEffect(() => {
    if (!isActive || !containerRef.current) {
      if (isTrapping) {
        deactivate();
      }
      return;
    }

    // Store the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIsTrapping(true);

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      if (focusableElements.length === 1) {
        e.preventDefault();
        firstElement?.focus();
        return;
      }

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
      if (e.key === 'Escape' && escapeDeactivates) {
        e.preventDefault();
        deactivate();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (clickOutsideDeactivates && !container.contains(e.target as Node)) {
        deactivate();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    if (escapeDeactivates) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    if (clickOutsideDeactivates) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActive, escapeDeactivates, clickOutsideDeactivates, deactivate, isTrapping]);

  return {
    containerRef,
    isTrapping,
    deactivate,
  };
};

// Focus management for roving tabindex
export const useRovingTabIndex = <T>(
  items: T[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    defaultIndex?: number;
  } = {}
) => {
  const { orientation = 'vertical', loop = true, defaultIndex = 0 } = options;
  const [focusedIndex, setFocusedIndex] = useState(defaultIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Update refs array when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // Focus the current item
  useEffect(() => {
    const focusedElement = itemRefs.current[focusedIndex];
    if (focusedElement) {
      focusedElement.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (items.length === 0) return;

      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            newIndex = focusedIndex < items.length - 1 ? focusedIndex + 1 : loop ? 0 : focusedIndex;
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            newIndex = focusedIndex > 0 ? focusedIndex - 1 : loop ? items.length - 1 : focusedIndex;
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            newIndex = focusedIndex < items.length - 1 ? focusedIndex + 1 : loop ? 0 : focusedIndex;
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            newIndex = focusedIndex > 0 ? focusedIndex - 1 : loop ? items.length - 1 : focusedIndex;
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = items.length - 1;
          break;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
      }
    },
    [items.length, focusedIndex, orientation, loop]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[index] = el;
      },
      tabIndex: index === focusedIndex ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
      onKeyDown: handleKeyDown,
      'data-focused': index === focusedIndex,
      'aria-selected': index === focusedIndex,
    }),
    [focusedIndex, handleKeyDown]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    getItemProps,
  };
};

// Focus management for modal dialogs
export const useModalFocus = (isOpen: boolean) => {
  const { containerRef, isTrapping, deactivate } = useEnhancedFocusTrap(isOpen, {
    escapeDeactivates: true,
    clickOutsideDeactivates: false,
    returnFocusOnDeactivate: true,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Set up modal-specific attributes
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.setAttribute('role', 'dialog');
      modalRef.current.setAttribute('aria-modal', 'true');
      
      // Set aria-hidden on other elements
      const otherElements = document.querySelectorAll('body > *:not([aria-hidden])');
      otherElements.forEach(el => {
        if (el !== modalRef.current && !modalRef.current?.contains(el)) {
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('data-modal-hidden', 'true');
        }
      });

      return () => {
        // Remove aria-hidden from other elements
        const hiddenElements = document.querySelectorAll('[data-modal-hidden]');
        hiddenElements.forEach(el => {
          el.removeAttribute('aria-hidden');
          el.removeAttribute('data-modal-hidden');
        });
      };
    }
  }, [isOpen]);

  return {
    modalRef: containerRef,
    isTrapping,
    closeModal: deactivate,
  };
};

// Focus management for dropdown menus
export const useDropdownFocus = (isOpen: boolean) => {
  const { containerRef, isTrapping } = useEnhancedFocusTrap(isOpen, {
    escapeDeactivates: false, // Let parent handle escape
    clickOutsideDeactivates: false, // Let parent handle click outside
    returnFocusOnDeactivate: false, // Let parent handle focus return
  });

  return {
    dropdownRef: containerRef,
    isTrapping,
  };
};

// Utility to check if element is focusable
export const isFocusable = (element: HTMLElement): boolean => {
  const focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  return focusableSelectors.some(selector => element.matches(selector));
};

// Utility to get all focusable elements in a container
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  return Array.from(
    container.querySelectorAll(focusableSelectors.join(', '))
  ) as HTMLElement[];
};