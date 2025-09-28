# Frontend Testing Suite

This directory contains a comprehensive testing suite for the Dyad CLI Gateway frontend admin UI.

## Test Structure

### Unit Tests
- **`infrastructure.test.tsx`** - Testing infrastructure verification
- **`basic-components.test.tsx`** - Tests for existing UI components
- **`advanced-features.test.tsx`** - Tests for advanced features and optimizations
- **`security.test.tsx`** - Security features test suite
- **`accessibility.test.tsx`** - Accessibility tests with axe-core integration
- **`performance.test.tsx`** - Performance tests for large datasets and rendering

### Integration Tests
- **`services/__tests__/api-services.test.ts`** - API services and React Query hooks integration tests

### End-to-End Tests
- **`e2e/provider-management.spec.ts`** - Provider management workflows
- **`e2e/chat-playground.spec.ts`** - Chat playground functionality
- **`e2e/global-setup.ts`** - E2E test setup
- **`e2e/global-teardown.ts`** - E2E test cleanup

### Component Tests
- **`components/__tests__/layout.test.tsx`** - Layout components
- **`components/__tests__/ui-components.test.tsx`** - UI components
- **`components/providers/__tests__/provider-components.test.tsx`** - Provider-specific components

## Test Configuration

### Vitest Configuration
- **Environment**: jsdom
- **Setup**: `./src/test/setup.ts`
- **Coverage**: v8 provider with 80% thresholds
- **Globals**: Enabled for describe, it, expect

### Playwright Configuration
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:8080
- **Reporters**: HTML, JSON, JUnit
- **Features**: Screenshots, videos, traces on failure

### Testing Libraries
- **@testing-library/react** - Component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **@testing-library/jest-dom** - Custom Jest matchers
- **jest-axe** - Accessibility testing
- **@playwright/test** - End-to-end testing
- **msw** - API mocking for integration tests

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests
```bash
npm run test:run
```

### Accessibility Tests
```bash
npm run test:a11y
```

### Performance Tests
```bash
npm run test:performance
```

### End-to-End Tests
```bash
npm run test:e2e
npm run test:e2e:ui      # With UI
npm run test:e2e:headed  # With browser visible
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Categories

### 1. Unit Tests
- Component rendering and behavior
- Hook functionality
- Utility functions
- Form validation
- State management

### 2. Integration Tests
- API service integration
- React Query hooks
- Component interactions
- Data flow testing

### 3. Accessibility Tests
- WCAG compliance
- Screen reader compatibility
- Keyboard navigation
- Color contrast
- Focus management

### 4. Performance Tests
- Large dataset handling
- Virtual scrolling
- Component re-render optimization
- Memory leak detection
- Bulk operations

### 5. End-to-End Tests
- Complete user workflows
- Cross-browser compatibility
- Mobile responsiveness
- Real API integration
- Error scenarios

## Test Utilities

### Test Wrapper
```typescript
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
```

### Mock Data Generators
```typescript
const generateProviders = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    _id: `provider-${i}`,
    name: `Provider ${i}`,
    // ... other properties
  }));
```

### Performance Measurement
```typescript
const measureRenderTime = (renderFn: () => void): number => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};
```

## Mocking Strategy

### API Mocking (MSW)
- Mock server setup for integration tests
- Realistic API responses
- Error scenario simulation
- Network delay simulation

### DOM API Mocking
- localStorage/sessionStorage
- crypto.getRandomValues
- ResizeObserver/IntersectionObserver
- matchMedia
- URL.createObjectURL

### Component Mocking
- Third-party libraries
- Complex components for unit tests
- External dependencies

## Coverage Targets

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## CI/CD Integration

### GitHub Actions Workflow
- Unit tests on every PR
- E2E tests on main branch
- Accessibility audits
- Performance monitoring
- Security scanning

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No accessibility violations
- Performance budgets respected

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused and isolated

### Accessibility Testing
- Test with screen readers in mind
- Verify keyboard navigation
- Check color contrast
- Validate ARIA attributes

### Performance Testing
- Set realistic performance budgets
- Test with large datasets
- Monitor memory usage
- Measure render times

### E2E Testing
- Test critical user paths
- Use page object pattern
- Handle async operations properly
- Test error scenarios

## Troubleshooting

### Common Issues
1. **Tests timing out**: Increase timeout or use proper async/await
2. **DOM not found**: Ensure proper test setup and cleanup
3. **Mock not working**: Check mock implementation and scope
4. **Accessibility failures**: Review ARIA attributes and semantic HTML

### Debug Tips
- Use `screen.debug()` to see rendered DOM
- Add `--reporter=verbose` for detailed output
- Use browser dev tools in headed E2E tests
- Check network tab for API calls

## Contributing

When adding new tests:
1. Follow existing patterns and conventions
2. Add appropriate test categories
3. Update this README if needed
4. Ensure tests are deterministic
5. Add proper error handling
6. Include accessibility considerations