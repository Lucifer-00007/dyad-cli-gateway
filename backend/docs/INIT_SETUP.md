# Backend Setup Guide

This guide will walk you through setting up the Dyad CLI Gateway backend for development and production environments.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js** (>=18.0.0) - [Download from nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** (>=1.22.0)
- **MongoDB** (>=5.0) - [Installation Guide](https://docs.mongodb.com/manual/installation/)
- **Git** - [Download from git-scm.com](https://git-scm.com/)

### Optional Software
- **Redis** (>=6.0) - For caching and enhanced rate limiting
- **Docker** & **Docker Compose** - For containerized development
- **PM2** - For production process management (installed via npm)

### System Requirements
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: At least 1GB free space
- **OS**: macOS, Linux, or Windows with WSL2

## Quick Start

### 1. Clone and Navigate
```bash
# If you haven't cloned the repository yet
git clone <repository-url>
cd backend
```

### 2. Install Dependencies
```bash
# Using npm (recommended)
npm install

# Or using yarn
yarn install
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your configuration
nano .env  # or use your preferred editor
```

### 4. Database Setup
```bash
# Start MongoDB (if not running as a service)
# On macOS with Homebrew:
brew services start mongodb-community

# On Linux with systemd:
sudo systemctl start mongod

# On Windows or manual installation:
mongod --dbpath /path/to/your/db
```

### 5. Start Development Server
```bash
npm run dev
```

The server will start at `http://localhost:3000` with the OpenAI-compatible API available at `/v1/*` endpoints.

## Detailed Setup Instructions

### Environment Variables Configuration

Edit your `.env` file with the following required settings:

#### Core Configuration
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Connection
MONGODB_URL=mongodb://127.0.0.1:27017/dyad-gateway

# JWT Authentication (generate a secure secret)
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_ACCESS_EXPIRATION_MINUTES=60
JWT_REFRESH_EXPIRATION_DAYS=30
```

#### Gateway Configuration
```bash
# Gateway Service
GATEWAY_ENABLED=true
GATEWAY_PORT=3001
GATEWAY_API_PREFIX=/v1
GATEWAY_ADMIN_PREFIX=/admin

# Rate Limiting
GATEWAY_RATE_LIMIT_WINDOW=900000  # 15 minutes
GATEWAY_RATE_LIMIT_MAX=100        # requests per window

# Security
GATEWAY_API_KEY_HEADER=Authorization
GATEWAY_CORS_ORIGIN=*
```

#### Optional Services
```bash
# Redis (for enhanced caching and rate limiting)
REDIS_URL=redis://127.0.0.1:6379

# Email Service (for notifications)
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-email-password
EMAIL_FROM=noreply@yourapp.com
```

### Database Setup Options

#### Option 1: Local MongoDB Installation

**macOS (using Homebrew):**
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify installation
mongosh --eval "db.adminCommand('ismaster')"
```

**Ubuntu/Debian:**
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Option 2: Docker MongoDB
```bash
# Run MongoDB in Docker
docker run -d \
  --name dyad-mongo \
  -p 27017:27017 \
  -v dyad_mongo_data:/data/db \
  mongo:5.0

# Update .env file
MONGODB_URL=mongodb://127.0.0.1:27017/dyad-gateway
```

#### Option 3: MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Update `.env`:
```bash
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/dyad-gateway
```

### Redis Setup (Optional)

Redis enhances performance with caching and advanced rate limiting:

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Docker:**
```bash
docker run -d --name dyad-redis -p 6379:6379 redis:7-alpine
```

### Development Tools Setup

#### Code Quality Tools
The project includes pre-configured linting and formatting:

```bash
# Check code style
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check code formatting
npm run prettier

# Auto-format code
npm run prettier:fix
```

#### Git Hooks (Husky)
Pre-commit hooks are automatically installed with dependencies:

```bash
# Manually install git hooks if needed
npm run prepare
```

### Testing Setup

#### Run Test Suite
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Generate coverage report
npm run coverage
```

#### Test Database
Tests use a separate test database. No additional setup required.

## Docker Development Environment

For a complete containerized development environment:

### Using Docker Compose
```bash
# Start all services (gateway, MongoDB, Redis)
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f gateway

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Individual Docker Commands
```bash
# Build development image
docker build -t dyad-gateway:dev .

# Run with environment variables
docker run -d \
  --name dyad-gateway \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e MONGODB_URL=mongodb://host.docker.internal:27017/dyad-gateway \
  dyad-gateway:dev
```

## Production Setup

### Environment Preparation
```bash
# Set production environment
NODE_ENV=production

# Use production MongoDB URL
MONGODB_URL=mongodb://prod-server:27017/dyad-gateway

# Set secure JWT secret (32+ characters)
JWT_SECRET=your-production-jwt-secret-key-minimum-32-chars

# Configure logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### PM2 Process Management
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
npm run start

# Or directly with PM2
pm2 start ecosystem.config.json

# Monitor processes
pm2 monit

# View logs
pm2 logs dyad-gateway

# Restart application
pm2 restart dyad-gateway
```

### Production Docker Deployment
```bash
# Build production image
docker build -f Dockerfile --target production -t dyad-gateway:prod .

# Run production container
docker-compose -f docker-compose.prod.yml up -d
```

## Verification Steps

### 1. Health Check
```bash
# Basic health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:00Z"}
```

### 2. API Endpoints
```bash
# List available models (requires API key setup)
curl -H "Authorization: Bearer sk-dyad-test-key" \
     http://localhost:3000/v1/models

# Admin health check
curl http://localhost:3000/admin/health
```

### 3. Database Connection
```bash
# Check MongoDB connection
npm run test:db-connection

# Or manually verify
mongosh dyad-gateway --eval "db.stats()"
```

## Common Issues & Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh --eval "db.adminCommand('ping')"
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or use different port in .env
PORT=3001
```

### Permission Issues
```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm

# Clear npm cache
npm cache clean --force
```

### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to package.json scripts
"dev": "cross-env NODE_OPTIONS='--max-old-space-size=4096' nodemon src/index.js"
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

# Run tests before committing
npm test
npm run lint:fix
```

### 2. Adding New Features
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and test
npm test
npm run lint:fix

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 3. Database Migrations
```bash
# Run pending migrations
npm run migrate

# Create new migration
npm run migrate:create -- --name add-new-field

# Rollback migration
npm run migrate:rollback
```

## Security Considerations

### API Key Management
- Generate strong API keys (minimum 32 characters)
- Use different keys for development and production
- Rotate keys regularly
- Store keys securely (environment variables, not in code)

### Database Security
- Use MongoDB authentication in production
- Enable SSL/TLS for database connections
- Regular security updates
- Backup encryption

### Environment Security
```bash
# Set restrictive file permissions for .env
chmod 600 .env

# Never commit .env files
echo ".env" >> .gitignore
```

## Performance Optimization

### Database Optimization
```bash
# Create database indexes
npm run db:index

# Monitor database performance
npm run db:stats
```

### Application Monitoring
```bash
# Enable metrics collection
METRICS_ENABLED=true

# View metrics endpoint
curl http://localhost:3000/metrics
```

## Next Steps

After successful setup:

1. **Configure Providers**: Set up AI providers through the admin API
2. **Create API Keys**: Generate API keys for client applications
3. **Test Integration**: Verify OpenAI-compatible endpoints work
4. **Monitor Performance**: Set up logging and monitoring
5. **Deploy to Production**: Follow production deployment guide

## Support

If you encounter issues:

1. Check the [troubleshooting section](#common-issues--troubleshooting)
2. Review application logs: `npm run logs`
3. Run diagnostics: `npm run test:health`
4. Check [GitHub Issues](https://github.com/dyad/gateway/issues)
5. Contact support: support@dyad.dev

## Additional Resources

- [API Documentation](./API.md)
- [Provider Configuration Guide](./PROVIDERS.md)
- [Security Best Practices](./SECURITY.md)
- [Performance Tuning](./PERFORMANCE.md)
- [Deployment Guide](./DEPLOYMENT.md)