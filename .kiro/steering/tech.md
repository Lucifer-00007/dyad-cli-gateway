# Technology Stack & Build System

## Backend Stack
- **Runtime**: Node.js (>=12.0.0)
- **Framework**: Express.js with middleware ecosystem
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with Passport.js
- **Validation**: Joi schema validation
- **Testing**: Jest with supertest for integration tests
- **Process Management**: PM2 for production
- **Logging**: Winston with Morgan for HTTP logging

### Backend Dependencies
- **Security**: helmet, cors, express-rate-limit, xss-clean, express-mongo-sanitize
- **Utilities**: bcryptjs, moment, validator, compression
- **Development**: nodemon, eslint (Airbnb config), prettier, husky, lint-staged

## Frontend Stack
- **Build Tool**: Vite 5 with SWC plugin
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **UI Components**: Radix UI primitives, Lucide icons
- **Routing**: React Router DOM
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Theme**: next-themes with dark mode support

### Frontend Dependencies
- **Charts**: Recharts for data visualization
- **Notifications**: Sonner for toast notifications
- **Utilities**: clsx, tailwind-merge, class-variance-authority
- **Development**: ESLint, Prettier, TypeScript, Playwright for E2E testing

## Common Commands

### Backend Development
```bash
# Development
cd backend
npm install
npm run dev          # Start with nodemon
npm start           # Production with PM2
npm test            # Run Jest tests
npm run test:watch  # Watch mode
npm run coverage    # Test coverage

# Linting & Formatting
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix ESLint issues
npm run prettier    # Check Prettier formatting
npm run prettier:fix # Auto-format with Prettier

# Docker
npm run docker:dev  # Development container
npm run docker:prod # Production container
npm run docker:test # Test container
```

### Frontend Development
```bash
# Development
cd frontend
npm install
npm run dev         # Start Vite dev server (port 8080)
npm run build       # Production build
npm run preview     # Preview production build

# Quality Checks
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix ESLint issues
npm run format      # Format with Prettier
npm run format:check # Check Prettier formatting
npm run type-check  # TypeScript type checking
```

## Build Configuration
- **Backend**: Uses ecosystem.config.json for PM2 process management
- **Frontend**: Vite config with path aliases (@/ -> ./src/)
- **Testing**: Jest for backend, Vitest/Playwright for frontend
- **Linting**: Shared ESLint config with Airbnb base, Prettier integration
- **Git Hooks**: Husky with lint-staged for pre-commit checks

## Environment Variables
- Backend uses dotenv with .env files
- Frontend uses Vite's import.meta.env with VITE_ prefix
- Docker Compose for orchestrating services
- Separate Dockerfiles for backend and potential gateway service

## Package Managers
- Backend: npm/yarn (yarn.lock present)
- Frontend: npm (package-lock.json present), also supports bun and pnpm