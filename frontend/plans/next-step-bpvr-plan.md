# Plan for Improving the Overall Performance of the System

## Notes

- All hardcoded strings moved to `/src/constants/index.ts`
- Dark mode implemented with `useTheme` hook and theme toggle component
- Tailwind CSS configured with class-based dark mode
- Type checking script added to package.json

---

## Task List

### Bugs

- [x] In `src/hooks/useTheme.ts` around lines 5 to 9, the hook currently reads localStorage during initialization and force-casts the value to Theme which breaks SSR and is unsafe; change the initial state to a safe default (e.g., 'system') so no window/localStorage access happens during render, then in a useEffect (which only runs on the client) read localStorage, validate the retrieved string against the allowed Theme values (use a type guard or an allowed-values array) and call setTheme only if valid; this removes the unsafe type assertion and prevents SSR/hydration issues.

- [x] In src/pages/NotFound.tsx around lines 21 to 25, the button uses a plain anchor tag which triggers a full page reload; replace it with React Router's Link for client-side navigation. Import { Link } from "react-router-dom" at the top, then change the Button asChild to wrap a Link with to={APP_CONSTANTS.ROUTES.HOME} (keeping the same children text), ensuring props and styling remain compatible with Button asChild for proper rendering and SPA navigation.

- []
- []
- []

### New features

- [x] `/src/constants` is where all shared constants live. Central place for app-wide constants. Remember to never hard-code any constant string. Check if any any hardcodes value in `./src` then move all of them to `/src/constants/`

- [x] Add a `dark mode` using `shadcn`
  - [x] Tailwind CSS should be used for styling with full dark/light theme support. The configuration
  - [x] Tailwind config (use `class` dark mode & inject CSS var color) must be found in tailwind.config.ts, and global styles in src/index.css.
  - [x] Note: Why `darkMode: 'class'`? It makes manual toggling straightforward (you add/remove `.dark` on `<html>` or `<body>`). Official doc: dark mode variants and class vs media.

- [x] Icons: Lucide React provides modern, customizable icons throughout the application.

- [x] `src/hooks/useTheme.ts` — manages theme (uses localStorage, falls back to `prefers-color-scheme`):

- [x] Add ESLint + Prettier and `npm run type-check` to CI if absent(skip is already present).

- [x] Consider adding error handling for useTheme hook
  - The component assumes useTheme always returns valid theme and setTheme values.
  - Consider adding defensive checks in case the hook returns undefined values or fails.

- [x] Strengthen theme toggle logic for edge cases
  - The current logic assumes theme is always either 'light' or 'dark', but doesn't handle cases where theme might be undefined, null, or have other values (like 'system', 'auto', etc.).

- [x] Consider cleanup and system preference listener optimization.
  - The DOM manipulation logic is sound, but consider these improvements:

  - Memory leak prevention: Add cleanup for system theme changes when the component unmounts or theme changes.

  - Avoid repeated matchMedia calls: The current implementation calls matchMedia on every effect run when theme is 'system'.

- [x] Consider adding error handling and testing.
  - This hook manipulates DOM and localStorage, which can fail in various scenarios (private browsing, storage quota exceeded, etc.).
  - Consider adding error handling and comprehensive testing.

- []
- []
- []
- []

---
