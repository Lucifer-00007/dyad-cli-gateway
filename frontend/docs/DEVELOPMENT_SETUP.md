# Development Setup Guide

This guide will help you set up a complete development environment for the Dyad CLI Gateway Admin UI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Testing Setup](#testing-setup)
- [IDE Configuration](#ide-configuration)
- [Debugging Setup](#debugging-setup)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version
   
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **Package Manager**
   - **npm** (comes with Node.js)
   - **pnpm** (recommended for faster installs)
   - **bun** (fastest option)
   
   ```bash
   # Install pnpm
   npm install -g pnpm
   
   # Or install bun
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Git**
   ```bash
   # Check version
   git --version
   
   # Configure git
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

### Recommended Tools

1. **VS Code** with extensions:
   - TypeScript and JavaScript Language Features
   - ES7+ React/Redux/React-Native snippets
   - Tailwind CSS IntelliSense
   - ESLint
   - Prettier
   - Auto Rename Tag
   - Bracket Pair Colorizer

2. **Browser Extensions**:
   - React Developer Tools
   - Redux DevTools (if using Redux)
   - Axe DevTools (accessibility testing)

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/dyad-cli-gateway.git
cd dyad-cli-gateway/frontend

# Or if working with existing repo
cd path/to/dyad-cli-gateway/frontend
```

### 2. Environment Variables

Create environment files:

```bash
# Copy example environment file
cp .env.example .env.development
cp .env.example .env.production
```

#### Development Environment (`.env.development`)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Environment
VITE_ENVIRONMENT=development
NODE_ENV=development

# Feature Flags
VITE_FEATURE_FLAGS_ENABLED=true
VITE_FEATURE_FLAGS_ENDPOINT=/api/v1/feature-flags

# Monitoring
VITE_SENTRY_DSN=
VITE_PERFORMANCE_MONITORING_ENABLED=true
VITE_PERFORMANCE_SAMPLE_RATE=1.0

# Debug Settings
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug

# Security
VITE_CSRF_ENABLED=true
VITE_SECURE_COOKIES=false

# PWA
VITE_PWA_ENABLED=false
```

#### Production Environment (`.env.production`)

```bash
# API Configuration
VITE_API_BASE_URL=https://api.dyad-cli-gateway.com
VITE_WS_BASE_URL=wss://api.dyad-cli-gateway.com

# Environment
VITE_ENVIRONMENT=production
NODE_ENV=production

# Feature Flags
VITE_FEATURE_FLAGS_ENABLED=true
VITE_FEATURE_FLAGS_ENDPOINT=/api/v1/feature-flags

# Monitoring
VITE_SENTRY_DSN=your-production-sentry-dsn
VITE_PERFORMANCE_MONITORING_ENABLED=true
VITE_PERFORMANCE_SAMPLE_RATE=0.1

# Debug Settings
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error

# Security
VITE_CSRF_ENABLED=true
VITE_SECURE_COOKIES=true

# PWA
VITE_PWA_ENABLED=true
```

## Installation

### 1. Install Dependencies

```bash
# Using npm
npm install

# Using pnpm (recommended)
pnpm install

# Using bun (fastest)
bun install
```

### 2. Verify Installation

```bash
# Check if all dependencies are installed
npm ls

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## Configuration

### 1. TypeScript Configuration

The project uses strict TypeScript configuration. Key settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 2. Vite Configuration

Key Vite settings in `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
```

### 3. Tailwind Configuration

Tailwind CSS is configured in `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // ... other colors
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

## Development Workflow

### 1. Start Development Server

```bash
# Start the development server
npm run dev

# Or with specific port
npm run dev -- --port 3001

# Open in browser
open http://localhost:8080
```

### 2. Backend Integration

Ensure the backend is running:

```bash
# In a separate terminal, start the backend
cd ../backend
npm run dev

# Verify backend is running
curl http://localhost:3000/api/v1/system/health
```

### 3. Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format with Prettier
npm run format:check    # Check Prettier formatting
npm run type-check      # TypeScript type checking

# Testing
npm run test            # Run unit tests
npm run test:run        # Run tests once
npm run test:ui         # Run tests with UI
npm run test:coverage   # Run tests with coverage
npm run test:a11y       # Run accessibility tests
npm run test:e2e        # Run end-to-end tests

# Analysis
npm run build:analyze   # Analyze bundle size
```

### 4. Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature-name
```

### 5. Code Style Guidelines

#### File Naming Conventions

```
components/
├── ui/
│   ├── button.tsx          # kebab-case for UI components
│   └── data-table.tsx
├── providers/
│   ├── ProviderForm.tsx    # PascalCase for feature components
│   └── ProviderList.tsx
└── layout/
    └── MainLayout.tsx

hooks/
├── use-providers.ts        # kebab-case with use- prefix
└── use-auth.ts

services/
├── api-client.ts          # kebab-case
└── providers.ts

types/
├── api.ts                 # kebab-case
└── ui.ts
```

#### Import Organization

```typescript
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// 2. Internal modules (absolute imports)
import { Button } from '@/components/ui/button';
import { useProviders } from '@/hooks/api/use-providers';
import { Provider } from '@/types/api';

// 3. Relative imports
import './component.css';
```

#### Component Structure

```typescript
// Component props interface
interface ComponentProps {
  title: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

// Component implementation
export const Component: React.FC<ComponentProps> = ({
  title,
  onAction,
  children,
}) => {
  // Hooks
  const [state, setState] = useState(false);
  const { data, isLoading } = useQuery({...});

  // Event handlers
  const handleClick = () => {
    onAction?.();
  };

  // Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // Early returns
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Main render
  return (
    <div className="component-container">
      <h1>{title}</h1>
      {children}
      <Button onClick={handleClick}>Action</Button>
    </div>
  );
};

// Default export
export default Component;
```

## Testing Setup

### 1. Unit Testing with Vitest

```bash
# Install testing dependencies (already included)
npm install -D vitest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 2. Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3. Test Setup File

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
```

### 4. E2E Testing with Playwright

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e
```

## IDE Configuration

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### VS Code Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-playwright.playwright"
  ]
}
```

### VS Code Tasks

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "isBackground": true
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "group": "test"
    },
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "group": "build"
    }
  ]
}
```

## Debugging Setup

### 1. Browser DevTools

Enable React DevTools:

```typescript
// src/main.tsx
if (import.meta.env.DEV) {
  // Enable React DevTools
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
}
```

### 2. VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "request": "launch",
      "type": "chrome",
      "url": "http://localhost:8080",
      "webRoot": "${workspaceFolder}/src",
      "sourceMapPathOverrides": {
        "webpack:///src/*": "${webRoot}/*"
      }
    }
  ]
}
```

### 3. Debug Utilities

Create debug utilities in `src/lib/debug.ts`:

```typescript
export const debugLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${message}`, data);
  }
};

export const debugError = (message: string, error?: any) => {
  if (import.meta.env.DEV) {
    console.error(`[ERROR] ${message}`, error);
  }
};

export const debugPerformance = (label: string, fn: () => void) => {
  if (import.meta.env.DEV) {
    console.time(label);
    fn();
    console.timeEnd(label);
  } else {
    fn();
  }
};
```

## Performance Optimization

### 1. Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# This will generate a report showing:
# - Bundle size breakdown
# - Largest dependencies
# - Code splitting effectiveness
```

### 2. Development Performance

```typescript
// Enable React Strict Mode for development
// src/main.tsx
import { StrictMode } from 'react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 3. Memory Leak Detection

```typescript
// Add to development tools
if (import.meta.env.DEV) {
  // Monitor memory usage
  setInterval(() => {
    if (performance.memory) {
      console.log('Memory usage:', {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
      });
    }
  }, 30000);
}
```

## Troubleshooting

### Common Development Issues

1. **Port already in use**
   ```bash
   # Kill process on port 8080
   lsof -ti:8080 | xargs kill -9
   
   # Or use different port
   npm run dev -- --port 3001
   ```

2. **Module resolution errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **TypeScript errors**
   ```bash
   # Restart TypeScript server in VS Code
   Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
   
   # Check TypeScript configuration
   npx tsc --showConfig
   ```

4. **Hot reload not working**
   ```bash
   # Clear Vite cache
   rm -rf node_modules/.vite
   
   # Restart development server
   npm run dev
   ```

### Performance Issues

1. **Slow startup**
   - Check for large dependencies
   - Use `npm run build:analyze` to identify issues
   - Consider lazy loading heavy components

2. **Memory leaks**
   - Use React DevTools Profiler
   - Check for uncleared intervals/timeouts
   - Monitor component unmounting

### Getting Help

1. **Check the troubleshooting guide**: `docs/TROUBLESHOOTING.md`
2. **Enable debug mode**: `localStorage.setItem('dyad-debug', 'true')`
3. **Check browser console** for errors
4. **Verify backend connectivity**
5. **Test with minimal configuration**

## Next Steps

After completing the setup:

1. **Explore the codebase**: Start with `src/App.tsx` and `src/main.tsx`
2. **Run the test suite**: `npm run test:all`
3. **Check code quality**: `npm run lint && npm run type-check`
4. **Build for production**: `npm run build`
5. **Read the API integration guide**: `docs/API_INTEGRATION_GUIDE.md`

## Development Best Practices

1. **Always run tests** before committing
2. **Use TypeScript strictly** - avoid `any` types
3. **Follow the component structure** guidelines
4. **Write meaningful commit messages**
5. **Keep components small and focused**
6. **Use proper error boundaries**
7. **Implement proper loading states**
8. **Test accessibility** with screen readers
9. **Monitor performance** during development
10. **Document complex logic** with comments

This setup guide should get you up and running with a fully functional development environment. If you encounter any issues, refer to the troubleshooting section or the dedicated troubleshooting guide.