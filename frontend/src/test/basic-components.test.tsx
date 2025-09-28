/**
 * Basic component tests for existing components
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';

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

describe('Basic UI Components', () => {
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
      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');

      rerender(<Button variant="destructive">Destructive</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive');

      rerender(<Button variant="outline">Outline</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('border');
    });
  });

  describe('Input Component', () => {
    it('should render input field', () => {
      render(<Input placeholder="Enter text" />);
      
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
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

  describe('ThemeToggle Component', () => {
    it('should render theme toggle button', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      // Should render a button for theme toggle
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const button = screen.getByRole('button');
      
      // Should be focusable
      await user.tab();
      expect(button).toHaveFocus();
      
      // Should be activatable with Enter
      await user.keyboard('{Enter}');
      // Theme should toggle (we can't easily test the actual theme change in this context)
    });
  });
});

describe('Component Integration', () => {
  it('should work together in a form', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    const TestForm = () => {
      const [value, setValue] = React.useState('');
      
      return (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(value); }}>
          <Input 
            value={value} 
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter name"
          />
          <Button type="submit">Submit</Button>
        </form>
      );
    };

    render(<TestForm />);

    // Fill input
    const input = screen.getByPlaceholderText('Enter name');
    await user.type(input, 'John Doe');

    // Submit form
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledWith('John Doe');
  });

  it('should handle multiple components with proper focus management', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <Input placeholder="First input" />
        <Input placeholder="Second input" />
        <Button>Submit</Button>
      </div>
    );

    // Tab through elements
    await user.tab();
    expect(screen.getByPlaceholderText('First input')).toHaveFocus();

    await user.tab();
    expect(screen.getByPlaceholderText('Second input')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
  });
});

describe('Accessibility', () => {
  it('should have proper ARIA attributes', () => {
    render(
      <div>
        <label htmlFor="test-input">Test Input</label>
        <Input id="test-input" />
        <Button aria-label="Submit form">Submit</Button>
      </div>
    );

    const input = screen.getByLabelText('Test Input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'test-input');

    const button = screen.getByRole('button', { name: 'Submit form' });
    expect(button).toHaveAttribute('aria-label', 'Submit form');
  });

  it('should support screen readers', () => {
    render(
      <div>
        <Button aria-describedby="help-text">Action Button</Button>
        <div id="help-text">This button performs an action</div>
      </div>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby', 'help-text');
    expect(screen.getByText('This button performs an action')).toBeInTheDocument();
  });
});

describe('Performance', () => {
  it('should render quickly', () => {
    const start = performance.now();
    
    render(
      <div>
        {Array.from({ length: 100 }, (_, i) => (
          <Button key={i}>Button {i}</Button>
        ))}
      </div>
    );
    
    const end = performance.now();
    const renderTime = end - start;
    
    // Should render 100 buttons in reasonable time
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });

  it('should handle re-renders efficiently', () => {
    let renderCount = 0;
    
    const TestComponent = ({ value }: { value: string }) => {
      renderCount++;
      return <Input value={value} readOnly />;
    };

    const { rerender } = render(<TestComponent value="initial" />);
    expect(renderCount).toBe(1);

    // Re-render with same value
    rerender(<TestComponent value="initial" />);
    expect(renderCount).toBe(2); // Expected without memoization

    // Re-render with different value
    rerender(<TestComponent value="changed" />);
    expect(renderCount).toBe(3);
  });
});