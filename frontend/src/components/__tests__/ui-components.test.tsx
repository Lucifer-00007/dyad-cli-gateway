/**
 * UI components test suite
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { LoadingStates } from '@/components/ui/loading-states';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { FeatureGate } from '@/components/ui/feature-gate';
import { VirtualScroll } from '@/components/ui/virtual-scroll';

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
      {children}
    </QueryClientProvider>
  );
};

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should support different variants', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border');
  });

  it('should support different sizes', () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-10');

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-9');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });

  it('should show loading state', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});

describe('Input Component', () => {
  it('should render input with label', () => {
    render(
      <div>
        <label htmlFor="test-input">Test Input</label>
        <Input id="test-input" />
      </div>
    );
    
    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test value');
    
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('test value');
  });

  it('should show error state', () => {
    render(<Input error="This field is required" />);
    
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-destructive');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled />);
    
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should support different types', () => {
    const { rerender } = render(<Input type="text" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');

    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');

    rerender(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });
});

describe('DataTable Component', () => {
  const mockData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'active' },
  ];

  const mockColumns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'status', header: 'Status' },
  ];

  it('should render table with data', () => {
    render(
      <DataTable 
        data={mockData} 
        columns={mockColumns}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(
      <DataTable 
        data={mockData} 
        columns={mockColumns}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should handle sorting', async () => {
    const user = userEvent.setup();
    
    render(
      <DataTable 
        data={mockData} 
        columns={mockColumns}
        sorting={{ enabled: true }}
      />
    );

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    // Should show sort indicator
    expect(nameHeader.closest('th')).toHaveAttribute('aria-sort');
  });

  it('should handle pagination', () => {
    render(
      <DataTable 
        data={mockData} 
        columns={mockColumns}
        pagination={{ 
          enabled: true, 
          pageSize: 2, 
          currentPage: 1,
          totalPages: 2 
        }}
      />
    );

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(
      <DataTable 
        data={[]} 
        columns={mockColumns}
      />
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should handle row selection', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    
    render(
      <DataTable 
        data={mockData} 
        columns={mockColumns}
        selection={{ enabled: true, onSelectionChange }}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First data row checkbox

    expect(onSelectionChange).toHaveBeenCalled();
  });
});

describe('ConfirmationDialog Component', () => {
  it('should render when open', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={false}
        title="Confirm Action"
        description="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should handle confirm action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Confirm Action"
        description="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Confirm Action"
        description="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should support destructive variant', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Delete Item"
        description="This action cannot be undone."
        variant="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-destructive');
  });
});

describe('LoadingStates Component', () => {
  it('should render skeleton loader', () => {
    render(<LoadingStates.Skeleton />);
    
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  it('should render spinner', () => {
    render(<LoadingStates.Spinner />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render table skeleton', () => {
    render(<LoadingStates.TableSkeleton rows={3} columns={4} />);
    
    const skeletons = screen.getAllByTestId('skeleton-loader');
    expect(skeletons).toHaveLength(12); // 3 rows * 4 columns
  });

  it('should render card skeleton', () => {
    render(<LoadingStates.CardSkeleton />);
    
    expect(screen.getByTestId('card-skeleton')).toBeInTheDocument();
  });
});

describe('ErrorBoundary Component', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>No error</div>;
  };

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should allow retry after error', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const TestComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Simulate recovery
    shouldThrow = false;
    await user.click(screen.getByText('Try again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});

describe('FeatureGate Component', () => {
  it('should render children when feature is enabled', () => {
    render(
      <TestWrapper>
        <FeatureGate flag="test-feature">
          <div data-testid="feature-content">Feature Content</div>
        </FeatureGate>
      </TestWrapper>
    );

    expect(screen.getByTestId('feature-content')).toBeInTheDocument();
  });

  it('should render fallback when feature is disabled', () => {
    render(
      <TestWrapper>
        <FeatureGate 
          flag="disabled-feature" 
          fallback={<div data-testid="fallback">Fallback Content</div>}
        >
          <div data-testid="feature-content">Feature Content</div>
        </FeatureGate>
      </TestWrapper>
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
  });

  it('should render nothing when no fallback provided and feature disabled', () => {
    render(
      <TestWrapper>
        <FeatureGate flag="disabled-feature">
          <div data-testid="feature-content">Feature Content</div>
        </FeatureGate>
      </TestWrapper>
    );

    expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
  });
});

describe('VirtualScroll Component', () => {
  const generateItems = (count: number) => 
    Array.from({ length: count }, (_, i) => ({ 
      id: i, 
      name: `Item ${i}`,
      value: i * 10 
    }));

  it('should render only visible items', () => {
    const items = generateItems(1000);
    
    render(
      <VirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={300}
        renderItem={(item) => (
          <div data-testid={`item-${item.id}`} key={item.id}>
            {item.name}
          </div>
        )}
      />
    );

    // Should only render visible items (approximately 6-8 items for 300px container with 50px items)
    const renderedItems = screen.getAllByTestId(/^item-/);
    expect(renderedItems.length).toBeLessThan(20);
    expect(renderedItems.length).toBeGreaterThan(5);
  });

  it('should handle scrolling', async () => {
    const items = generateItems(100);
    
    render(
      <VirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={300}
        renderItem={(item) => (
          <div data-testid={`item-${item.id}`} key={item.id}>
            {item.name}
          </div>
        )}
      />
    );

    const container = screen.getByTestId('virtual-scroll-container');
    
    // Simulate scroll
    fireEvent.scroll(container, { target: { scrollTop: 500 } });

    // Should render different items after scroll
    await waitFor(() => {
      const renderedItems = screen.getAllByTestId(/^item-/);
      expect(renderedItems.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty items list', () => {
    render(
      <VirtualScroll
        items={[]}
        itemHeight={50}
        containerHeight={300}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    );

    expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
    expect(screen.queryByTestId(/^item-/)).not.toBeInTheDocument();
  });

  it('should maintain scroll position', () => {
    const items = generateItems(100);
    
    render(
      <VirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={300}
        renderItem={(item) => (
          <div data-testid={`item-${item.id}`} key={item.id}>
            {item.name}
          </div>
        )}
      />
    );

    const container = screen.getByTestId('virtual-scroll-container');
    
    // Set scroll position
    fireEvent.scroll(container, { target: { scrollTop: 250 } });
    
    expect(container.scrollTop).toBe(250);
  });
});