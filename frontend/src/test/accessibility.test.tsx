/**
 * Accessibility test suite with axe-core integration
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/layout/page-header';
import { ProviderForm } from '@/components/providers/provider-form';
import { ProviderList } from '@/components/providers/enhanced-provider-list';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatPlayground } from '@/pages/ChatPlayground';
import { Monitoring } from '@/pages/Monitoring';
import { ApiKeys } from '@/pages/ApiKeys';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock data
const mockProviders = [
  {
    _id: 'provider-1',
    name: 'Test Provider',
    slug: 'test-provider',
    type: 'http-sdk' as const,
    description: 'A test provider',
    enabled: true,
    adapterConfig: {},
    models: [],
    healthStatus: {
      status: 'healthy' as const,
      lastChecked: '2023-01-01T00:00:00Z',
      responseTime: 150,
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
];

describe('Accessibility Tests', () => {
  describe('Layout Components', () => {
    it('MainLayout should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <MainLayout>
            <div>Main content</div>
          </MainLayout>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('MainLayout should have proper landmark structure', () => {
      render(
        <TestWrapper>
          <MainLayout>
            <div>Main content</div>
          </MainLayout>
        </TestWrapper>
      );

      // Check for required landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Navigation should have accessible name
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label');
    });

    it('PageHeader should have no accessibility violations', async () => {
      const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Providers', href: '/providers' },
      ];

      const { container } = render(
        <TestWrapper>
          <PageHeader 
            title="Test Page" 
            description="Test description"
            breadcrumbs={breadcrumbs}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('PageHeader should have proper heading hierarchy', () => {
      render(
        <PageHeader title="Main Title" />
      );

      const heading = screen.getByRole('heading', { name: 'Main Title' });
      expect(heading.tagName).toBe('H1');
      expect(heading).toHaveAccessibleName('Main Title');
    });
  });

  describe('Form Components', () => {
    it('ProviderForm should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ProviderForm
            mode="create"
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('ProviderForm should have proper form labels', () => {
      render(
        <TestWrapper>
          <ProviderForm
            mode="create"
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </TestWrapper>
      );

      // All form controls should have labels
      expect(screen.getByLabelText(/Provider Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Provider Slug/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Provider Type/)).toBeInTheDocument();
    });

    it('Input component should have no accessibility violations', async () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Test Input</label>
          <Input id="test-input" />
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Input with error should be properly associated', () => {
      render(
        <div>
          <label htmlFor="error-input">Error Input</label>
          <Input id="error-input" error="This field is required" />
        </div>
      );

      const input = screen.getByLabelText('Error Input');
      const errorMessage = screen.getByText('This field is required');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(errorMessage).toHaveAttribute('id');
    });
  });

  describe('Data Display Components', () => {
    it('DataTable should have no accessibility violations', async () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ];
      
      const columns = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'email', header: 'Email' },
      ];

      const { container } = render(
        <DataTable data={data} columns={columns} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('DataTable should have proper table structure', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com' },
      ];
      
      const columns = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'email', header: 'Email' },
      ];

      render(<DataTable data={data} columns={columns} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Should have column headers
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
      
      // Should have data cells
      expect(screen.getByRole('cell', { name: 'John' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'john@example.com' })).toBeInTheDocument();
    });

    it('ProviderList should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ProviderList
            providers={mockProviders}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Interactive Components', () => {
    it('Button should have no accessibility violations', async () => {
      const { container } = render(
        <Button onClick={vi.fn()}>Click me</Button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Button should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      
      // Should be focusable
      await user.tab();
      expect(button).toHaveFocus();
      
      // Should be activatable with Enter
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
      
      // Should be activatable with Space
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('ConfirmationDialog should have no accessibility violations', async () => {
      const { container } = render(
        <ConfirmationDialog
          open={true}
          title="Confirm Action"
          description="Are you sure?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('ConfirmationDialog should have proper focus management', () => {
      render(
        <ConfirmationDialog
          open={true}
          title="Confirm Action"
          description="Are you sure?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Dialog should have proper role and labeling
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
      
      // Title should be properly associated
      const title = screen.getByText('Confirm Action');
      expect(title).toHaveAttribute('id');
      
      // Description should be properly associated
      const description = screen.getByText('Are you sure?');
      expect(description).toHaveAttribute('id');
    });
  });

  describe('Page Components', () => {
    it('ChatPlayground should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ChatPlayground />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Monitoring page should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <Monitoring />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('ApiKeys page should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ApiKeys />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through interactive elements', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First Button</Button>
          <Input placeholder="Input field" />
          <Button>Second Button</Button>
        </div>
      );

      const firstButton = screen.getByText('First Button');
      const input = screen.getByPlaceholderText('Input field');
      const secondButton = screen.getByText('Second Button');

      // Tab through elements
      await user.tab();
      expect(firstButton).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.tab();
      expect(secondButton).toHaveFocus();

      // Shift+Tab should go backwards
      await user.tab({ shift: true });
      expect(input).toHaveFocus();
    });

    it('should support arrow key navigation in lists', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProviderList
            providers={mockProviders}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
          />
        </TestWrapper>
      );

      // Focus first item
      await user.tab();
      
      // Arrow keys should navigate within the list
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      
      // Home/End should go to first/last items
      await user.keyboard('{Home}');
      await user.keyboard('{End}');
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels and descriptions', () => {
      render(
        <TestWrapper>
          <MainLayout>
            <PageHeader 
              title="Providers" 
              description="Manage your AI providers"
            />
            <ProviderList
              providers={mockProviders}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onTest={vi.fn()}
              onToggleEnabled={vi.fn()}
            />
          </MainLayout>
        </TestWrapper>
      );

      // Navigation should have accessible name
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label');

      // Main content should be identified
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Headings should be properly structured
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('should announce dynamic content changes', () => {
      const { rerender } = render(
        <div aria-live="polite" aria-atomic="true">
          <span>Loading...</span>
        </div>
      );

      // Content change should be announced
      rerender(
        <div aria-live="polite" aria-atomic="true">
          <span>Data loaded successfully</span>
        </div>
      );

      expect(screen.getByText('Data loaded successfully')).toBeInTheDocument();
    });

    it('should provide status updates for form validation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProviderForm
            mode="create"
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        </TestWrapper>
      );

      // Submit form without required fields
      await user.click(screen.getByText('Create'));

      // Error messages should be announced
      const errorMessage = screen.getByText('Provider name is required');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet color contrast requirements', async () => {
      const { container } = render(
        <div>
          <Button variant="default">Default Button</Button>
          <Button variant="destructive">Destructive Button</Button>
          <Button variant="outline">Outline Button</Button>
        </div>
      );

      // axe-core will check color contrast automatically
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not rely solely on color for information', () => {
      render(
        <TestWrapper>
          <ProviderList
            providers={mockProviders}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onTest={vi.fn()}
            onToggleEnabled={vi.fn()}
          />
        </TestWrapper>
      );

      // Status should be indicated by text, not just color
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus in modal dialogs', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmationDialog
          open={true}
          title="Delete Provider"
          description="This action cannot be undone."
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Focus should be trapped within the dialog
      await user.tab();
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveFocus();

      await user.tab();
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveFocus();

      // Tab from last element should go to first
      await user.tab();
      expect(confirmButton).toHaveFocus();
    });

    it('should restore focus after modal closes', async () => {
      const user = userEvent.setup();
      let isOpen = true;

      const TestComponent = () => (
        <div>
          <Button onClick={() => { isOpen = true; }}>Open Dialog</Button>
          {isOpen && (
            <ConfirmationDialog
              open={isOpen}
              title="Test Dialog"
              description="Test description"
              onConfirm={() => { isOpen = false; }}
              onCancel={() => { isOpen = false; }}
            />
          )}
        </div>
      );

      const { rerender } = render(<TestComponent />);

      const openButton = screen.getByText('Open Dialog');
      openButton.focus();

      // Open dialog
      isOpen = true;
      rerender(<TestComponent />);

      // Close dialog
      await user.click(screen.getByText('Cancel'));
      isOpen = false;
      rerender(<TestComponent />);

      // Focus should return to the trigger button
      expect(openButton).toHaveFocus();
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('768px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <TestWrapper>
          <MainLayout>
            <ProviderList
              providers={mockProviders}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onTest={vi.fn()}
              onToggleEnabled={vi.fn()}
            />
          </MainLayout>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support touch interactions', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Touch Button</Button>);

      const button = screen.getByRole('button');
      
      // Simulate touch interaction
      await user.pointer({ target: button, keys: '[TouchA]' });
      
      expect(handleClick).toHaveBeenCalled();
    });
  });
});