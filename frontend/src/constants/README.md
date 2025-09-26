# Constants

This folder contains all application-wide constants to avoid hardcoded values.

## Structure

- `index.ts` - Main constants file with `APP_CONSTANTS` export

## Current Constants

- `ROUTES` - Application route paths
- `MESSAGES` - User-facing text and error messages

## Guidelines

- Never hardcode strings, numbers, or configuration values in components
- Use `as const` assertion for type safety
- Group related constants under descriptive objects
- Import as `APP_CONSTANTS` from `@/constants`

## Usage

```typescript
import { APP_CONSTANTS } from '@/constants';

// Use routes
<Link to={APP_CONSTANTS.ROUTES.HOME}>

// Use messages
<h1>{APP_CONSTANTS.MESSAGES.WELCOME_TITLE}</h1>
```
