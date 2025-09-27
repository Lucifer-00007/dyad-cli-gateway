#!/bin/bash

# Production Startup Script for Dyad CLI Gateway
# This script handles production startup with proper error handling and logging

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_ROOT}/logs"
PID_FILE="${PROJECT_ROOT}/gateway.pid"
LOG_FILE="${LOG_DIR}/startup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [[ -f "$PID_FILE" ]]; then
        rm -f "$PID_FILE"
    fi
}

# Signal handlers
handle_sigterm() {
    log_info "Received SIGTERM, initiating graceful shutdown..."
    cleanup
    exit 0
}

handle_sigint() {
    log_info "Received SIGINT, initiating graceful shutdown..."
    cleanup
    exit 0
}

# Set up signal handlers
trap handle_sigterm SIGTERM
trap handle_sigint SIGINT

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if ! node -e "process.exit(require('semver').gte('$node_version', '$required_version') ? 0 : 1)" 2>/dev/null; then
        log_error "Node.js version $node_version is below required version $required_version"
        exit 1
    fi
    
    # Check if already running
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_error "Gateway is already running with PID $pid"
            exit 1
        else
            log_warn "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi
    
    # Check required environment variables
    local required_vars=(
        "NODE_ENV"
        "MONGODB_URL"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Create necessary directories
    mkdir -p "$LOG_DIR"
    
    # Check disk space
    local available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    local min_space=1048576  # 1GB in KB
    if [[ $available_space -lt $min_space ]]; then
        log_error "Insufficient disk space. Available: ${available_space}KB, Required: ${min_space}KB"
        exit 1
    fi
    
    log_success "Pre-flight checks completed successfully"
}

# Database connectivity check
check_database() {
    log_info "Checking database connectivity..."
    
    # Use a simple Node.js script to test MongoDB connection
    node -e "
        const mongoose = require('mongoose');
        mongoose.connect('$MONGODB_URL', { 
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000 
        })
        .then(() => {
            console.log('Database connection successful');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Database connection failed:', err.message);
            process.exit(1);
        });
    " || {
        log_error "Database connectivity check failed"
        exit 1
    }
    
    log_success "Database connectivity verified"
}

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    local port=${GATEWAY_PORT:-3001}
    
    log_info "Waiting for gateway to become healthy..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:$port/healthz" > /dev/null 2>&1; then
            log_success "Gateway is healthy and responding"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    log_error "Gateway failed to become healthy after $max_attempts attempts"
    return 1
}

# Main startup function
start_gateway() {
    log_info "Starting Dyad CLI Gateway in production mode..."
    
    cd "$PROJECT_ROOT"
    
    # Set production environment
    export NODE_ENV=production
    export NODE_OPTIONS="--max-old-space-size=512"
    
    # Start the gateway with PM2 or direct Node.js
    if command -v pm2 &> /dev/null; then
        log_info "Starting with PM2..."
        pm2 start ecosystem.config.json --env production
        
        # Get the PM2 process ID and save it
        local pm2_pid=$(pm2 jlist | jq -r '.[0].pid // empty')
        if [[ -n "$pm2_pid" ]]; then
            echo "$pm2_pid" > "$PID_FILE"
        fi
    else
        log_info "Starting with Node.js directly..."
        nohup node src/gateway/server.js > "$LOG_DIR/gateway.log" 2>&1 &
        local node_pid=$!
        echo "$node_pid" > "$PID_FILE"
        
        # Wait a moment to ensure the process started successfully
        sleep 2
        if ! kill -0 "$node_pid" 2>/dev/null; then
            log_error "Failed to start gateway process"
            exit 1
        fi
    fi
    
    log_success "Gateway started successfully"
}

# Main execution
main() {
    log_info "=== Dyad CLI Gateway Production Startup ==="
    log_info "Timestamp: $(date)"
    log_info "User: $(whoami)"
    log_info "Working Directory: $(pwd)"
    log_info "Node Version: $(node --version)"
    log_info "Environment: ${NODE_ENV:-development}"
    
    # Run startup sequence
    preflight_checks
    check_database
    start_gateway
    
    # Verify the gateway is healthy
    if health_check; then
        log_success "=== Gateway startup completed successfully ==="
        log_info "Gateway PID: $(cat "$PID_FILE" 2>/dev/null || echo "unknown")"
        log_info "Logs: $LOG_DIR"
        log_info "Health endpoint: http://localhost:${GATEWAY_PORT:-3001}/healthz"
        log_info "Metrics endpoint: http://localhost:${GATEWAY_PORT:-3001}/metrics"
    else
        log_error "=== Gateway startup failed ==="
        cleanup
        exit 1
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi