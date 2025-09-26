# Hooks

This folder contains custom React hooks for shared stateful logic.

## Current Hooks

- `useTheme.ts` - Theme management with localStorage persistence and system preference detection

## Guidelines

- Follow the `use` prefix naming convention
- Keep hooks focused on a single responsibility
- Include proper TypeScript types
- Add error handling for side effects (localStorage, API calls)
- Clean up subscriptions and event listeners in useEffect cleanup

## Best Practices

- Use proper dependency arrays in useEffect
- Validate external data (localStorage values, API responses)
- Handle SSR compatibility when accessing browser APIs
