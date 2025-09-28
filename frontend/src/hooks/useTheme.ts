import { useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeConfig {
  mode: Theme;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: FontSize;
}

interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: FontSize;
}

const isValidTheme = (value: string): value is Theme => {
  return ['dark', 'light', 'system'].includes(value);
};

const isValidFontSize = (value: string): value is FontSize => {
  return ['small', 'medium', 'large'].includes(value);
};

const getDefaultThemeConfig = (): ThemeConfig => ({
  mode: 'system',
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
});

export const useTheme = () => {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(getDefaultThemeConfig);

  // Load theme configuration from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dyad-theme-config');
        if (stored) {
          const parsed = JSON.parse(stored);
          const config: ThemeConfig = {
            mode: isValidTheme(parsed.mode) ? parsed.mode : 'system',
            highContrast: Boolean(parsed.highContrast),
            reducedMotion: Boolean(parsed.reducedMotion),
            fontSize: isValidFontSize(parsed.fontSize) ? parsed.fontSize : 'medium',
          };
          setThemeConfig(config);
        }
      } catch (error) {
        console.warn('Failed to read theme config from localStorage:', error);
      }
    }
  }, []);

  // Apply theme and accessibility preferences
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark', 'high-contrast', 'reduced-motion', 'font-small', 'font-medium', 'font-large');

    // Apply color scheme
    if (themeConfig.mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      };

      applySystemTheme();
      mediaQuery.addEventListener('change', applySystemTheme);

      // Cleanup function will be returned
      const cleanup = () => mediaQuery.removeEventListener('change', applySystemTheme);
      
      // Apply other preferences
      if (themeConfig.highContrast) root.classList.add('high-contrast');
      if (themeConfig.reducedMotion) root.classList.add('reduced-motion');
      root.classList.add(`font-${themeConfig.fontSize}`);

      return cleanup;
    } else {
      root.classList.add(themeConfig.mode);
    }

    // Apply accessibility preferences
    if (themeConfig.highContrast) root.classList.add('high-contrast');
    if (themeConfig.reducedMotion) root.classList.add('reduced-motion');
    root.classList.add(`font-${themeConfig.fontSize}`);

    // Set CSS custom properties for dynamic theming
    root.style.setProperty('--font-size-multiplier', 
      themeConfig.fontSize === 'small' ? '0.875' : 
      themeConfig.fontSize === 'large' ? '1.125' : '1'
    );

    if (themeConfig.reducedMotion) {
      root.style.setProperty('--animation-duration', '0ms');
      root.style.setProperty('--transition-duration', '0ms');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }
  }, [themeConfig]);

  // Detect system preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const updateSystemPreferences = () => {
      setThemeConfig(prev => ({
        ...prev,
        reducedMotion: prev.reducedMotion || reducedMotionQuery.matches,
        highContrast: prev.highContrast || highContrastQuery.matches,
      }));
    };

    // Only apply system preferences if user hasn't explicitly set them
    updateSystemPreferences();

    reducedMotionQuery.addEventListener('change', updateSystemPreferences);
    highContrastQuery.addEventListener('change', updateSystemPreferences);

    return () => {
      reducedMotionQuery.removeEventListener('change', updateSystemPreferences);
      highContrastQuery.removeEventListener('change', updateSystemPreferences);
    };
  }, []);

  const updateThemeConfig = useCallback((updates: Partial<ThemeConfig>) => {
    const newConfig = { ...themeConfig, ...updates };
    setThemeConfig(newConfig);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dyad-theme-config', JSON.stringify(newConfig));
      } catch (error) {
        console.warn('Failed to save theme config to localStorage:', error);
      }
    }
  }, [themeConfig]);

  const setTheme = useCallback((mode: Theme) => {
    updateThemeConfig({ mode });
  }, [updateThemeConfig]);

  const setAccessibilityPreferences = useCallback((preferences: Partial<AccessibilityPreferences>) => {
    updateThemeConfig(preferences);
  }, [updateThemeConfig]);

  const resetToDefaults = useCallback(() => {
    const defaultConfig = getDefaultThemeConfig();
    setThemeConfig(defaultConfig);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dyad-theme-config', JSON.stringify(defaultConfig));
      } catch (error) {
        console.warn('Failed to save theme config to localStorage:', error);
      }
    }
  }, []);

  return { 
    theme: themeConfig.mode,
    themeConfig,
    setTheme, 
    setAccessibilityPreferences,
    updateThemeConfig,
    resetToDefaults,
  };
};
