# Components

This folder contains reusable React components.

## Structure

- `ui/` - shadcn/ui primitive components (buttons, inputs, etc.)
- `theme-toggle.tsx` - Theme switching component with dark/light mode

## Guidelines

- Keep components small and focused
- Use TypeScript for prop definitions
- Follow shadcn/ui patterns for consistency
- Extract reusable logic to custom hooks
- Use `@/constants` for any text or configuration values

## UI Components

The `ui/` folder contains shadcn/ui components that provide:

- Consistent design system
- Accessibility features
- Customizable styling with Tailwind CSS
- TypeScript support

## Custom Components

- `ThemeToggle` - Handles theme switching with proper error handling and edge case management
