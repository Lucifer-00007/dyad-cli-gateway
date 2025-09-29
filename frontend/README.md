# Dyad CLI Gateway Admin UI

A comprehensive React-based admin interface for managing the Dyad CLI Gateway system. This application provides operators with a modern, accessible web interface to manage AI providers, monitor system health, configure API keys, and test provider integrations.

## Overview

The Admin UI is built with modern web technologies and follows best practices for accessibility, performance, and maintainability. It integrates seamlessly with the Dyad CLI Gateway backend API and provides real-time monitoring capabilities.

### Key Features

- **Provider Management**: Create, edit, and manage AI providers with dynamic adapter configurations
- **Real-time Monitoring**: System health dashboard with live metrics and performance tracking
- **API Key Management**: Secure API key creation, management, and usage analytics
- **Chat Playground**: Interactive testing interface with streaming support
- **Advanced Features**: Bulk operations, virtual scrolling, data export, and feature flags
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation and screen reader support
- **Performance**: Optimized for large datasets with virtual scrolling and efficient caching
- **Security**: Comprehensive input validation, CSRF protection, and secure authentication

### Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5 with SWC plugin
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React Context for client state
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest + React Testing Library + Playwright
- **Monitoring**: Sentry integration with Web Vitals tracking

## Quick Start

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm**, **pnpm**, or **bun** package manager
- **Backend API** running (see backend documentation)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/dyad-cli-gateway.git
cd dyad-cli-gateway/frontend

# Install dependencies (choose your preferred package manager)
npm install
# or
pnpm install
# or
bun install

# Set up environment variables
cp .env.example .env.development
# Edit .env.development with your backend API URL

# Start development server
npm run dev
# or
pnpm dev
# or
bun dev
```

Open your browser to `http://localhost:8080`

### Environment Configuration

Create a `.env.development` file with the following variables:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Environment
VITE_ENVIRONMENT=development

# Feature Flags
VITE_FEATURE_FLAGS_ENABLED=true

# Debug Settings
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug

# Security (relaxed for development)
VITE_CSRF_ENABLED=false
VITE_SECURE_COOKIES=false
```

## Available Scripts

### Development
- `dev` — Start Vite dev server with hot reload
- `build` — Production build with optimizations
- `build:dev` — Development build for debugging
- `build:staging` — Staging build with staging configuration
- `build:analyze` — Build with bundle analysis
- `preview` — Preview production build locally

### Code Quality
- `lint` — Run ESLint across the project
- `lint:fix` — Auto-fix ESLint issues
- `format` — Format all files with Prettier
- `format:check` — Check Prettier formatting
- `type-check` — Run TypeScript type checking

### Testing
- `test` — Run unit tests in watch mode
- `test:run` — Run tests once
- `test:ui` — Run tests with UI interface
- `test:coverage` — Run tests with coverage report
- `test:a11y` — Run accessibility tests
- `test:e2e` — Run end-to-end tests with Playwright
- `test:all` — Run all test suites

### Analysis
- `build:analyze` — Analyze bundle size and dependencies

## Project Structure

The project follows a feature-based architecture with clear separation of concerns:

```
frontend/
├── public/                     # Static assets
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Base UI primitives (shadcn/ui)
│   │   ├── layout/           # Layout components
│   │   ├── providers/        # Provider management components
│   │   └── common/           # Shared components
│   ├── features/             # Feature-specific modules
│   │   ├── providers/        # Provider management
│   │   ├── monitoring/       # System monitoring
│   │   ├── api-keys/         # API key management
│   │   └── chat-playground/  # Interactive testing
│   ├── hooks/                # Custom React hooks
│   │   ├── api/              # API-related hooks
│   │   └── ui/               # UI-related hooks
│   ├── services/             # API services and integrations
│   ├── types/                # TypeScript type definitions
│   ├── lib/                  # Utility libraries and configurations
│   ├── constants/            # Application constants
│   └── test/                 # Test utilities and setup
├── docs/                     # Documentation
│   ├── API_INTEGRATION_GUIDE.md
│   ├── DEVELOPMENT_SETUP.md
│   ├── CODE_STYLE_GUIDE.md
│   ├── CONTRIBUTING.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── TROUBLESHOOTING.md
└── README.md
```

## Core Features

### Provider Management
- **Dynamic Configuration**: Support for spawn-cli, http-sdk, proxy, and local adapter types
- **Model Mapping**: Configure dyad-to-adapter model mappings with validation
- **Bulk Operations**: Manage multiple providers simultaneously with progress tracking
- **Testing Interface**: Built-in provider testing with request/response inspection

### System Monitoring
- **Real-time Dashboard**: Live system health and performance metrics
- **Provider Health**: Individual provider status monitoring with alerts
- **Logs Viewer**: Searchable, filterable log viewing with real-time streaming
- **Performance Analytics**: Request/response time tracking and error rate monitoring

### API Key Management
- **Secure Generation**: Cryptographically secure API key generation
- **Permission Control**: Fine-grained access control and rate limiting
- **Usage Analytics**: Detailed usage statistics and monitoring
- **Audit Logging**: Complete audit trail for security compliance

### Chat Playground
- **Interactive Testing**: Test providers with real chat interactions
- **Streaming Support**: Real-time streaming responses with cancellation
- **Request Inspector**: Detailed request/response analysis and debugging
- **Conversation Management**: Save, load, and export chat sessions

### Advanced Features
- **Feature Flags**: Dynamic feature toggling with rollout control
- **Virtual Scrolling**: Handle large datasets without performance impact
- **Data Export**: Export data in multiple formats (CSV, JSON, Excel)
- **Accessibility**: Full WCAG 2.1 AA compliance with keyboard navigation
- **PWA Support**: Offline functionality and installable web app

## Development

### Getting Started

1. **Read the documentation**: Start with [Development Setup Guide](./docs/DEVELOPMENT_SETUP.md)
2. **Follow code standards**: Review [Code Style Guide](./docs/CODE_STYLE_GUIDE.md)
3. **Understand the API**: Check [API Integration Guide](./docs/API_INTEGRATION_GUIDE.md)
4. **Contributing**: See [Contributing Guidelines](./docs/CONTRIBUTING.md)

### Development Workflow

```bash
# Start development with backend integration
npm run dev

# Run tests during development
npm run test

# Check code quality
npm run lint && npm run type-check

# Build for production
npm run build && npm run preview
```

### Testing

The project includes comprehensive testing:

```bash
# Unit tests with React Testing Library
npm run test:run

# Accessibility testing with axe-core
npm run test:a11y

# End-to-end testing with Playwright
npm run test:e2e

# Coverage reporting
npm run test:coverage
```

## Deployment

The application can be deployed to various platforms:

- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **Cloud Platforms**: AWS S3+CloudFront, Google Cloud Storage, Azure Static Web Apps
- **Container Deployment**: Docker with Nginx, Kubernetes
- **CDN Integration**: CloudFlare, AWS CloudFront, Google Cloud CDN

See the [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

## Documentation

- **[Development Setup](./docs/DEVELOPMENT_SETUP.md)** - Complete development environment setup
- **[API Integration Guide](./docs/API_INTEGRATION_GUIDE.md)** - Backend API integration and usage
- **[Code Style Guide](./docs/CODE_STYLE_GUIDE.md)** - Coding standards and best practices
- **[Contributing Guidelines](./docs/CONTRIBUTING.md)** - How to contribute to the project
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Architecture

The application follows modern React patterns:

- **Component-based Architecture**: Modular, reusable components
- **Feature-based Organization**: Code organized by business features
- **Type-safe Development**: Strict TypeScript with comprehensive type definitions
- **Performance Optimization**: Code splitting, lazy loading, and efficient caching
- **Accessibility First**: Built with accessibility as a core requirement
- **Security Focused**: Input validation, CSRF protection, and secure authentication

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: iOS Safari 14+, Chrome Mobile 90+
- **Accessibility**: Screen readers, keyboard navigation, high contrast mode
- **Progressive Enhancement**: Graceful degradation for older browsers

## Performance

- **Bundle Size**: Optimized with code splitting and tree shaking
- **Core Web Vitals**: Excellent scores for LCP, FID, and CLS
- **Caching Strategy**: Efficient caching with service workers
- **Virtual Scrolling**: Handle thousands of items without performance impact
- **Real-time Updates**: Efficient WebSocket integration with fallback polling

## Security

- **Input Validation**: Comprehensive validation with Zod schemas
- **CSRF Protection**: Built-in CSRF token handling
- **Content Security Policy**: Strict CSP headers for XSS prevention
- **Secure Authentication**: JWT tokens with automatic refresh
- **Audit Logging**: Complete audit trail for security compliance

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./docs/CONTRIBUTING.md) for details on:

- Development setup and workflow
- Code standards and review process
- Testing requirements
- Documentation standards
- Issue reporting and feature requests

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Support

- **Documentation**: Check the [docs](./docs/) directory for comprehensive guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and help
- **Troubleshooting**: See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for common issues
