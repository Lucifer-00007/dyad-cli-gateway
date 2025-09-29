# Code Style Guide

This document outlines the coding standards and best practices for the Dyad CLI Gateway Admin UI frontend project.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript Guidelines](#typescript-guidelines)
- [React Component Guidelines](#react-component-guidelines)
- [File and Directory Structure](#file-and-directory-structure)
- [Naming Conventions](#naming-conventions)
- [Import/Export Guidelines](#importexport-guidelines)
- [CSS and Styling](#css-and-styling)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Performance Guidelines](#performance-guidelines)
- [Accessibility Guidelines](#accessibility-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)

## General Principles

### Code Quality Standards

1. **Readability First**: Code should be self-documenting and easy to understand
2. **Consistency**: Follow established patterns throughout the codebase
3. **Maintainability**: Write code that is easy to modify and extend
4. **Performance**: Consider performance implications of code decisions
5. **Accessibility**: Ensure all UI components are accessible
6. **Type Safety**: Leverage TypeScript's type system fully

### Code Review Checklist

- [ ] Code follows established patterns
- [ ] TypeScript types are properly defined
- [ ] Components are properly tested
- [ ] Accessibility requirements are met
- [ ] Performance considerations are addressed
- [ ] Error handling is implemented
- [ ] Documentation is updated

## TypeScript Guidelines

### Type Definitions

#### Prefer Interfaces for Object Types

```typescript
// ✅ Good
interface UserProps {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

// ❌ Avoid
type UserProps = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
};
```

#### Use Type for Unions and Primitives

```typescript
// ✅ Good
type Status = 'loading' | 'success' | 'error';
type Theme = 'light' | 'dark' | 'system';

// ✅ Good for computed types
type UserKeys = keyof User;
type PartialUser = Partial<User>;
```

#### Strict Type Definitions

```typescript
// ✅ Good - Explicit and strict
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

// ❌ Avoid - Too loose
interface ApiResponse {
  data: any;
  success: boolean;
  [key: string]: any;
}
```

#### Generic Constraints

```typescript
// ✅ Good - Constrained generics
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
}

// ✅ Good - Default generic parameters
interface PaginatedResponse<T = unknown> {
  results: T[];
  totalResults: number;
  page: number;
  totalPages: number;
}
```

### Utility Types Usage

```typescript
// ✅ Good - Use built-in utility types
type CreateUserRequest = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateUserRequest = Partial<Pick<User, 'name' | 'email'>>;
type UserStatus = Pick<User, 'id' | 'isActive'>;

// ✅ Good - Custom utility types
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
```

### Avoid `any` and `unknown`

```typescript
// ✅ Good - Specific types
interface FormData {
  [key: string]: string | number | boolean;
}

// ❌ Avoid
const formData: any = {};

// ✅ Good - Type guards for unknown
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function processValue(value: unknown) {
  if (isString(value)) {
    // TypeScript knows value is string here
    return value.toUpperCase();
  }
}
```

## React Component Guidelines

### Component Structure

```typescript
// ✅ Good - Complete component structure
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useProviders } from '@/hooks/api/use-providers';
import { Provider } from '@/types/api';

// Props interface
interface ProviderListProps {
  onSelect?: (provider: Provider) => void;
  filter?: string;
  className?: string;
}

// Component implementation
export const ProviderList: React.FC<ProviderListProps> = ({
  onSelect,
  filter,
  className,
}) => {
  // State hooks
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // API hooks
  const { data: providers, isLoading, error } = useProviders();
  
  // Memoized values
  const filteredProviders = useMemo(() => {
    if (!providers || !filter) return providers;
    return providers.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [providers, filter]);
  
  // Event handlers
  const handleSelect = useCallback((provider: Provider) => {
    setSelectedId(provider.id);
    onSelect?.(provider);
  }, [onSelect]);
  
  // Effects
  useEffect(() => {
    if (error) {
      console.error('Failed to load providers:', error);
    }
  }, [error]);
  
  // Early returns
  if (isLoading) {
    return <div className="animate-pulse">Loading providers...</div>;
  }
  
  if (error) {
    return <div className="text-destructive">Failed to load providers</div>;
  }
  
  // Main render
  return (
    <div className={cn('space-y-2', className)}>
      {filteredProviders?.map((provider) => (
        <div
          key={provider.id}
          className={cn(
            'p-4 border rounded-lg cursor-pointer transition-colors',
            selectedId === provider.id && 'bg-accent'
          )}
          onClick={() => handleSelect(provider)}
        >
          <h3 className="font-semibold">{provider.name}</h3>
          <p className="text-sm text-muted-foreground">{provider.type}</p>
        </div>
      ))}
    </div>
  );
};

// Default export
export default ProviderList;
```

### Hooks Guidelines

#### Custom Hook Structure

```typescript
// ✅ Good - Custom hook with proper structure
export const useProviderForm = (initialData?: Provider) => {
  // Form state
  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: initialData || getDefaultValues(),
  });
  
  // API mutations
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  
  // Derived state
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const hasChanges = form.formState.isDirty;
  
  // Handlers
  const handleSubmit = useCallback(async (data: ProviderFormData) => {
    try {
      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      form.reset();
    } catch (error) {
      // Error is handled by mutation
    }
  }, [initialData, createMutation, updateMutation, form]);
  
  const handleReset = useCallback(() => {
    form.reset(initialData || getDefaultValues());
  }, [form, initialData]);
  
  // Return stable object
  return {
    form,
    isSubmitting,
    hasChanges,
    handleSubmit: form.handleSubmit(handleSubmit),
    handleReset,
    error: createMutation.error || updateMutation.error,
  };
};
```

#### Hook Dependencies

```typescript
// ✅ Good - Proper dependency management
const useDebounced = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Include all dependencies
  
  return debouncedValue;
};

// ✅ Good - Memoized callback with dependencies
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query);
  onSearch?.(query);
}, [onSearch]); // Only include necessary dependencies
```

### Component Patterns

#### Compound Components

```typescript
// ✅ Good - Compound component pattern
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Content: React.FC<CardContentProps>;
} = ({ children, className }) => (
  <div className={cn('border rounded-lg', className)}>
    {children}
  </div>
);

Card.Header = ({ children, className }) => (
  <div className={cn('p-4 border-b', className)}>
    {children}
  </div>
);

Card.Content = ({ children, className }) => (
  <div className={cn('p-4', className)}>
    {children}
  </div>
);

// Usage
<Card>
  <Card.Header>
    <h2>Title</h2>
  </Card.Header>
  <Card.Content>
    <p>Content</p>
  </Card.Content>
</Card>
```

#### Render Props Pattern

```typescript
// ✅ Good - Render props for flexible UI
interface DataFetcherProps<T> {
  url: string;
  children: (state: {
    data: T | null;
    loading: boolean;
    error: Error | null;
  }) => React.ReactNode;
}

const DataFetcher = <T,>({ url, children }: DataFetcherProps<T>) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['data', url],
    queryFn: () => fetch(url).then(res => res.json()),
  });
  
  return children({
    data: data || null,
    loading: isLoading,
    error: error as Error | null,
  });
};

// Usage
<DataFetcher<Provider[]> url="/api/providers">
  {({ data, loading, error }) => {
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage error={error} />;
    return <ProviderList providers={data || []} />;
  }}
</DataFetcher>
```

## File and Directory Structure

### Directory Organization

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI primitives (shadcn/ui)
│   ├── layout/          # Layout components
│   └── common/          # Common components
├── features/            # Feature-specific components
│   ├── providers/       # Provider management
│   ├── monitoring/      # System monitoring
│   └── chat/           # Chat playground
├── hooks/              # Custom React hooks
│   ├── api/            # API-related hooks
│   └── ui/             # UI-related hooks
├── services/           # API services and external integrations
├── types/              # TypeScript type definitions
├── lib/                # Utility libraries and configurations
├── constants/          # Application constants
└── test/              # Test utilities and setup
```

### File Naming Conventions

```typescript
// Components - PascalCase
ProviderForm.tsx
ProviderList.tsx
MainLayout.tsx

// Hooks - camelCase with 'use' prefix
useProviders.ts
useAuth.ts
useLocalStorage.ts

// Services - camelCase
apiClient.ts
providerService.ts
authService.ts

// Types - camelCase
api.ts
ui.ts
common.ts

// Utilities - camelCase
formatters.ts
validators.ts
helpers.ts

// Constants - camelCase or UPPER_SNAKE_CASE
constants.ts
API_ENDPOINTS.ts
```

## Naming Conventions

### Variables and Functions

```typescript
// ✅ Good - Descriptive names
const isUserAuthenticated = checkAuthStatus();
const handleProviderSubmit = (data: ProviderData) => {};
const fetchProviderById = async (id: string) => {};

// ❌ Avoid - Unclear names
const flag = checkAuthStatus();
const handle = (data: any) => {};
const fetch = async (id: string) => {};
```

### Constants

```typescript
// ✅ Good - Descriptive constants
const API_ENDPOINTS = {
  PROVIDERS: '/api/v1/admin/providers',
  MODELS: '/api/v1/models',
  HEALTH: '/api/v1/system/health',
} as const;

const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  MIN_LENGTH: (min: number) => `Minimum ${min} characters required`,
} as const;

// ✅ Good - Enum-like objects
const PROVIDER_TYPES = {
  SPAWN_CLI: 'spawn-cli',
  HTTP_SDK: 'http-sdk',
  PROXY: 'proxy',
  LOCAL: 'local',
} as const;

type ProviderType = typeof PROVIDER_TYPES[keyof typeof PROVIDER_TYPES];
```

### Component Props

```typescript
// ✅ Good - Clear prop names
interface ProviderFormProps {
  initialData?: Provider;
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitButtonText?: string;
}

// ✅ Good - Event handler naming
interface ButtonProps {
  onClick?: (event: React.MouseEvent) => void;
  onMouseEnter?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
}
```

## Import/Export Guidelines

### Import Order

```typescript
// 1. React and external libraries
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

// 2. Internal modules (absolute imports)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useProviders } from '@/hooks/api/use-providers';
import { Provider, ProviderFormData } from '@/types/api';
import { cn } from '@/lib/utils';

// 3. Relative imports
import { ProviderFormFields } from './ProviderFormFields';
import { validateProviderData } from '../utils/validation';
import './ProviderForm.css';
```

### Export Patterns

```typescript
// ✅ Good - Named exports for utilities
export const formatDate = (date: Date): string => {};
export const validateEmail = (email: string): boolean => {};
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {};

// ✅ Good - Default export for main component
const ProviderForm: React.FC<ProviderFormProps> = (props) => {
  // Component implementation
};

export default ProviderForm;

// ✅ Good - Re-exports from index files
// components/ui/index.ts
export { Button } from './button';
export { Card, CardContent, CardHeader } from './card';
export { Dialog, DialogContent, DialogHeader } from './dialog';

// ✅ Good - Type-only exports
export type { Provider, ProviderFormData } from './types';
```

## CSS and Styling

### Tailwind CSS Guidelines

```typescript
// ✅ Good - Use cn utility for conditional classes
import { cn } from '@/lib/utils';

const Button = ({ variant, size, className, ...props }) => (
  <button
    className={cn(
      // Base styles
      'inline-flex items-center justify-center rounded-md font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      
      // Variant styles
      {
        'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
        'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
        'border border-input bg-background hover:bg-accent': variant === 'outline',
      },
      
      // Size styles
      {
        'h-10 px-4 py-2': size === 'default',
        'h-9 rounded-md px-3': size === 'sm',
        'h-11 rounded-md px-8': size === 'lg',
      },
      
      className
    )}
    {...props}
  />
);

// ✅ Good - Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card className="p-4 hover:shadow-lg transition-shadow">
    <CardContent>Content</CardContent>
  </Card>
</div>

// ✅ Good - Dark mode support
<div className="bg-background text-foreground border-border">
  <h1 className="text-2xl font-bold text-foreground">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>
```

### CSS Custom Properties

```css
/* ✅ Good - Use CSS custom properties for theming */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
}
```

## State Management

### Local State

```typescript
// ✅ Good - Use useState for simple local state
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState<FormData>(initialData);

// ✅ Good - Use useReducer for complex state
interface State {
  data: Provider[];
  loading: boolean;
  error: string | null;
  filters: FilterState;
}

type Action = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Provider[] }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'SET_FILTER'; payload: Partial<FilterState> };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    default:
      return state;
  }
};
```

### Server State with React Query

```typescript
// ✅ Good - Use React Query for server state
const useProviders = (params?: GetProvidersParams) => {
  return useQuery({
    queryKey: ['providers', params],
    queryFn: () => ProviderService.getProviders(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// ✅ Good - Optimistic updates
const useUpdateProvider = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProviderRequest }) =>
      ProviderService.updateProvider(id, data),
    
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['providers'] });
      
      const previousProviders = queryClient.getQueryData(['providers']);
      
      queryClient.setQueryData(['providers'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((provider: Provider) =>
            provider.id === id ? { ...provider, ...data } : provider
          ),
        };
      });
      
      return { previousProviders };
    },
    
    onError: (error, variables, context) => {
      if (context?.previousProviders) {
        queryClient.setQueryData(['providers'], context.previousProviders);
      }
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });
};
```

## Error Handling

### Error Boundaries

```typescript
// ✅ Good - Comprehensive error boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ComponentType<{ error: Error }> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo);
    
    if (import.meta.env.PROD) {
      // Send to error tracking service
      Sentry.captureException(error, { extra: errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
// ✅ Good - Structured error handling
export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, any>;

  constructor(error: any) {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    super(message);
    
    this.name = 'ApiError';
    this.status = error.response?.status || 500;
    this.code = error.response?.data?.code || 'UNKNOWN_ERROR';
    this.details = error.response?.data?.details;
  }

  isNetworkError(): boolean {
    return !this.status || this.status === 0;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

// ✅ Good - Error handling in components
const ProviderList = () => {
  const { data, error, isLoading } = useProviders();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <ErrorMessage
        title="Failed to load providers"
        message={error instanceof ApiError ? error.message : 'An unexpected error occurred'}
        onRetry={() => queryClient.invalidateQueries(['providers'])}
      />
    );
  }
  
  return <div>{/* Render providers */}</div>;
};
```

## Performance Guidelines

### Memoization

```typescript
// ✅ Good - Memoize expensive calculations
const ExpensiveComponent = ({ items, filter }) => {
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);
  
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredItems]);
  
  return (
    <div>
      {sortedItems.map(item => (
        <ItemComponent key={item.id} item={item} />
      ))}
    </div>
  );
};

// ✅ Good - Memoize callbacks
const ParentComponent = ({ onItemSelect }) => {
  const [selectedId, setSelectedId] = useState(null);
  
  const handleSelect = useCallback((item) => {
    setSelectedId(item.id);
    onItemSelect?.(item);
  }, [onItemSelect]);
  
  return <ChildComponent onSelect={handleSelect} />;
};
```

### Code Splitting

```typescript
// ✅ Good - Lazy load heavy components
const ProviderDetail = lazy(() => import('./ProviderDetail'));
const MonitoringDashboard = lazy(() => import('./MonitoringDashboard'));

const App = () => (
  <Router>
    <Routes>
      <Route path="/providers/:id" element={
        <Suspense fallback={<LoadingSpinner />}>
          <ProviderDetail />
        </Suspense>
      } />
      <Route path="/monitoring" element={
        <Suspense fallback={<LoadingSpinner />}>
          <MonitoringDashboard />
        </Suspense>
      } />
    </Routes>
  </Router>
);
```

## Accessibility Guidelines

### Semantic HTML

```typescript
// ✅ Good - Use semantic HTML elements
const Navigation = () => (
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/providers">Providers</a></li>
      <li><a href="/monitoring">Monitoring</a></li>
      <li><a href="/settings">Settings</a></li>
    </ul>
  </nav>
);

const Article = ({ title, content }) => (
  <article>
    <header>
      <h1>{title}</h1>
    </header>
    <main>
      {content}
    </main>
  </article>
);
```

### ARIA Labels and Roles

```typescript
// ✅ Good - Proper ARIA usage
const SearchInput = ({ onSearch }) => (
  <div role="search">
    <label htmlFor="search-input" className="sr-only">
      Search providers
    </label>
    <input
      id="search-input"
      type="search"
      placeholder="Search providers..."
      aria-describedby="search-help"
      onChange={(e) => onSearch(e.target.value)}
    />
    <div id="search-help" className="sr-only">
      Enter keywords to search through provider names and descriptions
    </div>
  </div>
);

// ✅ Good - Button with proper accessibility
const DeleteButton = ({ onDelete, itemName }) => (
  <button
    onClick={onDelete}
    aria-label={`Delete ${itemName}`}
    className="text-destructive hover:text-destructive/80"
  >
    <Trash2 className="h-4 w-4" />
  </button>
);
```

### Keyboard Navigation

```typescript
// ✅ Good - Keyboard navigation support
const DropdownMenu = ({ items, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(items[focusedIndex]);
        setIsOpen(false);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };
  
  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Menu implementation */}
    </div>
  );
};
```

## Testing Guidelines

### Unit Tests

```typescript
// ✅ Good - Comprehensive component testing
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProviderForm } from './ProviderForm';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ProviderForm', () => {
  it('should render form fields correctly', () => {
    render(<ProviderForm onSubmit={jest.fn()} />, { wrapper: createWrapper() });
    
    expect(screen.getByLabelText(/provider name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create provider/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ProviderForm onSubmit={onSubmit} />, { wrapper: createWrapper() });
    
    const submitButton = screen.getByRole('button', { name: /create provider/i });
    await user.click(submitButton);
    
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ProviderForm onSubmit={onSubmit} />, { wrapper: createWrapper() });
    
    await user.type(screen.getByLabelText(/provider name/i), 'Test Provider');
    await user.selectOptions(screen.getByLabelText(/provider type/i), 'http-sdk');
    await user.click(screen.getByRole('button', { name: /create provider/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test Provider',
        type: 'http-sdk',
        // ... other expected data
      });
    });
  });
});
```

### Integration Tests

```typescript
// ✅ Good - API integration testing
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { renderHook, waitFor } from '@testing-library/react';
import { useProviders } from './use-providers';

const server = setupServer(
  rest.get('/api/v1/admin/providers', (req, res, ctx) => {
    return res(ctx.json({
      results: [
        { id: '1', name: 'Test Provider', type: 'http-sdk' },
      ],
      totalResults: 1,
      page: 1,
      totalPages: 1,
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useProviders', () => {
  it('should fetch providers successfully', async () => {
    const { result } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.results).toHaveLength(1);
    expect(result.current.data?.results[0].name).toBe('Test Provider');
  });
});
```

## Documentation Standards

### Component Documentation

```typescript
/**
 * ProviderForm component for creating and editing AI providers
 * 
 * @example
 * ```tsx
 * <ProviderForm
 *   initialData={provider}
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 * />
 * ```
 */
interface ProviderFormProps {
  /** Initial data for editing existing provider */
  initialData?: Provider;
  /** Callback fired when form is submitted with valid data */
  onSubmit: (data: ProviderFormData) => void;
  /** Callback fired when user cancels the form */
  onCancel: () => void;
  /** Whether the form is in submitting state */
  isSubmitting?: boolean;
}

/**
 * Form component for creating and editing AI providers.
 * Supports all provider types with dynamic configuration fields.
 */
export const ProviderForm: React.FC<ProviderFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  // Implementation
};
```

### Hook Documentation

```typescript
/**
 * Custom hook for managing provider data with React Query
 * 
 * @param params - Optional query parameters for filtering providers
 * @returns Query result with providers data, loading state, and error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useProviders({
 *   page: 1,
 *   limit: 10,
 *   type: 'http-sdk'
 * });
 * ```
 */
export const useProviders = (params?: GetProvidersParams) => {
  return useQuery({
    queryKey: ['providers', params],
    queryFn: () => ProviderService.getProviders(params),
    staleTime: 5 * 60 * 1000,
  });
};
```

This code style guide should be followed consistently across the entire codebase to maintain high code quality and developer experience.