import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useReducedMotion, useAnnouncements } from '@/hooks/use-accessibility';
import { useFocusManagement } from '@/hooks/use-focus-management';
import { SkipLink } from '@/components/ui/keyboard-navigation';
import { LiveRegion } from '@/components/screen-reader-support';

interface AccessibilityContextType {
  // Preferences
  prefersReducedMotion: boolean;
  highContrastMode: boolean;
  largeTextMode: boolean;
  keyboardNavigationMode: boolean;
  
  // Focus management
  saveFocus: () => void;
  restoreFocus: () => void;
  focusElement: (element: HTMLElement | null) => void;
  
  // Announcements
  announce: (message: string, priority?: 'polite' | 'assertive', delay?: number) => void;
  
  // Settings
  setHighContrastMode: (enabled: boolean) => void;
  setLargeTextMode: (enabled: boolean) => void;
  setKeyboardNavigationMode: (enabled: boolean) => void;
  
  // Utilities
  isScreenReaderActive: boolean;
  isTouchDevice: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  // System preferences
  const prefersReducedMotion = useReducedMotion();
  
  // User preferences
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [keyboardNavigationMode, setKeyboardNavigationMode] = useState(false);
  
  // Device detection
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Hooks
  const { announce } = useAnnouncements();
  const { saveFocus, restoreFocus, focusElement } = useFocusManagement();

  // Detect screen reader
  useEffect(() => {
    const detectScreenReader = () => {
      // Check for common screen reader indicators
      const hasScreenReader = 
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver') ||
        navigator.userAgent.includes('TalkBack') ||
        window.speechSynthesis?.getVoices().length > 0;
      
      setIsScreenReaderActive(hasScreenReader);
    };

    detectScreenReader();
    
    // Listen for speech synthesis voices (indicates screen reader)
    if (window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', detectScreenReader);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', detectScreenReader);
      };
    }
  }, []);

  // Detect touch device
  useEffect(() => {
    const detectTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is not in TypeScript definitions but exists in IE
        navigator.msMaxTouchPoints > 0
      );
    };

    detectTouch();
    window.addEventListener('touchstart', detectTouch, { once: true });
    
    return () => {
      window.removeEventListener('touchstart', detectTouch);
    };
  }, []);

  // Keyboard navigation detection
  useEffect(() => {
    let keyboardUsed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !keyboardUsed) {
        keyboardUsed = true;
        setKeyboardNavigationMode(true);
        document.body.classList.add('keyboard-navigation');
      }
    };

    const handleMouseDown = () => {
      if (keyboardUsed) {
        keyboardUsed = false;
        setKeyboardNavigationMode(false);
        document.body.classList.remove('keyboard-navigation');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Apply accessibility preferences to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (highContrastMode) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Large text mode
    if (largeTextMode) {
      root.classList.add('large-text');
      root.style.setProperty('--font-size-multiplier', '1.25');
    } else {
      root.classList.remove('large-text');
      root.style.removeProperty('--font-size-multiplier');
    }
    
    // Reduced motion
    if (prefersReducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    // Keyboard navigation
    if (keyboardNavigationMode) {
      root.classList.add('keyboard-navigation');
    } else {
      root.classList.remove('keyboard-navigation');
    }
  }, [highContrastMode, largeTextMode, prefersReducedMotion, keyboardNavigationMode]);

  // Load saved preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dyad-accessibility-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        setHighContrastMode(preferences.highContrastMode || false);
        setLargeTextMode(preferences.largeTextMode || false);
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    }
  }, []);

  // Save preferences
  const savePreferences = useCallback(() => {
    try {
      const preferences = {
        highContrastMode,
        largeTextMode,
      };
      localStorage.setItem('dyad-accessibility-preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }, [highContrastMode, largeTextMode]);

  useEffect(() => {
    savePreferences();
  }, [savePreferences]);

  // Enhanced setters that announce changes
  const setHighContrastModeWithAnnouncement = useCallback((enabled: boolean) => {
    setHighContrastMode(enabled);
    announce(
      enabled ? 'High contrast mode enabled' : 'High contrast mode disabled',
      'polite'
    );
  }, [announce]);

  const setLargeTextModeWithAnnouncement = useCallback((enabled: boolean) => {
    setLargeTextMode(enabled);
    announce(
      enabled ? 'Large text mode enabled' : 'Large text mode disabled',
      'polite'
    );
  }, [announce]);

  const setKeyboardNavigationModeWithAnnouncement = useCallback((enabled: boolean) => {
    setKeyboardNavigationMode(enabled);
    if (enabled) {
      document.body.classList.add('keyboard-navigation');
    } else {
      document.body.classList.remove('keyboard-navigation');
    }
  }, []);

  // Context value
  const contextValue: AccessibilityContextType = {
    // Preferences
    prefersReducedMotion,
    highContrastMode,
    largeTextMode,
    keyboardNavigationMode,
    
    // Focus management
    saveFocus,
    restoreFocus,
    focusElement,
    
    // Announcements
    announce,
    
    // Settings
    setHighContrastMode: setHighContrastModeWithAnnouncement,
    setLargeTextMode: setLargeTextModeWithAnnouncement,
    setKeyboardNavigationMode: setKeyboardNavigationModeWithAnnouncement,
    
    // Utilities
    isScreenReaderActive,
    isTouchDevice,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {/* Skip links */}
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#navigation">Skip to navigation</SkipLink>
      
      {/* Live regions for announcements */}
      <LiveRegion level="polite" />
      <LiveRegion level="assertive" />
      
      {/* Screen reader instructions */}
      <div className="sr-only">
        <h1>Dyad CLI Gateway Admin Interface</h1>
        <p>
          This is the administrative interface for the Dyad CLI Gateway. 
          Use Tab to navigate between elements, Enter or Space to activate buttons, 
          and Escape to close dialogs.
        </p>
        <p>
          Press Ctrl+? or Cmd+? to hear available keyboard shortcuts.
        </p>
      </div>
      
      {children}
    </AccessibilityContext.Provider>
  );
};

// HOC for adding accessibility features to components
export const withAccessibility = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const AccessibleComponent = (props: P) => {
    const accessibility = useAccessibility();
    
    return (
      <Component 
        {...props} 
        accessibility={accessibility}
      />
    );
  };
  
  AccessibleComponent.displayName = `withAccessibility(${Component.displayName || Component.name})`;
  
  return AccessibleComponent;
};

export default AccessibilityProvider;