# Frontend Setup Guide

This guide will walk you through setting up the Dyad CLI Gateway Admin UI frontend for development and production environments.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js** (>=18.0.0) - [Download from nodejs.org](https://nodejs.org/)
- **Package Manager**: npm (comes with Node.js), pnpm, or bun
- **Git** - [Download from git-scm.com](https://git-scm.com/)

### Optional Software
- **VS Code** - Recommended IDE with extensions
- **Docker** - For containerized development
- **Chrome/Firefox** - For development and testing

### System Requirements
- **Memory**: Minimum 4GB RAM (8GB+ recommended for development)
- **Storage**: At least 2GB free space
- **OS**: macOS, Linux, or Windows with WSL2

## Quick Start

### 1. Clone and Navigate
```bash
# If you haven't cloned the repository yet
git clone <repository-url>
cd frontend
```

### 2. Install Dependencies
Choose your preferred package manager:

```bash
# Using npm (default)
npm install

# Using pnpm (faster, recommended)
npm install -g pnpm
pnpm install

# Using bun (fastest)
npm install -g bun
bun install
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env.development

# Edit the environment file with your configuration
nano .env.development  # or use your preferred editor
```

### 4. Start Development Server
```bash
# Using npm
npm run dev

# Using pnpm
pnpm dev

# Using bun
bun dev
```

The application will start at `http://localhost:8080` and automatically open in your browser.

## Detailed Setup Instructions

### Environment Variables Configuration

Create a `.env.development` file with the following configuration:

#### Core Configuration
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Environment
VITE_ENVIRONMENT=development
VITE_APP_NAME="Dyad CLI Gateway Admin"
VITE_APP_VERSION=1.0.0
```

#### Feature Flags
```bash
# Feature Flags
VITE_FEATURE_FLAGS_ENABLED=true
VITE_FEATURE_ADVANCED_MONITORING=true
VITE_FEATURE_BULK_OPERATIONS=true
VITE_FEATURE_CHAT_PLAYGROUND=true
VITE_FEATURE_API_KEY_MANAGEMENT=true
```

#### Development Settings
```bash
# Debug Settings
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_SHOW_DEV_TOOLS=true

# Performance
VITE_ENABLE_VIRTUAL_SCROLLING=true
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=300000  # 5 minutes
```

#### Security (Development)
```bash
# Security (relaxed for development)
VITE_CSRF_ENABLED=false
VITE_SECURE_COOKIES=false
VITE_STRICT_CSP=false
```

#### Optional Services
```bash
# Sentry (Error Monitoring)
VITE_SENTRY_DSN=your-sentry-dsn-here
VITE_SENTRY_ENABLED=false

# Analytics
VITE_ANALYTICS_ENABLED=false
VITE_ANALYTICS_ID=your-analytics-id
```

### Package Manager Setup

#### Using npm (Default)
```bash
# Install dependencies
npm install

# Verify installation
npm list --depth=0

# Update dependencies
npm update
```

#### Using pnpm (Recommended)
```bash
# Install pnpm globally
npm install -g pnpm

# Install dependencies
pnpm install

# Verify installation
pnpm list --depth=0

# Update dependencies
pnpm update
```

#### Using bun (Fastest)
```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Verify installation
bun pm ls

# Update dependencies
bun update
```

### Development Tools Setup

#### VS Code Extensions (Recommended)
Install these extensions for the best development experience:

```bash
# Essential extensions
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension ms-vscode.vscode-typescript-next

# React/TypeScript extensions
code --install-extension ms-vscode.vscode-react-refactor
code --install-extension formulahendry.auto-rename-tag
code --install-extension christian-kohler.path-intellisense

# Additional helpful extensions
code --install-extension ms-vscode.vscode-json
code --install-extension bradlc.vscode-tailwindcss
code --install-extension usernamehw.errorlens
```

#### VS Code Settings
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
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Backend Integration Setup

The frontend requires the backend API to be running. Follow these steps:

#### 1. Backend Prerequisites
```bash
# Ensure backend is running
cd ../backend
npm run dev  # Should be running on http://localhost:3000
```

#### 2. API Connection Verification
```bash
# Test API connection
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:00Z"}
```

#### 3. CORS Configuration
Ensure the backend allows frontend origin in `.env`:
```bash
# In backend/.env
GATEWAY_CORS_ORIGIN=http://localhost:8080
```

### Testing Setup

#### Unit Testing with Vitest
```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

#### End-to-End Testing with Playwright
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

#### Accessibility Testing
```bash
# Run accessibility tests
npm run test:a11y

# Run all test suites
npm run test:all
```

## Docker Development Environment

For a containerized development environment:

### Using Docker Compose
```bash
# Start frontend with dependencies
docker-compose -f docker-compose.dev.yml up frontend

# Start in background
docker-compose -f docker-compose.dev.yml up -d frontend

# View logs
docker-compose -f docker-compose.dev.yml logs -f frontend

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Individual Docker Commands
```bash
# Build development image
docker build -f Dockerfile.dev -t dyad-frontend:dev .

# Run container
docker run -d \
  --name dyad-frontend \
  -p 8080:8080 \
  -v $(pwd):/app \
  -v /app/node_modules \
  -e VITE_API_BASE_URL=http://host.docker.internal:3000 \
  dyad-frontend:dev
```

## Production Setup

### Environment Configuration
Create `.env.production`:

```bash
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_BASE_URL=wss://api.yourdomain.com

# Environment
VITE_ENVIRONMENT=production
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error

# Security (Production)
VITE_CSRF_ENABLED=true
VITE_SECURE_COOKIES=true
VITE_STRICT_CSP=true

# Performance
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=600000  # 10 minutes

# Monitoring
VITE_SENTRY_DSN=your-production-sentry-dsn
VITE_SENTRY_ENABLED=true
VITE_ANALYTICS_ENABLED=true
```

### Build for Production
```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# Build with bundle analysis
npm run build:analyze
```

### Production Docker Build
```bash
# Build production image
docker build -f Dockerfile -t dyad-frontend:prod .

# Run production container
docker run -d \
  --name dyad-frontend-prod \
  -p 80:80 \
  dyad-frontend:prod
```

## Verification Steps

### 1. Development Server Check
```bash
# Start development server
npm run dev

# Verify server is running
curl http://localhost:8080

# Check for console errors in browser
```

### 2. API Integration Check
```bash
# Open browser developer tools
# Navigate to Network tab
# Refresh the page
# Verify API calls to backend are successful (200 status)
```

### 3. Component Rendering Check
```bash
# Run component tests
npm run test:run

# Check for TypeScript errors
npm run type-check

# Verify linting passes
npm run lint
```

### 4. Build Verification
```bash
# Test production build
npm run build
npm run preview

# Verify build output
ls -la dist/
```

## Common Issues & Troubleshooting

### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Use Node Version Manager (nvm)
nvm install 18
nvm use 18

# Or use specific version
nvm install 18.19.0
nvm use 18.19.0
```

### Package Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# For pnpm
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Port Already in Use
```bash
# Find process using port 8080
lsof -i :8080

# Kill process if needed
kill -9 <PID>

# Or use different port
npm run dev -- --port 3001
```

### TypeScript Errors
```bash
# Check TypeScript configuration
npm run type-check

# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Build Errors
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Clear build directory
rm -rf dist

# Rebuild
npm run build
```

### API Connection Issues
```bash
# Check backend is running
curl http://localhost:3000/health

# Check CORS configuration in backend
# Verify VITE_API_BASE_URL in .env.development

# Check browser network tab for failed requests
```

### Styling Issues
```bash
# Rebuild Tailwind CSS
npm run build:css

# Check Tailwind configuration
npx tailwindcss --help

# Verify CSS imports in src/index.css
```

## Development Workflow

### 1. Daily Development
```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Start development server
npm run dev

# Run tests in watch mode (separate terminal)
npm run test:watch
```

### 2. Adding New Features
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and test
npm run test
npm run lint:fix
npm run type-check

# Build to verify production compatibility
npm run build

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 3. Code Quality Checks
```bash
# Run all quality checks
npm run lint && npm run type-check && npm run test:run

# Auto-fix issues
npm run lint:fix
npm run format

# Check bundle size
npm run build:analyze
```

## Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
npm run build:analyze

# Check for large dependencies
npm ls --depth=0 | grep -E '\d+\.\d+MB'

# Optimize imports (use tree shaking)
# Import only what you need from libraries
```

### Development Performance
```bash
# Enable fast refresh
# Ensure React Fast Refresh is working in browser dev tools

# Use development build for faster compilation
npm run build:dev

# Monitor memory usage
# Check browser dev tools -> Performance tab
```

### Production Optimization
```bash
# Enable all optimizations
npm run build

# Verify gzip compression
# Check network tab for compressed assets

# Test performance
npm run test:performance
```

## Security Considerations

### Development Security
- Never commit `.env` files with sensitive data
- Use HTTPS in production environment variables
- Validate all user inputs with Zod schemas
- Keep dependencies updated

### Production Security
```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated

# Update packages
npm update
```

## Browser Compatibility

### Supported Browsers
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Testing Compatibility
```bash
# Test in different browsers
npm run test:e2e

# Check for polyfills needed
# Review Vite build output for compatibility warnings
```

## Next Steps

After successful setup:

1. **Explore the Application**: Navigate through different features
2. **Read Documentation**: Review feature-specific documentation
3. **Backend Integration**: Ensure backend API is properly connected
4. **Customize Configuration**: Adjust settings for your environment
5. **Development Workflow**: Set up your preferred development tools
6. **Testing**: Run comprehensive test suites
7. **Deployment**: Follow production deployment guide

## Support

If you encounter issues:

1. Check the [troubleshooting section](#common-issues--troubleshooting)
2. Review application logs in browser console
3. Run diagnostics: `npm run test:all`
4. Check [GitHub Issues](https://github.com/dyad/gateway/issues)
5. Contact support: support@dyad.dev

## Additional Resources

- [Development Setup Guide](./DEVELOPMENT_SETUP.md)
- [API Integration Guide](./API_INTEGRATION_GUIDE.md)
- [Code Style Guide](./CODE_STYLE_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Contributing Guidelines](./CONTRIBUTING.md)