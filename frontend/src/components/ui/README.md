# Shared UI Components

This directory contains reusable UI components built on top of shadcn/ui and Radix UI primitives. These components provide a consistent design system and enhanced functionality for the Dyad Gateway Admin UI.

## Components Overview

### Layout Components

#### MainLayout
The main application layout with responsive sidebar navigation and header.

```tsx
import { MainLayout } from '@/components/layout';

<MainLayout>
  <YourPageContent />
</MainLayout>
```

#### PageHeader
A flexible page header component with breadcrumbs, title, description, and actions.

```tsx
import { PageHeader, PageHeaderActions } from '@/components/layout';

<PageHeader
  title="Page Title"
  description="Page description"
  breadcrumbs={[
    { label: 'Home', href: '/' },
    { label: 'Current Page', isCurrentPage: true }
  ]}
  actions={
    <PageHeaderActions
      primaryAction={{
        label: 'Create',
        onClick: handleCreate,
        icon: Plus
      }}
      secondaryActions={[
        {
          label: 'Settings',
          onClick: handleSettings,
          icon: Settings,
          variant: 'outline'
        }
      ]}
    />
  }
/>
```

### Data Components

#### DataTable
A comprehensive data table with sorting, filtering, pagination, and row actions.

```tsx
import { DataTable, ColumnDef } from '@/components/ui/data-table';

const columns: ColumnDef<YourDataType>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    filterable: true,
    filterOptions: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' }
    ],
    cell: (row) => <Badge>{row.status}</Badge>
  }
];

<DataTable
  data={data}
  columns={columns}
  searchable
  pagination={{ pageSize: 10 }}
  actions={[
    {
      label: 'Edit',
      onClick: handleEdit,
      icon: Edit
    },
    {
      label: 'Delete',
      onClick: handleDelete,
      icon: Trash2,
      variant: 'destructive'
    }
  ]}
/>
```

### Dialog Components

#### ConfirmationDialog
A reusable confirmation dialog for destructive actions.

```tsx
import { useDeleteConfirmation } from '@/components/ui/confirmation-dialog';

const { showDeleteConfirmation, ConfirmationDialog } = useDeleteConfirmation();

const handleDelete = (item) => {
  showDeleteConfirmation(
    `item "${item.name}"`,
    () => {
      // Delete logic here
    },
    {
      description: 'This action cannot be undone.'
    }
  );
};

// In your component JSX
<ConfirmationDialog />
```

### Loading States

#### Loading Components
Various loading state components for different contexts.

```tsx
import { 
  LoadingSpinner, 
  PageLoading, 
  TableSkeleton, 
  CardSkeleton 
} from '@/components/ui/loading-states';

// Inline spinner
<LoadingSpinner size="md" />

// Full page loading
<PageLoading title="Loading data..." />

// Table skeleton
<TableSkeleton rows={5} columns={4} />

// Card skeleton
<CardSkeleton showHeader lines={3} />
```

### Error Handling

#### ErrorBoundary
React error boundaries for graceful error handling.

```tsx
import { ErrorBoundary, RouteErrorBoundary } from '@/components/ui/error-boundary';

// General error boundary
<ErrorBoundary onError={handleError}>
  <YourComponent />
</ErrorBoundary>

// Route-specific error boundary
<RouteErrorBoundary routeName="providers">
  <ProvidersPage />
</RouteErrorBoundary>
```

### Accessibility Components

#### Keyboard Navigation
Components and hooks for accessible keyboard navigation.

```tsx
import { AccessibleList, AccessibleTabs } from '@/components/ui/keyboard-navigation';
import { useKeyboardNavigation, useFocusTrap } from '@/hooks/use-accessibility';

// Accessible list with keyboard navigation
<AccessibleList
  items={items}
  onSelect={handleSelect}
  renderItem={(item, index, { focused }) => (
    <div className={focused ? 'bg-accent' : ''}>
      {item.name}
    </div>
  )}
  orientation="vertical"
/>

// Focus trap hook for modals
const focusTrapRef = useFocusTrap(isModalOpen);
```

## Accessibility Features

All components follow WCAG 2.1 AA guidelines and include:

- **Keyboard Navigation**: Full keyboard support with arrow keys, Enter, Space, Home, End, and Escape
- **Screen Reader Support**: Proper ARIA labels, roles, and live regions
- **Focus Management**: Focus trapping in modals, focus restoration, and visible focus indicators
- **High Contrast**: Support for high contrast mode and custom themes
- **Reduced Motion**: Respects user's motion preferences

## Customization

### Theming
Components use CSS custom properties for theming:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... other theme variables */
}
```

### Styling
Components can be customized using the `className` prop and Tailwind CSS:

```tsx
<DataTable
  className="border-2 border-primary"
  data={data}
  columns={columns}
/>
```

## Performance Considerations

- **Code Splitting**: Components are tree-shakeable and support dynamic imports
- **Virtual Scrolling**: DataTable supports virtual scrolling for large datasets
- **Memoization**: Components use React.memo and useMemo where appropriate
- **Lazy Loading**: Loading states prevent layout shifts during data fetching

## Testing

Components include comprehensive test coverage:

```bash
# Run component tests
npm run test

# Run accessibility tests
npm run test:a11y

# Run visual regression tests
npm run test:visual
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

When adding new components:

1. Follow the existing patterns and naming conventions
2. Include TypeScript types and proper JSDoc comments
3. Add accessibility features (ARIA labels, keyboard navigation)
4. Include loading and error states
5. Write comprehensive tests
6. Update this documentation

## Examples

See the `/pages` directory for complete examples of how these components work together in real applications.