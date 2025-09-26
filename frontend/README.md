# Vite + React + TypeScript Boilerplate (shadcn/ui)

> A minimal, opinionated Vite + React + TypeScript starter prewired with Tailwind CSS and shadcn/ui components. Use this repository as a base for building modern frontend apps.

## Key Features

- Vite 5, React, TypeScript
- Tailwind CSS & shadcn/ui components with dark mode support
- Radix UI, Lucide icons
- React Router for client-side navigation
- Robust theme system with SSR compatibility
- Centralized constants management
- Preconfigured ESLint, Prettier & TypeScript checking

## Prerequisites

- Node.js 18+
- Bun, npm, or pnpm

## Quick Start

Choose the package manager you prefer.

Using Bun:

```bash
bun install
bun run dev
```

Using npm:

```bash
npm install
npm run dev
```

Using pnpm:

```bash
pnpm install
pnpm dev
```

Open the app at `http://localhost:8080`

## Available Scripts

- `dev` — Start Vite dev server (hot reload)
- `build` — Produce an optimized production build
- `build:dev` — Build with `development` mode (useful for debugging build output)
- `preview` — Preview the production build locally
- `lint` — Run ESLint across the project
- `lint:fix` — Run ESLint with auto-fix
- `format` — Format all files with Prettier
- `format:check` — Check if files are formatted correctly
- `type-check` — Run TypeScript type checking

## Example common flows:

```bash
# npm
npm install && npm run dev

# pnpm
pnpm install && pnpm dev
```

## Project tree

```
/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ bun.lockb
├─ public/
│  ├─ favicon.ico
│  └─ ...
└─ src/
	├─ main.tsx
	├─ App.tsx
	├─ index.css
	├─ constants/
	│  └─ index.ts  (centralized constants)
	├─ pages/
	│  ├─ Index.tsx
	│  └─ NotFound.tsx
	├─ components/
	│  ├─ theme-toggle.tsx
	│  └─ ui/  (shadcn/ui primitives)
	├─ hooks/
	│  └─ useTheme.ts  (theme management)
	└─ lib/
```

## Features

### Dark Mode Support

- Full dark/light theme system with system preference detection
- SSR-compatible theme initialization
- Automatic system preference change detection
- Error handling for localStorage operations
- Theme toggle component with smooth transitions

### Architecture

- Centralized constants in `/src/constants/index.ts`
- Client-side routing with React Router
- Type-safe theme management with proper validation
- Memory leak prevention in theme listeners

## Notes & best practices

- Use `.env` files and `import.meta.env` for environment configuration
- All constants are centralized in `/src/constants/index.ts`
- Theme system supports 'light', 'dark', and 'system' modes
- Code formatting is handled by Prettier with ESLint integration
- Add a `LICENSE` file before publishing
- Add CI for `install` + `npm run lint` + `npm run format:check` + `npm run type-check` + `npm run build`
- Keep component primitives in `src/components/ui/` for reuse

## License

This boilerplate is unlicensed by default. Add a `LICENSE` file if you intend to publish or share this repository with an attached license.

---
