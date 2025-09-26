import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

const isValidTheme = (value: string): value is Theme => {
  return ['dark', 'light', 'system'].includes(value);
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('theme');
        if (stored && isValidTheme(stored)) {
          setTheme(stored);
        }
      } catch (error) {
        console.warn('Failed to read theme from localStorage:', error);
      }
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      };

      applySystemTheme();
      mediaQuery.addEventListener('change', applySystemTheme);

      return () => mediaQuery.removeEventListener('change', applySystemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const setThemeValue = (theme: Theme) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('theme', theme);
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
    }
    setTheme(theme);
  };

  return { theme, setTheme: setThemeValue };
};
