/**
 * Layout components test suite
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/layout/page-header';

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

describe('MainLayout', () => {
  it('should render main layout with navigation', () => {
    render(
      <TestWrapper>
        <MainLayout>
          <div data-testid="main-content">Main Content</div>
        </MainLayout>
      </TestWrapper>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should have proper landmark structure', () => {
    render(
      <TestWrapper>
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      </TestWrapper>
    );

    // Check for proper ARIA landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    
    // Check navigation has accessible name
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      </TestWrapper>
    );

    // Tab through navigation items
    await user.tab();
    
    // First focusable element should be in navigation
    const focusedElement = document.activeElement;
    const nav = screen.getByRole('navigation');
    expect(nav.contains(focusedElement)).toBe(true);
  });

  it('should be responsive', () => {
    // Mock window.matchMedia for mobile detection
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

    render(
      <TestWrapper>
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      </TestWrapper>
    );

    // Layout should adapt to mobile
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('should render title and description', () => {
    render(
      <PageHeader 
        title="Test Page" 
        description="This is a test page description"
      />
    );

    expect(screen.getByRole('heading', { name: 'Test Page' })).toBeInTheDocument();
    expect(screen.getByText('This is a test page description')).toBeInTheDocument();
  });

  it('should render breadcrumbs when provided', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Providers', href: '/providers' },
      { label: 'Create', href: '/providers/create' },
    ];

    render(
      <TestWrapper>
        <PageHeader 
          title="Create Provider" 
          breadcrumbs={breadcrumbs}
        />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('should render action buttons', async () => {
    const user = userEvent.setup();
    const mockAction = vi.fn();

    const actions = (
      <button onClick={mockAction} data-testid="test-action">
        Test Action
      </button>
    );

    render(
      <PageHeader 
        title="Test Page" 
        actions={actions}
      />
    );

    const actionButton = screen.getByTestId('test-action');
    expect(actionButton).toBeInTheDocument();

    await user.click(actionButton);
    expect(mockAction).toHaveBeenCalled();
  });

  it('should have proper heading hierarchy', () => {
    render(
      <PageHeader title="Main Title" />
    );

    const heading = screen.getByRole('heading', { name: 'Main Title' });
    expect(heading.tagName).toBe('H1');
  });

  it('should be accessible', () => {
    render(
      <PageHeader 
        title="Accessible Page" 
        description="This page is accessible"
      />
    );

    const heading = screen.getByRole('heading');
    expect(heading).toHaveAccessibleName('Accessible Page');
    
    // Description should be associated with heading
    const description = screen.getByText('This page is accessible');
    expect(description).toBeInTheDocument();
  });
});