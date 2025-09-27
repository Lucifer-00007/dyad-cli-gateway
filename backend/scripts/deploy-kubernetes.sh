#!/bin/bash

# Kubernetes Deployment Script for Dyad CLI Gateway
# This script automates the deployment process to Kubernetes

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="${PROJECT_ROOT}/deployment/kubernetes"
LOG_FILE="${PROJECT_ROOT}/logs/k8s-deploy.log"

# Default values
NAMESPACE="${NAMESPACE:-dyad-gateway}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
ENABLE_GVISOR="${ENABLE_GVISOR:-false}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check Docker (if building images)
    if [[ "$SKIP_BUILD" != "true" ]] && ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check required files
    local required_files=(
        "$K8S_DIR/namespace.yaml"
        "$K8S_DIR/configmap.yaml"
        "$K8S_DIR/secret.yaml"
        "$K8S_DIR/rbac.yaml"
        "$K8S_DIR/mongodb.yaml"
        "$K8S_DIR/redis.yaml"
        "$K8S_DIR/gateway.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping image build"
        return 0
    fi
    
    log_info "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    local image_name="dyad/cli-gateway:${IMAGE_TAG}"
    
    if docker build -f Dockerfile.gateway -t "$image_name" .; then
        log_success "Docker image built successfully: $image_name"
        
        # Tag for registry if needed
        if [[ -n "${DOCKER_REGISTRY:-}" ]]; then
            local registry_image="${DOCKER_REGISTRY}/dyad/cli-gateway:${IMAGE_TAG}"
            docker tag "$image_name" "$registry_image"
            
            if [[ "$DRY_RUN" != "true" ]]; then
                docker push "$registry_image"
                log_success "Image pushed to registry: $registry_image"
            else
                log_info "DRY RUN: Would push image to registry: $registry_image"
            fi
        fi
    else
        log_error "Docker image build failed"
        exit 1
    fi
}

# Apply Kubernetes manifests
apply_manifest() {
    local manifest_file=$1
    local description=$2
    
    log_info "Applying $description..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would apply $manifest_file"
        kubectl apply -f "$manifest_file" --dry-run=client -o yaml
    else
        if kubectl apply -f "$manifest_file"; then
            log_success "$description applied successfully"
        else
            log_error "Failed to apply $description"
            exit 1
        fi
    fi
}

# Wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local namespace=$2
    local timeout=${3:-$WAIT_TIMEOUT}
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would wait for deployment $deployment_name"
        return 0
    fi
    
    log_info "Waiting for deployment $deployment_name to be ready..."
    
    if kubectl wait --for=condition=available deployment/"$deployment_name" -n "$namespace" --timeout="${timeout}s"; then
        log_success "Deployment $deployment_name is ready"
    else
        log_error "Deployment $deployment_name failed to become ready within ${timeout}s"
        
        # Show pod status for debugging
        log_info "Pod status:"
        kubectl get pods -n "$namespace" -l app.kubernetes.io/name=dyad-gateway
        
        log_info "Recent events:"
        kubectl get events -n "$namespace" --sort-by='.lastTimestamp' | tail -10
        
        exit 1
    fi
}

# Wait for pods to be ready
wait_for_pods() {
    local label_selector=$1
    local namespace=$2
    local timeout=${3:-$WAIT_TIMEOUT}
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would wait for pods with selector $label_selector"
        return 0
    fi
    
    log_info "Waiting for pods with selector $label_selector to be ready..."
    
    if kubectl wait --for=condition=ready pod -l "$label_selector" -n "$namespace" --timeout="${timeout}s"; then
        log_success "Pods are ready"
    else
        log_error "Pods failed to become ready within ${timeout}s"
        
        # Show pod status for debugging
        log_info "Pod status:"
        kubectl get pods -n "$namespace" -l "$label_selector"
        
        exit 1
    fi
}

# Verify deployment health
verify_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would verify deployment health"
        return 0
    fi
    
    log_info "Verifying deployment health..."
    
    # Check if gateway pods are running
    local gateway_pods=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=gateway -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$gateway_pods" ]]; then
        log_error "No gateway pods found"
        exit 1
    fi
    
    # Check health endpoint
    log_info "Testing health endpoint..."
    
    # Port forward to test health endpoint
    local pod_name=$(echo "$gateway_pods" | cut -d' ' -f1)
    kubectl port-forward -n "$NAMESPACE" "pod/$pod_name" 8080:3001 &
    local port_forward_pid=$!
    
    # Wait a moment for port forward to establish
    sleep 5
    
    # Test health endpoint
    if curl -f -s http://localhost:8080/healthz > /dev/null; then
        log_success "Health endpoint is responding"
    else
        log_error "Health endpoint is not responding"
        kill $port_forward_pid 2>/dev/null || true
        exit 1
    fi
    
    # Clean up port forward
    kill $port_forward_pid 2>/dev/null || true
    
    log_success "Deployment verification completed"
}

# Show deployment status
show_status() {
    log_info "=== Deployment Status ==="
    
    echo ""
    echo "Namespace: $NAMESPACE"
    kubectl get namespace "$NAMESPACE" 2>/dev/null || echo "Namespace not found"
    
    echo ""
    echo "Deployments:"
    kubectl get deployments -n "$NAMESPACE" 2>/dev/null || echo "No deployments found"
    
    echo ""
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "No pods found"
    
    echo ""
    echo "Services:"
    kubectl get services -n "$NAMESPACE" 2>/dev/null || echo "No services found"
    
    echo ""
    echo "Ingress:"
    kubectl get ingress -n "$NAMESPACE" 2>/dev/null || echo "No ingress found"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        echo "Gateway Logs (last 20 lines):"
        kubectl logs -n "$NAMESPACE" -l app.kubernetes.io/component=gateway --tail=20 2>/dev/null || echo "No logs available"
    fi
}

# Cleanup function
cleanup_deployment() {
    log_info "Cleaning up deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would delete all resources in namespace $NAMESPACE"
        return 0
    fi
    
    # Delete all resources in the namespace
    kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
    
    log_success "Cleanup completed"
}

# Main deployment function
deploy() {
    log_info "=== Starting Kubernetes Deployment ==="
    log_info "Namespace: $NAMESPACE"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Dry Run: $DRY_RUN"
    log_info "Enable gVisor: $ENABLE_GVISOR"
    
    # Build image
    build_image
    
    # Apply manifests in order
    apply_manifest "$K8S_DIR/namespace.yaml" "Namespace"
    apply_manifest "$K8S_DIR/rbac.yaml" "RBAC Configuration"
    apply_manifest "$K8S_DIR/security-policies.yaml" "Security Policies"
    apply_manifest "$K8S_DIR/configmap.yaml" "ConfigMap"
    apply_manifest "$K8S_DIR/secret.yaml" "Secrets"
    
    # Deploy dependencies
    apply_manifest "$K8S_DIR/mongodb.yaml" "MongoDB"
    apply_manifest "$K8S_DIR/redis.yaml" "Redis"
    
    # Wait for dependencies
    wait_for_pods "app.kubernetes.io/component=database" "$NAMESPACE"
    wait_for_pods "app.kubernetes.io/component=cache" "$NAMESPACE"
    
    # Deploy gateway
    apply_manifest "$K8S_DIR/gateway.yaml" "Gateway"
    
    # Enable gVisor if requested
    if [[ "$ENABLE_GVISOR" == "true" ]]; then
        apply_manifest "$K8S_DIR/gvisor-runtime.yaml" "gVisor Runtime"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            # Update gateway deployment to use gVisor
            kubectl patch deployment dyad-gateway -n "$NAMESPACE" -p '{"spec":{"template":{"spec":{"runtimeClassName":"gvisor"}}}}'
            log_success "gVisor runtime enabled"
        fi
    fi
    
    # Wait for gateway deployment
    wait_for_deployment "dyad-gateway" "$NAMESPACE"
    
    # Apply monitoring if available
    if [[ -f "$K8S_DIR/monitoring.yaml" ]]; then
        apply_manifest "$K8S_DIR/monitoring.yaml" "Monitoring"
    fi
    
    # Verify deployment
    verify_deployment
    
    log_success "=== Deployment completed successfully ==="
    
    # Show final status
    show_status
    
    # Show access information
    if [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        log_info "=== Access Information ==="
        echo "Health Check: kubectl port-forward -n $NAMESPACE svc/dyad-gateway 8080:80"
        echo "Then visit: http://localhost:8080/healthz"
        echo ""
        echo "API Access: kubectl port-forward -n $NAMESPACE svc/dyad-gateway 8080:80"
        echo "Then visit: http://localhost:8080/v1/models"
        echo ""
        echo "Logs: kubectl logs -n $NAMESPACE -l app.kubernetes.io/component=gateway -f"
    fi
}

# Main execution
main() {
    local command="${1:-deploy}"
    
    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    case "$command" in
        "deploy")
            check_prerequisites
            deploy
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            cleanup_deployment
            ;;
        "build")
            build_image
            ;;
        *)
            echo "Usage: $0 {deploy|status|cleanup|build}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the gateway to Kubernetes"
            echo "  status   - Show deployment status"
            echo "  cleanup  - Remove all deployed resources"
            echo "  build    - Build Docker image only"
            echo ""
            echo "Environment Variables:"
            echo "  NAMESPACE      - Kubernetes namespace (default: dyad-gateway)"
            echo "  IMAGE_TAG      - Docker image tag (default: latest)"
            echo "  DRY_RUN        - Dry run mode (default: false)"
            echo "  SKIP_BUILD     - Skip image build (default: false)"
            echo "  ENABLE_GVISOR  - Enable gVisor runtime (default: false)"
            echo "  WAIT_TIMEOUT   - Deployment wait timeout in seconds (default: 300)"
            echo "  DOCKER_REGISTRY - Docker registry for image push"
            echo ""
            echo "Examples:"
            echo "  $0 deploy"
            echo "  DRY_RUN=true $0 deploy"
            echo "  IMAGE_TAG=v1.0.0 DOCKER_REGISTRY=registry.example.com $0 deploy"
            echo "  ENABLE_GVISOR=true $0 deploy"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi