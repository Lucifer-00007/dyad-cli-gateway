# Contributing Guidelines

Thank you for your interest in contributing to the Dyad CLI Gateway Admin UI! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation Requirements](#documentation-requirements)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Node.js 18+** installed
2. **Git** configured with your GitHub account
3. **Code editor** with recommended extensions (see [Development Setup](./DEVELOPMENT_SETUP.md))
4. **Basic understanding** of React, TypeScript, and Tailwind CSS

### Initial Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/dyad-cli-gateway.git
   cd dyad-cli-gateway/frontend
   ```

2. **Set up upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/dyad-cli-gateway.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with appropriate values
   ```

5. **Verify setup**
   ```bash
   npm run dev
   npm run test:run
   npm run lint
   npm run type-check
   ```

## Development Process

### Workflow Overview

1. **Create an issue** or comment on existing issue
2. **Create a feature branch** from `main`
3. **Implement changes** following code standards
4. **Write/update tests** for your changes
5. **Update documentation** as needed
6. **Submit a pull request**
7. **Address review feedback**
8. **Merge after approval**

### Branch Naming Convention

```bash
# Feature branches
feature/provider-bulk-operations
feature/chat-streaming-support
feature/accessibility-improvements

# Bug fix branches
fix/provider-form-validation
fix/memory-leak-in-websocket
fix/dark-mode-theme-issues

# Documentation branches
docs/api-integration-guide
docs/troubleshooting-update

# Chore branches
chore/dependency-updates
chore/eslint-config-update
```

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Format
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# Examples
feat(providers): add bulk delete functionality
fix(auth): resolve token refresh race condition
docs(api): update integration guide with streaming examples
test(components): add accessibility tests for forms
chore(deps): update React to v18.3.0
```

#### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Check linting
npm run lint:fix        # Fix linting issues
npm run format          # Format code
npm run format:check    # Check formatting
npm run type-check      # TypeScript checking

# Testing
npm run test            # Run tests in watch mode
npm run test:run        # Run tests once
npm run test:coverage   # Run with coverage
npm run test:a11y       # Accessibility tests
npm run test:e2e        # End-to-end tests

# Pre-commit checks
npm run pre-commit      # Run all quality checks
```

## Code Standards

### Code Quality Requirements

All contributions must meet these standards:

1. **TypeScript**: Strict typing, no `any` types
2. **ESLint**: No linting errors
3. **Prettier**: Consistent code formatting
4. **Tests**: Adequate test coverage (>80%)
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Performance**: No performance regressions

### Code Review Checklist

Before submitting, ensure your code meets these criteria:

#### Functionality
- [ ] Feature works as intended
- [ ] Edge cases are handled
- [ ] Error states are handled gracefully
- [ ] Loading states are implemented
- [ ] No console errors or warnings

#### Code Quality
- [ ] TypeScript types are properly defined
- [ ] No ESLint errors or warnings
- [ ] Code is properly formatted with Prettier
- [ ] Functions and components are properly documented
- [ ] No unused imports or variables

#### Testing
- [ ] Unit tests cover new functionality
- [ ] Integration tests for API interactions
- [ ] Accessibility tests pass
- [ ] E2E tests for critical user flows
- [ ] Test coverage meets minimum threshold

#### Performance
- [ ] No unnecessary re-renders
- [ ] Proper memoization where needed
- [ ] Lazy loading for heavy components
- [ ] Bundle size impact is acceptable

#### Accessibility
- [ ] Proper semantic HTML
- [ ] ARIA labels and roles
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility
- [ ] Color contrast compliance

#### Documentation
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Component documentation added
- [ ] Changelog entry added

### File Organization

Follow the established file structure:

```
src/
├── components/
│   ├── ui/              # Base UI components
│   ├── layout/          # Layout components
│   └── common/          # Shared components
├── features/            # Feature-specific code
│   └── providers/       # Provider management
├── hooks/               # Custom React hooks
├── services/            # API services
├── types/               # TypeScript definitions
├── lib/                 # Utilities and config
└── test/               # Test utilities
```

## Pull Request Process

### Before Creating a PR

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

2. **Rebase your branch**
   ```bash
   git checkout your-feature-branch
   git rebase main
   ```

3. **Run quality checks**
   ```bash
   npm run pre-commit
   ```

### PR Template

Use this template for your pull request:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)

## Related Issues
Closes #123
Related to #456
```

### PR Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one maintainer reviews
3. **Testing**: Reviewer tests functionality
4. **Approval**: PR approved by maintainer
5. **Merge**: Squash and merge to main branch

### Review Criteria

Reviewers will check:

- **Functionality**: Does it work as intended?
- **Code Quality**: Follows established patterns?
- **Performance**: No negative impact?
- **Security**: No security vulnerabilities?
- **Accessibility**: Meets accessibility standards?
- **Testing**: Adequate test coverage?
- **Documentation**: Properly documented?

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for known solutions
3. **Try the latest version** to see if issue persists
4. **Gather relevant information** (browser, OS, steps to reproduce)

### Issue Types

#### Bug Reports

Use the bug report template:

```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., macOS 12.0]
- Browser: [e.g., Chrome 96.0]
- Node.js: [e.g., 18.17.0]
- Version: [e.g., 1.2.3]

## Additional Context
Screenshots, logs, or other relevant information.
```

#### Feature Requests

Use the feature request template:

```markdown
## Feature Description
Clear description of the proposed feature.

## Problem Statement
What problem does this solve?

## Proposed Solution
Detailed description of the solution.

## Alternatives Considered
Other solutions you've considered.

## Additional Context
Mockups, examples, or other relevant information.
```

### Issue Labels

Common labels used:

- **Type**: `bug`, `feature`, `documentation`, `question`
- **Priority**: `low`, `medium`, `high`, `critical`
- **Status**: `needs-triage`, `in-progress`, `blocked`
- **Area**: `ui`, `api`, `performance`, `accessibility`
- **Difficulty**: `good-first-issue`, `help-wanted`

## Testing Requirements

### Test Coverage

Maintain minimum test coverage:

- **Unit Tests**: >80% coverage
- **Integration Tests**: Critical API interactions
- **E2E Tests**: Main user workflows
- **Accessibility Tests**: All interactive components

### Testing Guidelines

#### Unit Tests

```typescript
// ✅ Good - Comprehensive component testing
describe('ProviderForm', () => {
  it('should render all form fields', () => {
    render(<ProviderForm onSubmit={jest.fn()} />);
    
    expect(screen.getByLabelText(/provider name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider type/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ProviderForm onSubmit={onSubmit} />);
    
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid form data', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ProviderForm onSubmit={onSubmit} />);
    
    await user.type(screen.getByLabelText(/provider name/i), 'Test Provider');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Provider' })
    );
  });
});
```

#### Accessibility Tests

```typescript
// ✅ Good - Accessibility testing
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<ProviderForm onSubmit={jest.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ProviderForm onSubmit={jest.fn()} />);
    
    // Tab through form fields
    await user.tab();
    expect(screen.getByLabelText(/provider name/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/provider type/i)).toHaveFocus();
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:a11y

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## Documentation Requirements

### Documentation Standards

All contributions should include appropriate documentation:

#### Code Documentation

```typescript
/**
 * Custom hook for managing provider form state and validation
 * 
 * @param initialData - Optional initial provider data for editing
 * @returns Form utilities and state management functions
 * 
 * @example
 * ```tsx
 * const { form, handleSubmit, isSubmitting } = useProviderForm(provider);
 * 
 * return (
 *   <form onSubmit={handleSubmit}>
 *     {/* Form fields */}
 *   </form>
 * );
 * ```
 */
export const useProviderForm = (initialData?: Provider) => {
  // Implementation
};
```

#### Component Documentation

```typescript
/**
 * ProviderCard displays provider information in a card layout
 * 
 * @example
 * ```tsx
 * <ProviderCard
 *   provider={provider}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   showActions={true}
 * />
 * ```
 */
interface ProviderCardProps {
  /** Provider data to display */
  provider: Provider;
  /** Callback when edit button is clicked */
  onEdit?: (provider: Provider) => void;
  /** Callback when delete button is clicked */
  onDelete?: (provider: Provider) => void;
  /** Whether to show action buttons */
  showActions?: boolean;
}
```

#### README Updates

Update relevant README sections when:

- Adding new features
- Changing installation process
- Updating dependencies
- Modifying configuration

#### API Documentation

Update API documentation when:

- Adding new endpoints
- Changing request/response formats
- Modifying authentication
- Adding new error codes

### Documentation Files to Update

- `README.md` - Main project documentation
- `docs/API_INTEGRATION_GUIDE.md` - API usage examples
- `docs/DEVELOPMENT_SETUP.md` - Development environment
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- Component JSDoc comments
- Type definitions and interfaces

## Release Process

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Run full test suite** and ensure all tests pass
4. **Build and test** production bundle
5. **Create release PR** with version bump
6. **Tag release** after merge
7. **Deploy to production** (if applicable)
8. **Announce release** in relevant channels

### Changelog Format

```markdown
## [1.2.0] - 2024-01-15

### Added
- Bulk operations for provider management
- Real-time WebSocket updates
- Advanced filtering and search

### Changed
- Improved performance of large data tables
- Updated UI components to latest design system

### Fixed
- Memory leak in WebSocket connections
- Form validation edge cases
- Dark mode theme inconsistencies

### Deprecated
- Legacy API endpoints (will be removed in v2.0)

### Security
- Updated dependencies with security patches
```

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- **Be respectful** and considerate in all interactions
- **Be collaborative** and help others learn
- **Be patient** with newcomers and different skill levels
- **Be constructive** in feedback and criticism
- **Focus on the code**, not the person

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code review and collaboration
- **Documentation**: Guides and API references

### Getting Help

If you need help:

1. **Check documentation** first
2. **Search existing issues** for similar problems
3. **Ask in GitHub Discussions** for general questions
4. **Create an issue** for bugs or feature requests
5. **Join community channels** for real-time help

### Recognition

Contributors are recognized through:

- **Contributor list** in README
- **Release notes** acknowledgments
- **GitHub contributor graphs**
- **Community highlights** in discussions

## Quick Reference

### Common Commands

```bash
# Setup
git clone <fork-url>
cd dyad-cli-gateway/frontend
npm install

# Development
npm run dev
npm run test
npm run lint

# Quality checks
npm run type-check
npm run format:check
npm run test:coverage

# Pre-commit
npm run pre-commit
```

### Useful Links

- [Development Setup Guide](./DEVELOPMENT_SETUP.md)
- [Code Style Guide](./CODE_STYLE_GUIDE.md)
- [API Integration Guide](./API_INTEGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Project README](../README.md)

Thank you for contributing to the Dyad CLI Gateway Admin UI! Your contributions help make this project better for everyone.