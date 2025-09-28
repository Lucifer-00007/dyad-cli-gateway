import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AccessibilityProvider } from '@/components/accessibility-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { AccessibilityTester } from '@/components/accessibility-tester';
import { AccessibleList, AccessibleTabs } from '@/components/ui/keyboard-navigation';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test wrapper with all providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <I18nProvider>
      <AccessibilityProvider>
        {children}
      </AccessibilityProvider>
    </I18nProvider>
  );
};

describe('Accessibility Implementation', () => {
  beforeEach(() => {
    // Reset DOM state
    document.documentElement.className = '';
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    // Cleanup
    document.documentElement.className = '';
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  describe('Accessibility Provider', () => {
    it('should provide accessibility context', () => {
      render(
        <TestWrapper>
          <div data-testid="test-content">Test content</div>
        </TestWrapper>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should add skip links', () => {
      render(
        <TestWrapper>
          <div>Test content</div>
        </TestWrapper>
      );

      const skipLinks = screen.getAllByText(/skip to/i);
      expect(skipLinks.length).toBeGreaterThan(0);
    });

    it('should provide screen reader instructions', () => {
      render(
        <TestWrapper>
          <div>Test content</div>
        </TestWrapper>
      );

      expect(screen.getByText(/dyad cli gateway admin interface/i)).toBeInTheDocument();
    });
  });

  describe('Theme System', () => {
    it('should render theme toggle', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const themeButton = screen.getByRole('button', { name: /theme and accessibility settings/i });
      expect(themeButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const themeButton = screen.getByRole('button', { name: /theme and accessibility settings/i });
      
      // Focus the button
      await user.tab();
      expect(themeButton).toHaveFocus();

      // Open the menu
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Light')).toBeInTheDocument();
      });
    });

    it('should apply high contrast mode', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const themeButton = screen.getByRole('button', { name: /theme and accessibility settings/i });
      await user.click(themeButton);

      await waitFor(() => {
        const highContrastOption = screen.getByText('High Contrast');
        expect(highContrastOption).toBeInTheDocument();
      });
    });
  });

  describe('Internationalization', () => {
    it('should render language selector', () => {
      render(
        <TestWrapper>
          <LanguageSelector />
        </TestWrapper>
      );

      const languageButton = screen.getByRole('button');
      expect(languageButton).toBeInTheDocument();
    });

    it('should support multiple languages', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LanguageSelector />
        </TestWrapper>
      );

      const languageButton = screen.getByRole('button');
      await user.click(languageButton);

      await waitFor(() => {
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('Español')).toBeInTheDocument();
        expect(screen.getByText('Français')).toBeInTheDocument();
      });
    });

    it('should set document language attribute', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LanguageSelector />
        </TestWrapper>
      );

      const languageButton = screen.getByRole('button');
      await user.click(languageButton);

      const spanishOption = await screen.findByText('Español');
      await user.click(spanishOption);

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('es');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    const testItems = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ];

    it('should support arrow key navigation', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <TestWrapper>
          <AccessibleList
            items={testItems}
            onSelect={onSelect}
            renderItem={(item) => <div>{item.name}</div>}
            ariaLabel="Test list"
          />
        </TestWrapper>
      );

      const list = screen.getByRole('listbox', { name: 'Test list' });
      await user.click(list);

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith(testItems[1], 1);
    });

    it('should support home and end keys', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <TestWrapper>
          <AccessibleList
            items={testItems}
            onSelect={onSelect}
            renderItem={(item) => <div>{item.name}</div>}
            ariaLabel="Test list"
          />
        </TestWrapper>
      );

      const list = screen.getByRole('listbox', { name: 'Test list' });
      await user.click(list);

      // Go to end
      await user.keyboard('{End}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith(testItems[2], 2);

      // Go to beginning
      await user.keyboard('{Home}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith(testItems[0], 0);
    });
  });

  describe('Tab Navigation', () => {
    const testTabs = [
      { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
      { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
      { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> },
    ];

    it('should support tab navigation with arrow keys', async () => {
      const user = userEvent.setup();
      const onTabChange = vi.fn();

      render(
        <TestWrapper>
          <AccessibleTabs
            tabs={testTabs}
            activeTab="tab1"
            onTabChange={onTabChange}
          />
        </TestWrapper>
      );

      const tabList = screen.getByRole('tablist');
      await user.click(tabList);

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      
      expect(onTabChange).toHaveBeenCalledWith('tab2');
    });

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <AccessibleTabs
            tabs={testTabs}
            activeTab="tab1"
            onTabChange={() => {}}
          />
        </TestWrapper>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab1).toHaveAttribute('aria-controls', 'tabpanel-tab1');

      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toHaveAttribute('aria-labelledby', 'tab-tab1');
    });
  });

  describe('Focus Management', () => {
    it('should trap focus in modal', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <div>
            <button>Outside button</button>
            <div role="dialog" aria-modal="true">
              <button>Modal button 1</button>
              <button>Modal button 2</button>
              <button>Close</button>
            </div>
          </div>
        </TestWrapper>
      );

      const modalButton1 = screen.getByText('Modal button 1');
      const modalButton2 = screen.getByText('Modal button 2');
      const closeButton = screen.getByText('Close');

      // Focus should be trapped within modal
      modalButton1.focus();
      expect(modalButton1).toHaveFocus();

      await user.tab();
      expect(modalButton2).toHaveFocus();

      await user.tab();
      expect(closeButton).toHaveFocus();

      // Should wrap back to first button
      await user.tab();
      expect(modalButton1).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce status changes', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <div>
            <button>Test button</button>
            <div role="status" aria-live="polite" data-testid="status">
              Ready
            </div>
          </div>
        </TestWrapper>
      );

      const statusElement = screen.getByTestId('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide proper labels for form controls', () => {
      render(
        <TestWrapper>
          <form>
            <label htmlFor="test-input">Test Input</label>
            <input id="test-input" type="text" />
            
            <input type="text" aria-label="Unlabeled input" />
            
            <fieldset>
              <legend>Radio Group</legend>
              <input type="radio" id="radio1" name="test" />
              <label htmlFor="radio1">Option 1</label>
              <input type="radio" id="radio2" name="test" />
              <label htmlFor="radio2">Option 2</label>
            </fieldset>
          </form>
        </TestWrapper>
      );

      const labeledInput = screen.getByLabelText('Test Input');
      expect(labeledInput).toBeInTheDocument();

      const unlabeledInput = screen.getByLabelText('Unlabeled input');
      expect(unlabeledInput).toBeInTheDocument();

      const radioGroup = screen.getByRole('group', { name: 'Radio Group' });
      expect(radioGroup).toBeInTheDocument();
    });
  });

  describe('Accessibility Tester Component', () => {
    it('should render accessibility tester', () => {
      render(
        <TestWrapper>
          <AccessibilityTester />
        </TestWrapper>
      );

      const testerButton = screen.getByRole('button', { name: /open accessibility tester/i });
      expect(testerButton).toBeInTheDocument();
    });

    it('should open tester panel', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AccessibilityTester />
        </TestWrapper>
      );

      const testerButton = screen.getByRole('button', { name: /open accessibility tester/i });
      await user.click(testerButton);

      await waitFor(() => {
        expect(screen.getByText('Accessibility Tester')).toBeInTheDocument();
      });
    });
  });

  describe('Axe Accessibility Tests', () => {
    it('should not have accessibility violations - Theme Toggle', async () => {
      const { container } = render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations - Language Selector', async () => {
      const { container } = render(
        <TestWrapper>
          <LanguageSelector />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations - Accessible List', async () => {
      const testItems = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      const { container } = render(
        <TestWrapper>
          <AccessibleList
            items={testItems}
            onSelect={() => {}}
            renderItem={(item) => <div>{item.name}</div>}
            ariaLabel="Test list"
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations - Accessible Tabs', async () => {
      const testTabs = [
        { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
        { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
      ];

      const { container } = render(
        <TestWrapper>
          <AccessibleTabs
            tabs={testTabs}
            activeTab="tab1"
            onTabChange={() => {}}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect reduced motion preference', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <TestWrapper>
          <div>Test content</div>
        </TestWrapper>
      );

      // Check if reduced motion class is applied
      expect(document.documentElement).toHaveClass('reduced-motion');
    });
  });

  describe('High Contrast Support', () => {
    it('should apply high contrast styles when enabled', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const themeButton = screen.getByRole('button', { name: /theme and accessibility settings/i });
      await user.click(themeButton);

      const highContrastOption = await screen.findByText('High Contrast');
      await user.click(highContrastOption);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('high-contrast');
      });
    });
  });

  describe('Font Size Support', () => {
    it('should support different font sizes', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );

      const themeButton = screen.getByRole('button', { name: /theme and accessibility settings/i });
      await user.click(themeButton);

      // Navigate to font size submenu
      const fontSizeOption = await screen.findByText('Font Size');
      await user.hover(fontSizeOption);

      const largeOption = await screen.findByText('Large');
      await user.click(largeOption);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('font-large');
      });
    });
  });
});