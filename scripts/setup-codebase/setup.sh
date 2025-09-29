#!/bin/bash

# Dyad CLI Gateway - Complete Setup Script
# This script sets up both frontend and backend with safety checks
# Usage: ./setup.sh [options]
# Options:
#   --skip-deps     Skip dependency installation
#   --skip-db       Skip database setup
#   --skip-tests    Skip running tests
#   --production    Setup for production environment
#   --help          Show this help message

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_FILE="$PROJECT_ROOT/setup.log"
MIN_NODE_VERSION="18.0.0"
MIN_NPM_VERSION="8.0.0"

# Default options
SKIP_DEPS=false
SKIP_DB=false
SKIP_TESTS=false
PRODUCTION=false
PACKAGE_MANAGER=""

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

# Help function
show_help() {
    cat << EOF
Dyad CLI Gateway - Complete Setup Script

USAGE:
    ./setup.sh [OPTIONS]

OPTIONS:
    --skip-deps     Skip dependency installation
    --skip-db       Skip database setup
    --skip-tests    Skip running tests
    --production    Setup for production environment
    --help          Show this help message

EXAMPLES:
    ./setup.sh                    # Full development setup
    ./setup.sh --skip-tests       # Setup without running tests
    ./setup.sh --production       # Production setup
    ./setup.sh --skip-db          # Setup without database configuration

REQUIREMENTS:
    - Node.js >= 18.0.0
    - npm >= 8.0.0 (or pnpm/bun)
    - MongoDB >= 5.0
    - Git

For more information, see:
    - backend/docs/SETUP.md
    - frontend/docs/SETUP.md
EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --production)
                PRODUCTION=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Version comparison function
version_compare() {
    local version1=$1
    local version2=$2
    
    if [[ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" == "$version2" ]]; then
        return 0  # version1 >= version2
    else
        return 1  # version1 < version2
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect package manager
detect_package_manager() {
    if command_exists bun && [[ -f "$FRONTEND_DIR/bun.lockb" || -f "$BACKEND_DIR/bun.lockb" ]]; then
        PACKAGE_MANAGER="bun"
    elif command_exists pnpm && [[ -f "$FRONTEND_DIR/pnpm-lock.yaml" || -f "$BACKEND_DIR/pnpm-lock.yaml" ]]; then
        PACKAGE_MANAGER="pnpm"
    elif command_exists yarn && [[ -f "$FRONTEND_DIR/yarn.lock" || -f "$BACKEND_DIR/yarn.lock" ]]; then
        PACKAGE_MANAGER="yarn"
    elif command_exists npm; then
        PACKAGE_MANAGER="npm"
    else
        error "No package manager found. Please install npm, pnpm, yarn, or bun."
        exit 1
    fi
    
    info "Detected package manager: $PACKAGE_MANAGER"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Node.js
    if ! command_exists node; then
        error "Node.js is not installed. Please install Node.js >= $MIN_NODE_VERSION"
        error "Visit: https://nodejs.org/"
        exit 1
    fi
    
    local node_version
    node_version=$(node --version | sed 's/v//')
    if ! version_compare "$node_version" "$MIN_NODE_VERSION"; then
        error "Node.js version $node_version is too old. Required: >= $MIN_NODE_VERSION"
        exit 1
    fi
    success "Node.js version $node_version is compatible"
    
    # Check npm
    if ! command_exists npm; then
        error "npm is not installed. Please install npm >= $MIN_NPM_VERSION"
        exit 1
    fi
    
    local npm_version
    npm_version=$(npm --version)
    if ! version_compare "$npm_version" "$MIN_NPM_VERSION"; then
        warn "npm version $npm_version might be too old. Recommended: >= $MIN_NPM_VERSION"
    else
        success "npm version $npm_version is compatible"
    fi
    
    # Check Git
    if ! command_exists git; then
        error "Git is not installed. Please install Git"
        error "Visit: https://git-scm.com/"
        exit 1
    fi
    success "Git is available"
    
    # Check directories exist
    if [[ ! -d "$BACKEND_DIR" ]]; then
        error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi
    
    success "All system requirements met"
}

# Check MongoDB
check_mongodb() {
    if [[ "$SKIP_DB" == true ]]; then
        warn "Skipping MongoDB check (--skip-db flag)"
        return 0
    fi
    
    log "Checking MongoDB..."
    
    # Check if MongoDB is installed
    if command_exists mongod; then
        success "MongoDB is installed"
        
        # Try to connect to MongoDB
        if command_exists mongosh; then
            if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
                success "MongoDB is running and accessible"
            else
                warn "MongoDB is installed but not running"
                info "You may need to start MongoDB manually:"
                info "  macOS (Homebrew): brew services start mongodb-community"
                info "  Linux (systemd): sudo systemctl start mongod"
                info "  Manual: mongod --dbpath /path/to/your/db"
            fi
        else
            warn "mongosh not found, cannot test MongoDB connection"
        fi
    elif command_exists mongo; then
        success "MongoDB (legacy client) is installed"
        if mongo --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
            success "MongoDB is running and accessible"
        else
            warn "MongoDB is installed but not running"
        fi
    else
        warn "MongoDB not found locally"
        info "You can:"
        info "  1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/"
        info "  2. Use Docker: docker run -d -p 27017:27017 mongo:5.0"
        info "  3. Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas"
        info "  4. Skip database setup with --skip-db flag"
    fi
}

# Setup backend environment
setup_backend_env() {
    log "Setting up backend environment..."
    
    cd "$BACKEND_DIR"
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            success "Created .env from .env.example"
            
            # Generate secure JWT secret
            if command_exists openssl; then
                local jwt_secret
                jwt_secret=$(openssl rand -hex 32)
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" .env
                else
                    # Linux
                    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" .env
                fi
                success "Generated secure JWT secret"
            else
                warn "OpenSSL not found, please manually set JWT_SECRET in backend/.env"
            fi
            
            # Set production environment if needed
            if [[ "$PRODUCTION" == true ]]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s/NODE_ENV=.*/NODE_ENV=production/" .env
                else
                    sed -i "s/NODE_ENV=.*/NODE_ENV=production/" .env
                fi
                info "Set NODE_ENV to production"
            fi
        else
            error ".env.example not found in backend directory"
            exit 1
        fi
    else
        info "Backend .env file already exists"
    fi
    
    cd "$PROJECT_ROOT"
}

# Setup frontend environment
setup_frontend_env() {
    log "Setting up frontend environment..."
    
    cd "$FRONTEND_DIR"
    
    # Determine environment file name
    local env_file=".env.development"
    if [[ "$PRODUCTION" == true ]]; then
        env_file=".env.production"
    fi
    
    # Create environment file if it doesn't exist
    if [[ ! -f "$env_file" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example "$env_file"
            success "Created $env_file from .env.example"
        else
            # Create basic environment file
            cat > "$env_file" << EOF
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Environment
VITE_ENVIRONMENT=${PRODUCTION:+production}${PRODUCTION:-development}
VITE_APP_NAME="Dyad CLI Gateway Admin"
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_FEATURE_FLAGS_ENABLED=true
VITE_FEATURE_ADVANCED_MONITORING=true
VITE_FEATURE_BULK_OPERATIONS=true
VITE_FEATURE_CHAT_PLAYGROUND=true
VITE_FEATURE_API_KEY_MANAGEMENT=true

# Debug Settings
VITE_DEBUG_MODE=${PRODUCTION:+false}${PRODUCTION:-true}
VITE_LOG_LEVEL=${PRODUCTION:+error}${PRODUCTION:-debug}
VITE_SHOW_DEV_TOOLS=${PRODUCTION:+false}${PRODUCTION:-true}

# Security
VITE_CSRF_ENABLED=${PRODUCTION:+true}${PRODUCTION:-false}
VITE_SECURE_COOKIES=${PRODUCTION:+true}${PRODUCTION:-false}
VITE_STRICT_CSP=${PRODUCTION:+true}${PRODUCTION:-false}

# Performance
VITE_ENABLE_VIRTUAL_SCROLLING=true
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=${PRODUCTION:+600000}${PRODUCTION:-300000}
EOF
            success "Created $env_file with default configuration"
        fi
    else
        info "Frontend $env_file file already exists"
    fi
    
    cd "$PROJECT_ROOT"
}

# Install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPS" == true ]]; then
        warn "Skipping dependency installation (--skip-deps flag)"
        return 0
    fi
    
    log "Installing dependencies..."
    
    # Install backend dependencies
    log "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm ci --prefer-offline --no-audit
            ;;
        pnpm)
            pnpm install --frozen-lockfile
            ;;
        yarn)
            yarn install --frozen-lockfile
            ;;
        bun)
            bun install --frozen-lockfile
            ;;
    esac
    
    success "Backend dependencies installed"
    
    # Install frontend dependencies
    log "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm ci --prefer-offline --no-audit
            ;;
        pnpm)
            pnpm install --frozen-lockfile
            ;;
        yarn)
            yarn install --frozen-lockfile
            ;;
        bun)
            bun install --frozen-lockfile
            ;;
    esac
    
    success "Frontend dependencies installed"
    
    cd "$PROJECT_ROOT"
}

# Run linting and type checking
run_quality_checks() {
    log "Running code quality checks..."
    
    # Backend quality checks
    log "Running backend quality checks..."
    cd "$BACKEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm run lint
            ;;
        pnpm)
            pnpm lint
            ;;
        yarn)
            yarn lint
            ;;
        bun)
            bun run lint
            ;;
    esac
    
    success "Backend linting passed"
    
    # Frontend quality checks
    log "Running frontend quality checks..."
    cd "$FRONTEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm run lint
            npm run type-check
            ;;
        pnpm)
            pnpm lint
            pnpm type-check
            ;;
        yarn)
            yarn lint
            yarn type-check
            ;;
        bun)
            bun run lint
            bun run type-check
            ;;
    esac
    
    success "Frontend quality checks passed"
    
    cd "$PROJECT_ROOT"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        warn "Skipping tests (--skip-tests flag)"
        return 0
    fi
    
    log "Running tests..."
    
    # Backend tests
    log "Running backend tests..."
    cd "$BACKEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm run test:run 2>/dev/null || npm test
            ;;
        pnpm)
            pnpm test:run 2>/dev/null || pnpm test
            ;;
        yarn)
            yarn test:run 2>/dev/null || yarn test
            ;;
        bun)
            bun run test:run 2>/dev/null || bun test
            ;;
    esac
    
    success "Backend tests passed"
    
    # Frontend tests
    log "Running frontend tests..."
    cd "$FRONTEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            npm run test:run 2>/dev/null || npm test
            ;;
        pnpm)
            pnpm test:run 2>/dev/null || pnpm test
            ;;
        yarn)
            yarn test:run 2>/dev/null || yarn test
            ;;
        bun)
            bun run test:run 2>/dev/null || bun test
            ;;
    esac
    
    success "Frontend tests passed"
    
    cd "$PROJECT_ROOT"
}

# Verify setup
verify_setup() {
    log "Verifying setup..."
    
    # Check backend can start
    log "Verifying backend setup..."
    cd "$BACKEND_DIR"
    
    # Create a test script to verify backend starts
    cat > verify_backend.js << 'EOF'
const app = require('./src/app');
const config = require('./src/config/config');

const server = app.listen(config.port || 3000, () => {
  console.log('Backend verification successful');
  server.close();
  process.exit(0);
});

setTimeout(() => {
  console.error('Backend verification timeout');
  server.close();
  process.exit(1);
}, 10000);
EOF
    
    if node verify_backend.js >/dev/null 2>&1; then
        success "Backend setup verified"
    else
        warn "Backend verification failed - check configuration"
    fi
    
    rm -f verify_backend.js
    
    # Check frontend can build
    log "Verifying frontend setup..."
    cd "$FRONTEND_DIR"
    
    case $PACKAGE_MANAGER in
        npm)
            if npm run build >/dev/null 2>&1; then
                success "Frontend setup verified"
            else
                warn "Frontend build failed - check configuration"
            fi
            ;;
        pnpm)
            if pnpm build >/dev/null 2>&1; then
                success "Frontend setup verified"
            else
                warn "Frontend build failed - check configuration"
            fi
            ;;
        yarn)
            if yarn build >/dev/null 2>&1; then
                success "Frontend setup verified"
            else
                warn "Frontend build failed - check configuration"
            fi
            ;;
        bun)
            if bun run build >/dev/null 2>&1; then
                success "Frontend setup verified"
            else
                warn "Frontend build failed - check configuration"
            fi
            ;;
    esac
    
    cd "$PROJECT_ROOT"
}

# Create startup scripts
create_startup_scripts() {
    log "Creating startup scripts..."
    
    cd "$PROJECT_ROOT"
    
    # Development startup script
    cat > start-dev.sh << EOF
#!/bin/bash
# Development startup script for Dyad CLI Gateway

set -e

echo "Starting Dyad CLI Gateway in development mode..."

# Function to cleanup background processes
cleanup() {
    echo "Shutting down services..."
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend..."
cd backend
$PACKAGE_MANAGER run dev &
BACKEND_PID=\$!

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend..."
cd ../frontend
$PACKAGE_MANAGER run dev &
FRONTEND_PID=\$!

echo ""
echo "� Dyad CLI: Gateway is starting up..."
echo ""
echo "� AdImin UI: http://localhost:8080"
echo "🔌 Backend API: http://localhost:3000"
echo "📚 API Docs: http://localhost:3000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait
EOF

    chmod +x start-dev.sh
    success "Created start-dev.sh"
    
    # Production startup script
    if [[ "$PRODUCTION" == true ]]; then
        cat > start-prod.sh << EOF
#!/bin/bash
# Production startup script for Dyad CLI Gateway

set -e

echo "Starting Dyad CLI Gateway in production mode..."

# Start backend with PM2
echo "Starting backend with PM2..."
cd backend
$PACKAGE_MANAGER start

# Build and serve frontend
echo "Building and serving frontend..."
cd ../frontend
$PACKAGE_MANAGER run build
$PACKAGE_MANAGER run preview &

echo ""
echo "� Dyadn CLI Gateway is running in production mode"
echo ""
echo "📊 Admin UI: http://localhost:4173"
echo "🔌 Backend API: http://localhost:3000"
echo ""
EOF

        chmod +x start-prod.sh
        success "Created start-prod.sh"
    fi
}

# Print final instructions
print_instructions() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                    🎉 Setup Complete! 🎉                     ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$PRODUCTION" == true ]]; then
        echo -e "${GREEN}Production setup completed successfully!${NC}"
        echo ""
        echo -e "${CYAN}To start the application:${NC}"
        echo -e "  ${YELLOW}./start-prod.sh${NC}"
        echo ""
        echo -e "${CYAN}Manual startup:${NC}"
        echo -e "  ${YELLOW}cd backend && $PACKAGE_MANAGER start${NC}"
        echo -e "  ${YELLOW}cd frontend && $PACKAGE_MANAGER run build && $PACKAGE_MANAGER run preview${NC}"
    else
        echo -e "${GREEN}Development setup completed successfully!${NC}"
        echo ""
        echo -e "${CYAN}To start the application:${NC}"
        echo -e "  ${YELLOW}./start-dev.sh${NC}"
        echo ""
        echo -e "${CYAN}Manual startup:${NC}"
        echo -e "  ${YELLOW}cd backend && $PACKAGE_MANAGER run dev${NC}"
        echo -e "  ${YELLOW}cd frontend && $PACKAGE_MANAGER run dev${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Application URLs:${NC}"
    if [[ "$PRODUCTION" == true ]]; then
        echo -e "  📊 Admin UI: ${BLUE}http://localhost:4173${NC}"
    else
        echo -e "  � eAdmin UI: ${BLUE}http://localhost:8080${NC}"
    fi
    echo -e "  🔌 Backend API: ${BLUE}http://localhost:3000${NC}"
    echo -e "  📚 API Documentation: ${BLUE}http://localhost:3000/docs${NC}"
    echo -e "  ❤️  Health Check: ${BLUE}http://localhost:3000/health${NC}"
    
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo -e "  1. ${YELLOW}Review configuration files:${NC}"
    echo -e "     - backend/.env"
    if [[ "$PRODUCTION" == true ]]; then
        echo -e "     - frontend/.env.production"
    else
        echo -e "     - frontend/.env.development"
    fi
    echo -e "  2. ${YELLOW}Configure AI providers through the admin UI${NC}"
    echo -e "  3. ${YELLOW}Create API keys for client applications${NC}"
    echo -e "  4. ${YELLOW}Test the chat playground functionality${NC}"
    
    if [[ "$SKIP_DB" == true ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  Database setup was skipped. Make sure to:${NC}"
        echo -e "  - Install and start MongoDB"
        echo -e "  - Update MONGODB_URL in backend/.env"
    fi
    
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo -e "  - Backend Setup: ${BLUE}backend/docs/SETUP.md${NC}"
    echo -e "  - Frontend Setup: ${BLUE}frontend/docs/SETUP.md${NC}"
    echo -e "  - API Documentation: ${BLUE}backend/docs/API.md${NC}"
    
    echo ""
    echo -e "${CYAN}Troubleshooting:${NC}"
    echo -e "  - Check logs: ${YELLOW}tail -f setup.log${NC}"
    echo -e "  - Backend logs: ${YELLOW}cd backend && $PACKAGE_MANAGER run logs${NC}"
    echo -e "  - Frontend issues: ${BLUE}frontend/docs/TROUBLESHOOTING.md${NC}"
    
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
    echo ""
}

# Main execution
main() {
    # Initialize log file
    echo "Dyad CLI Gateway Setup - $(date)" > "$LOG_FILE"
    
    log "Starting Dyad CLI Gateway setup..."
    log "Script directory: $SCRIPT_DIR"
    log "Project root: $PROJECT_ROOT"
    log "Log file: $LOG_FILE"
    
    # Parse arguments
    parse_args "$@"
    
    # Show configuration
    info "Setup configuration:"
    info "  Skip dependencies: $SKIP_DEPS"
    info "  Skip database: $SKIP_DB"
    info "  Skip tests: $SKIP_TESTS"
    info "  Production mode: $PRODUCTION"
    
    # Run setup steps
    check_requirements
    detect_package_manager
    check_mongodb
    setup_backend_env
    setup_frontend_env
    install_dependencies
    run_quality_checks
    run_tests
    verify_setup
    create_startup_scripts
    
    # Show final instructions
    print_instructions
    
    success "Setup completed successfully!"
}

# Run main function with all arguments
main "$@"