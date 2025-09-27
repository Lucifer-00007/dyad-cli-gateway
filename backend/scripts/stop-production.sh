#!/bin/bash

# Production Shutdown Script for Dyad CLI Gateway
# This script handles graceful shutdown with proper cleanup

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_ROOT}/logs"
PID_FILE="${PROJECT_ROOT}/gateway.pid"
LOG_FILE="${LOG_DIR}/shutdown.log"

# Timeout for graceful shutdown (seconds)
SHUTDOWN_TIMEOUT=${SHUTDOWN_TIMEOUT:-30}

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

# Check if gateway is running
is_running() {
    if [[ ! -f "$PID_FILE" ]]; then
        return 1
    fi
    
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get gateway PID
get_pid() {
    if [[ -f "$PID_FILE" ]]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

# Stop PM2 processes
stop_pm2() {
    if command -v pm2 &> /dev/null; then
        log_info "Stopping PM2 processes..."
        
        # Stop all PM2 processes for this project
        pm2 stop ecosystem.config.json 2>/dev/null || true
        pm2 delete ecosystem.config.json 2>/dev/null || true
        
        log_success "PM2 processes stopped"
    fi
}

# Graceful shutdown with SIGTERM
graceful_shutdown() {
    local pid=$1
    
    log_info "Sending SIGTERM to process $pid for graceful shutdown..."
    
    if kill -TERM "$pid" 2>/dev/null; then
        # Wait for graceful shutdown
        local count=0
        while [[ $count -lt $SHUTDOWN_TIMEOUT ]]; do
            if ! kill -0 "$pid" 2>/dev/null; then
                log_success "Process $pid shut down gracefully"
                return 0
            fi
            sleep 1
            ((count++))
        done
        
        log_warn "Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT}s"
        return 1
    else
        log_error "Failed to send SIGTERM to process $pid"
        return 1
    fi
}

# Force shutdown with SIGKILL
force_shutdown() {
    local pid=$1
    
    log_warn "Forcing shutdown of process $pid with SIGKILL..."
    
    if kill -KILL "$pid" 2>/dev/null; then
        sleep 2
        if ! kill -0 "$pid" 2>/dev/null; then
            log_success "Process $pid forcefully terminated"
            return 0
        else
            log_error "Failed to kill process $pid"
            return 1
        fi
    else
        log_error "Failed to send SIGKILL to process $pid"
        return 1
    fi
}

# Clean up sandbox jobs (Kubernetes)
cleanup_sandbox_jobs() {
    log_info "Cleaning up sandbox jobs..."
    
    # Check if kubectl is available and we're in a K8s environment
    if command -v kubectl &> /dev/null && [[ -n "${K8S_SANDBOX_NAMESPACE:-}" ]]; then
        local namespace="${K8S_SANDBOX_NAMESPACE}"
        
        # Delete all sandbox jobs
        local jobs=$(kubectl get jobs -n "$namespace" -l "dyad.gateway/job-type=cli-execution" -o name 2>/dev/null || echo "")
        
        if [[ -n "$jobs" ]]; then
            log_info "Found sandbox jobs to clean up: $(echo "$jobs" | wc -l)"
            echo "$jobs" | xargs -r kubectl delete -n "$namespace" --timeout=30s
            log_success "Sandbox jobs cleaned up"
        else
            log_info "No sandbox jobs found to clean up"
        fi
    else
        log_info "Kubernetes not available or not configured, skipping sandbox cleanup"
    fi
}

# Clean up temporary files and resources
cleanup_resources() {
    log_info "Cleaning up resources..."
    
    # Remove PID file
    if [[ -f "$PID_FILE" ]]; then
        rm -f "$PID_FILE"
        log_info "Removed PID file"
    fi
    
    # Clean up temporary files
    local temp_dirs=(
        "${PROJECT_ROOT}/tmp"
        "${PROJECT_ROOT}/.tmp"
        "/tmp/dyad-gateway-*"
    )
    
    for temp_dir in "${temp_dirs[@]}"; do
        if [[ -d "$temp_dir" ]] || [[ -f "$temp_dir" ]]; then
            rm -rf "$temp_dir" 2>/dev/null || true
            log_info "Cleaned up temporary directory: $temp_dir"
        fi
    done
    
    # Clean up old log files (keep last 10)
    if [[ -d "$LOG_DIR" ]]; then
        find "$LOG_DIR" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
        log_info "Cleaned up old log files"
    fi
    
    log_success "Resource cleanup completed"
}

# Wait for active connections to close
wait_for_connections() {
    local port=${GATEWAY_PORT:-3001}
    local max_wait=10
    local count=0
    
    log_info "Waiting for active connections to close..."
    
    while [[ $count -lt $max_wait ]]; do
        local connections=$(netstat -an 2>/dev/null | grep ":$port " | grep ESTABLISHED | wc -l || echo "0")
        
        if [[ $connections -eq 0 ]]; then
            log_success "All connections closed"
            return 0
        fi
        
        log_info "Waiting for $connections active connections to close..."
        sleep 1
        ((count++))
    done
    
    log_warn "Some connections may still be active after ${max_wait}s wait"
}

# Main shutdown function
shutdown_gateway() {
    log_info "=== Dyad CLI Gateway Production Shutdown ==="
    log_info "Timestamp: $(date)"
    
    if ! is_running; then
        log_warn "Gateway is not running"
        cleanup_resources
        return 0
    fi
    
    local pid=$(get_pid)
    log_info "Found gateway process with PID: $pid"
    
    # Stop PM2 processes first
    stop_pm2
    
    # Wait for active connections to close
    wait_for_connections
    
    # Attempt graceful shutdown
    if graceful_shutdown "$pid"; then
        log_success "Gateway shut down gracefully"
    else
        log_warn "Graceful shutdown failed, attempting force shutdown..."
        if force_shutdown "$pid"; then
            log_success "Gateway shut down forcefully"
        else
            log_error "Failed to shut down gateway process"
            return 1
        fi
    fi
    
    # Clean up sandbox jobs
    cleanup_sandbox_jobs
    
    # Clean up resources
    cleanup_resources
    
    log_success "=== Gateway shutdown completed ==="
}

# Status check function
check_status() {
    if is_running; then
        local pid=$(get_pid)
        log_info "Gateway is running with PID: $pid"
        
        # Check if the process is responsive
        local port=${GATEWAY_PORT:-3001}
        if curl -f -s "http://localhost:$port/healthz" > /dev/null 2>&1; then
            log_success "Gateway is healthy and responding"
        else
            log_warn "Gateway process is running but not responding to health checks"
        fi
    else
        log_info "Gateway is not running"
    fi
}

# Main execution
main() {
    case "${1:-shutdown}" in
        "shutdown"|"stop")
            shutdown_gateway
            ;;
        "status")
            check_status
            ;;
        "restart")
            log_info "Restarting gateway..."
            shutdown_gateway
            sleep 2
            "$SCRIPT_DIR/start-production.sh"
            ;;
        *)
            echo "Usage: $0 {shutdown|stop|status|restart}"
            echo "  shutdown|stop  - Gracefully shutdown the gateway"
            echo "  status         - Check gateway status"
            echo "  restart        - Restart the gateway"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi