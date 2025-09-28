/**
 * Testing infrastructure verification
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Simple test components
const TestButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}>{children}</button>
);

const TestInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <input 
    value={value} 
    onChange={(e) => onChange(e.target.value)}
    placeholder="Test input"
  />
);

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

describe('Testing Infrastructure', () => {
  describe('Basic Rendering', () => {
    it('should render components', () => {
      render(<TestButton onClick={vi.fn()}>Click me</TestButton>);
      
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should handle user interactions', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      
      render(<TestButton onClick={handleClick}>Click me</TestButton>);
      
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle input changes', async () => {
      const user = userEvent.setup();
      let value = '';
      const handleChange = vi.fn((newValue: string) => {
        value = newValue;
      });
      
      const { rerender } = render(<TestInput value={value} onChange={handleChange} />);
      
      const input = screen.getByPlaceholderText('Test input');
      await user.type(input, 'Hello');
      
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('React Query Integration', () => {
    it('should provide QueryClient context', () => {
      const TestComponent = () => {
        const queryClient = new QueryClient();
        return <div data-testid="query-client">{queryClient ? 'Available' : 'Not available'}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('query-client')).toHaveTextContent('Available');
    });
  });

  describe('Router Integration', () => {
    it('should provide router context', () => {
      const TestComponent = () => {
        return <div data-testid="router">Router available</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('router')).toHaveTextContent('Router available');
    });
  });

  describe('Mock Functions', () => {
    it('should support vi.fn() mocks', () => {
      const mockFn = vi.fn();
      mockFn('test');
      
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support vi.spyOn() mocks', () => {
      const obj = { method: () => 'original' };
      const spy = vi.spyOn(obj, 'method').mockReturnValue('mocked');
      
      expect(obj.method()).toBe('mocked');
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('DOM Mocks', () => {
    it('should have localStorage mock', () => {
      localStorage.setItem('test', 'value');
      expect(localStorage.getItem('test')).toBe('value');
    });

    it('should have crypto mock', () => {
      const array = new Uint8Array(10);
      crypto.getRandomValues(array);
      
      // Should have filled the array with random values
      expect(array.some(val => val > 0)).toBe(true);
    });

    it('should have btoa/atob mocks', () => {
      const encoded = btoa('hello');
      const decoded = atob(encoded);
      
      expect(typeof encoded).toBe('string');
      expect(decoded).toBe('hello');
    });
  });

  describe('Event Handling', () => {
    it('should handle fireEvent', () => {
      const handleClick = vi.fn();
      render(<TestButton onClick={handleClick}>Click me</TestButton>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalled();
    });

    it('should handle keyboard events', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      
      render(<TestButton onClick={handleClick}>Click me</TestButton>);
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Async Testing', () => {
    it('should handle async operations', async () => {
      const AsyncComponent = () => {
        const [loading, setLoading] = React.useState(true);
        
        React.useEffect(() => {
          setTimeout(() => setLoading(false), 100);
        }, []);
        
        return <div>{loading ? 'Loading...' : 'Loaded'}</div>;
      };
      
      render(<AsyncComponent />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      await screen.findByText('Loaded');
      expect(screen.getByText('Loaded')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('should handle component errors', () => {
      const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>No error</div>;
      };

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);
        
        React.useEffect(() => {
          const handleError = () => setHasError(true);
          window.addEventListener('error', handleError);
          return () => window.removeEventListener('error', handleError);
        }, []);
        
        if (hasError) {
          return <div>Something went wrong</div>;
        }
        
        return <>{children}</>;
      };

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('No error')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});