import React from 'react';
import { Moon, Sun, Monitor, Contrast, Type, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';

export const ThemeToggle = () => {
  const { theme, themeConfig, setTheme, setAccessibilityPreferences } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          aria-label="Theme and accessibility settings"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Theme and accessibility settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme & Accessibility</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Theme Selection */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Color Scheme
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
          {theme === 'light' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
          {theme === 'dark' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
          {theme === 'system' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Accessibility Options */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Accessibility
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={themeConfig.highContrast}
          onCheckedChange={(checked) => 
            setAccessibilityPreferences({ highContrast: checked })
          }
        >
          <Contrast className="mr-2 h-4 w-4" />
          High Contrast
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={themeConfig.reducedMotion}
          onCheckedChange={(checked) => 
            setAccessibilityPreferences({ reducedMotion: checked })
          }
        >
          <Zap className="mr-2 h-4 w-4" />
          Reduce Motion
        </DropdownMenuCheckboxItem>
        
        {/* Font Size Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Type className="mr-2 h-4 w-4" />
            Font Size
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem 
              onClick={() => setAccessibilityPreferences({ fontSize: 'small' })}
            >
              Small
              {themeConfig.fontSize === 'small' && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setAccessibilityPreferences({ fontSize: 'medium' })}
            >
              Medium
              {themeConfig.fontSize === 'medium' && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setAccessibilityPreferences({ fontSize: 'large' })}
            >
              Large
              {themeConfig.fontSize === 'large' && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Simple theme toggle for cases where full menu is not needed
export const SimpleThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};
