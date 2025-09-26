# Project Structure & Organization

## Repository Layout

This is a monorepo with separate backend and frontend applications, following a clear separation of concerns.

```
/
├── backend/           # Node.js/Express API server
├── frontend/          # React/TypeScript client application  
├── plans/            # Project planning and architecture docs
├── md-docs/          # Additional documentation
└── README.md         # Main project documentation
```

## Backend Structure (`backend/`)

Follows a layered architecture pattern with clear separation between routes, controllers, services, and models.

```
backend/src/
├── app.js                    # Express app configuration
├── index.js                  # Application entry point
├── config/                   # Configuration files
│   ├── config.js            # Environment-based config
│   ├── logger.js            # Winston logger setup
│   ├── morgan.js            # HTTP request logging
│   ├── passport.js          # Authentication strategies
│   ├── roles.js             # Role-based permissions
│   └── tokens.js            # JWT token configuration
├── controllers/             # Request handlers (thin layer)
│   ├── auth.controller.js
│   ├── user.controller.js
│   └── index.js
├── middlewares/             # Express middleware
│   ├── auth.js             # Authentication middleware
│   ├── error.js            # Error handling middleware
│   ├── rateLimiter.js      # Rate limiting
│   └── validate.js         # Request validation
├── models/                  # Mongoose schemas
│   ├── user.model.js
│   ├── token.model.js
│   ├── plugins/            # Reusable model plugins
│   │   ├── paginate.plugin.js
│   │   └── toJSON.plugin.js
│   └── index.js
├── routes/                  # API route definitions
├── services/                # Business logic layer
│   ├── auth.service.js
│   ├── user.service.js
│   ├── email.service.js
│   ├── token.service.js
│   └── index.js
├── utils/                   # Utility functions
│   ├── ApiError.js         # Custom error class
│   ├── catchAsync.js       # Async error wrapper
│   └── pick.js             # Object property picker
└── validations/             # Joi validation schemas
    ├── auth.validation.js
    ├── user.validation.js
    ├── custom.validation.js
    └── index.js
```

### Backend Conventions
- **Controllers**: Thin layer that handles HTTP requests/responses
- **Services**: Contains business logic and database operations
- **Models**: Mongoose schemas with plugins for common functionality
- **Middlewares**: Reusable request processing logic
- **Validations**: Joi schemas for request validation
- **Utils**: Pure utility functions without side effects

## Frontend Structure (`frontend/`)

Modern React application with TypeScript, following component-based architecture.

```
frontend/src/
├── main.tsx                 # Application entry point
├── App.tsx                  # Root component with routing
├── index.css               # Global styles and Tailwind imports
├── components/             # Reusable UI components
│   ├── ui/                 # shadcn/ui primitive components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ... (50+ components)
│   ├── theme-toggle.tsx    # Theme switching component
│   └── README.md
├── pages/                  # Route-level page components
│   ├── Index.tsx          # Home page
│   ├── NotFound.tsx       # 404 page
│   └── README.md
├── hooks/                  # Custom React hooks
│   ├── useTheme.ts        # Theme management
│   ├── use-mobile.tsx     # Mobile detection
│   ├── use-toast.ts       # Toast notifications
│   └── README.md
├── lib/                    # Utility libraries
│   ├── utils.ts           # Common utility functions
│   └── README.md
├── constants/              # Application constants
│   ├── index.ts           # Centralized constants
│   └── README.md
└── vite-env.d.ts          # Vite type definitions
```

### Frontend Conventions
- **Components**: Organized by ui/ (primitives) and feature-specific folders
- **Pages**: Route-level components that compose smaller components
- **Hooks**: Custom React hooks for reusable stateful logic
- **Lib**: Utility functions and configurations
- **Constants**: Centralized application constants
- **TypeScript**: Strict typing throughout the application

## Testing Structure

```
backend/tests/
├── fixtures/               # Test data fixtures
├── integration/           # API endpoint tests
├── unit/                  # Unit tests for individual modules
└── utils/                 # Test utilities and setup

frontend/                  # Frontend tests alongside components
├── src/__tests__/         # Component unit tests
└── playwright/            # E2E tests (when added)
```

## Configuration Files

### Backend Configuration
- `package.json` - Dependencies and scripts
- `ecosystem.config.json` - PM2 process management
- `jest.config.js` - Jest testing configuration
- `.eslintrc.json` - ESLint rules (Airbnb base)
- `.prettierrc.json` - Code formatting rules
- `docker-compose.yml` - Container orchestration

### Frontend Configuration  
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript compiler options
- `eslint.config.js` - ESLint configuration
- `components.json` - shadcn/ui component configuration

## Naming Conventions
- **Files**: kebab-case for configs, PascalCase for React components, camelCase for utilities
- **Directories**: lowercase with hyphens
- **Components**: PascalCase with .tsx extension
- **Hooks**: camelCase starting with "use"
- **Constants**: UPPER_SNAKE_CASE
- **Database Models**: PascalCase with .model.js suffix

## Import/Export Patterns
- Use index.js files for clean imports from directories
- Prefer named exports over default exports for utilities
- Use default exports for React components and main modules
- Organize imports: external libraries, internal modules, relative imports