# Pages

This folder contains page-level components that represent different routes in the application.

## Structure

- Each page component should be a default export
- Use PascalCase for component names
- Keep page-specific logic within the component

## Current Pages

- `Index.tsx` - Home page component
- `NotFound.tsx` - 404 error page with client-side navigation

## Guidelines

- Import constants from `@/constants` instead of hardcoding strings
- Use React Router's `Link` for navigation instead of anchor tags
- Keep pages focused on layout and composition, extract complex logic to hooks
