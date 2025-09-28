#!/bin/bash

# Dyad CLI Gateway Deployment Script
# Supports multiple deployment targets: kubernetes, docker-compose, ecs

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# Default values
ENVIRONMENT="staging"
TARGET="kubernetes"
VERSION=""
DRY_RUN=false
ROLLBACK=false
HEALTH_CHECK_TIMEOUT=300
NAMESPACE="dyad-cli-gateway"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Dyad CLI Gateway to various targets

OPTIONS:
    -e, --environment ENVIRONMENT   Target environment (staging, production) [default: staging]
    -t, --target TARGET            Deployment target (kubernetes, docker-compose, ecs) [default: kubernetes]
    -v, --version VERSION          Version to deploy (tag or commit SHA)
    -n, --namespace NAMESPACE      Kubernetes namespace [default: dyad-cli-gateway]
    -d, --dry-run                  Show what would be deployed without executing
    -r, --rollback                 Rollback to previous version
    -h, --help                     Show this help message

EXAMPLES:
    $0 -e production -v v1.2.3                    # Deploy version v1.2.3 to production
    $0 -e staging -t docker-compose                # Deploy to staging using docker-compose
    $0 -e production -r                            # Rollback production deployment
    $0 -d -e production -v v1.2.3                  # Dry run for production deployment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
fi

# Validate target
if [[ ! "$TARGET" =~ ^(kubernetes|docker-compose|ecs)$ ]]; then
    log_error "Invalid target: $TARGET. Must be 'kubernetes', 'docker-compose', or 'ecs'"
    exit 1
fi

# Set version if not provided
if [[ -z "$VERSION" && "$ROLLBACK" == false ]]; then
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_error "Version must be specified for production deployments"
        exit 1
    else
        VERSION="latest"
        log_warning "No version specified, using 'latest' for staging"
    fi
fi

# Set namespace based on environment
if [[ "$ENVIRONMENT" == "production" ]]; then
    NAMESPACE="${NAMESPACE}-prod"
else
    NAMESPACE="${NAMESPACE}-staging"
fi

log_info "Starting deployment with the following configuration:"
log_info "  Environment: $ENVIRONMENT"
log_info "  Target: $TARGET"
log_info "  Version: $VERSION"
log_info "  Namespace: $NAMESPACE"
log_info "  Dry Run: $DRY_RUN"
log_info "  Rollback: $ROLLBACK"

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check if required tools are installed
    case $TARGET in
        kubernetes)
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is required for Kubernetes deployments"
                exit 1
            fi
            
            # Check cluster connectivity
            if ! kubectl cluster-info &> /dev/null; then
                log_error "Cannot connect to Kubernetes cluster"
                exit 1
            fi
            ;;
        docker-compose)
            if ! command -v docker-compose &> /dev/null; then
                log_error "docker-compose is required for Docker Compose deployments"
                exit 1
            fi
            ;;
        ecs)
            if ! command -v aws &> /dev/null; then
                log_error "AWS CLI is required for ECS deployments"
                exit 1
            fi
            ;;
    esac

    # Check if deployment files exist
    case $TARGET in
        kubernetes)
            if [[ ! -f "$DEPLOYMENT_DIR/kubernetes/$ENVIRONMENT.yaml" ]]; then
                log_error "Kubernetes deployment file not found: $DEPLOYMENT_DIR/kubernetes/$ENVIRONMENT.yaml"
                exit 1
            fi
            ;;
        docker-compose)
            if [[ ! -f "$DEPLOYMENT_DIR/docker-compose.$ENVIRONMENT.yml" ]]; then
                log_error "Docker Compose file not found: $DEPLOYMENT_DIR/docker-compose.$ENVIRONMENT.yml"
                exit 1
            fi
            ;;
    esac

    log_success "Pre-deployment checks passed"
}

# Backup current deployment
backup_deployment() {
    log_info "Creating backup of current deployment..."

    case $TARGET in
        kubernetes)
            # Get current deployment images
            kubectl get deployments -n "$NAMESPACE" -o yaml > "/tmp/backup-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).yaml" 2>/dev/null || true
            ;;
        docker-compose)
            # Save current docker-compose state
            docker-compose -f "$DEPLOYMENT_DIR/docker-compose.$ENVIRONMENT.yml" config > "/tmp/backup-compose-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).yml" 2>/dev/null || true
            ;;
        ecs)
            # Save current ECS task definitions
            aws ecs describe-services --cluster "dyad-cli-gateway-$ENVIRONMENT" --services dyad-cli-gateway-backend dyad-cli-gateway-gateway > "/tmp/backup-ecs-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).json" 2>/dev/null || true
            ;;
    esac

    log_success "Backup created"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."

    local deployment_file="$DEPLOYMENT_DIR/kubernetes/$ENVIRONMENT.yaml"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Dry run - would execute:"
        echo "kubectl apply -f $deployment_file --dry-run=client"
        return
    fi

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Update image tags in deployment
    if [[ "$VERSION" != "latest" ]]; then
        sed -i.bak "s|:latest|:$VERSION|g" "$deployment_file"
    fi

    # Apply deployment
    kubectl apply -f "$deployment_file"

    # Wait for rollout to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/dyad-cli-gateway-backend -n "$NAMESPACE" --timeout=300s
    kubectl rollout status deployment/dyad-cli-gateway-gateway -n "$NAMESPACE" --timeout=300s

    # Restore original file
    if [[ -f "$deployment_file.bak" ]]; then
        mv "$deployment_file.bak" "$deployment_file"
    fi

    log_success "Kubernetes deployment completed"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."

    local compose_file="$DEPLOYMENT_DIR/docker-compose.$ENVIRONMENT.yml"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Dry run - would execute:"
        echo "docker-compose -f $compose_file up -d"
        return
    fi

    # Set environment variables
    export IMAGE_TAG="$VERSION"
    export ENVIRONMENT="$ENVIRONMENT"

    # Deploy
    docker-compose -f "$compose_file" pull
    docker-compose -f "$compose_file" up -d

    log_success "Docker Compose deployment completed"
}

# Deploy to ECS
deploy_ecs() {
    log_info "Deploying to ECS..."

    local cluster_name="dyad-cli-gateway-$ENVIRONMENT"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Dry run - would execute ECS deployment commands"
        return
    fi

    # Update ECS services
    aws ecs update-service \
        --cluster "$cluster_name" \
        --service dyad-cli-gateway-backend \
        --force-new-deployment

    aws ecs update-service \
        --cluster "$cluster_name" \
        --service dyad-cli-gateway-gateway \
        --force-new-deployment

    # Wait for deployment to stabilize
    log_info "Waiting for ECS services to stabilize..."
    aws ecs wait services-stable \
        --cluster "$cluster_name" \
        --services dyad-cli-gateway-backend dyad-cli-gateway-gateway

    log_success "ECS deployment completed"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."

    case $TARGET in
        kubernetes)
            kubectl rollout undo deployment/dyad-cli-gateway-backend -n "$NAMESPACE"
            kubectl rollout undo deployment/dyad-cli-gateway-gateway -n "$NAMESPACE"
            
            kubectl rollout status deployment/dyad-cli-gateway-backend -n "$NAMESPACE" --timeout=300s
            kubectl rollout status deployment/dyad-cli-gateway-gateway -n "$NAMESPACE" --timeout=300s
            ;;
        docker-compose)
            log_warning "Docker Compose rollback requires manual intervention"
            log_info "Please restore from backup or redeploy previous version"
            ;;
        ecs)
            local cluster_name="dyad-cli-gateway-$ENVIRONMENT"
            
            # Get previous task definition
            local backend_task_def=$(aws ecs describe-services \
                --cluster "$cluster_name" \
                --services dyad-cli-gateway-backend \
                --query 'services[0].deployments[?status!=`PRIMARY`] | [0].taskDefinition' \
                --output text)
            
            local gateway_task_def=$(aws ecs describe-services \
                --cluster "$cluster_name" \
                --services dyad-cli-gateway-gateway \
                --query 'services[0].deployments[?status!=`PRIMARY`] | [0].taskDefinition' \
                --output text)
            
            # Rollback services
            aws ecs update-service \
                --cluster "$cluster_name" \
                --service dyad-cli-gateway-backend \
                --task-definition "$backend_task_def"
            
            aws ecs update-service \
                --cluster "$cluster_name" \
                --service dyad-cli-gateway-gateway \
                --task-definition "$gateway_task_def"
            ;;
    esac

    log_success "Rollback completed"
}

# Health check
health_check() {
    log_info "Running health checks..."

    local health_url
    case $TARGET in
        kubernetes)
            # Port forward for health check
            kubectl port-forward -n "$NAMESPACE" service/dyad-cli-gateway-backend-service 8080:80 &
            local port_forward_pid=$!
            sleep 5
            health_url="http://localhost:8080/health"
            ;;
        docker-compose)
            health_url="http://localhost:3000/health"
            ;;
        ecs)
            # Get ECS service endpoint
            health_url="https://dyad-cli-gateway.com/health"
            ;;
    esac

    # Wait for service to be ready
    local timeout=$HEALTH_CHECK_TIMEOUT
    local count=0
    
    while [[ $count -lt $timeout ]]; do
        if curl -f "$health_url" &> /dev/null; then
            log_success "Health check passed"
            
            # Clean up port forward if used
            if [[ -n "${port_forward_pid:-}" ]]; then
                kill $port_forward_pid 2>/dev/null || true
            fi
            
            return 0
        fi
        
        sleep 5
        count=$((count + 5))
        log_info "Waiting for service to be ready... ($count/$timeout seconds)"
    done

    log_error "Health check failed after $timeout seconds"
    
    # Clean up port forward if used
    if [[ -n "${port_forward_pid:-}" ]]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
    
    return 1
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification..."

    # Run health check
    if ! health_check; then
        log_error "Health check failed"
        return 1
    fi

    # Run smoke tests
    log_info "Running smoke tests..."
    
    case $TARGET in
        kubernetes)
            # Run smoke tests in a pod
            kubectl run smoke-test-$(date +%s) \
                --image=curlimages/curl:latest \
                --rm -i --restart=Never \
                --namespace="$NAMESPACE" \
                -- curl -f "http://dyad-cli-gateway-backend-service/health"
            ;;
        *)
            # Run local smoke tests
            if command -v npm &> /dev/null; then
                cd "$PROJECT_ROOT"
                npm run test:e2e || log_warning "E2E tests failed"
            fi
            ;;
    esac

    log_success "Post-deployment verification completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Set up cleanup trap
trap cleanup EXIT

# Main deployment flow
main() {
    log_info "Starting Dyad CLI Gateway deployment..."

    # Run pre-deployment checks
    pre_deployment_checks

    # Create backup
    backup_deployment

    if [[ "$ROLLBACK" == true ]]; then
        # Perform rollback
        rollback_deployment
    else
        # Perform deployment
        case $TARGET in
            kubernetes)
                deploy_kubernetes
                ;;
            docker-compose)
                deploy_docker_compose
                ;;
            ecs)
                deploy_ecs
                ;;
        esac
    fi

    # Run post-deployment verification
    if [[ "$DRY_RUN" == false ]]; then
        post_deployment_verification
    fi

    log_success "Deployment completed successfully!"
    
    # Print deployment info
    log_info "Deployment Summary:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Target: $TARGET"
    log_info "  Version: $VERSION"
    log_info "  Namespace: $NAMESPACE"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "  Production URL: https://dyad-cli-gateway.com"
    else
        log_info "  Staging URL: https://staging.dyad-cli-gateway.com"
    fi
}

# Run main function
main "$@"