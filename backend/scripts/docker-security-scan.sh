#!/bin/bash

# Docker Security Scanning Script
# Scans Docker images for vulnerabilities and security issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGES_TO_SCAN=(
    "node:18-alpine"
    "dyad-cli-gateway:latest"
)
SEVERITY_THRESHOLD="MEDIUM"
SCAN_RESULTS_DIR="./security-scan-results"

echo -e "${BLUE}🔒 Docker Security Scanner${NC}"
echo -e "${BLUE}=========================${NC}\n"

# Create results directory
mkdir -p "$SCAN_RESULTS_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to scan with Trivy (if available)
scan_with_trivy() {
    local image=$1
    local output_file="$SCAN_RESULTS_DIR/trivy-${image//[:\/]/-}.json"
    
    echo -e "${BLUE}Scanning $image with Trivy...${NC}"
    
    if trivy image --format json --severity "$SEVERITY_THRESHOLD,HIGH,CRITICAL" --output "$output_file" "$image"; then
        local vuln_count=$(jq '.Results[]?.Vulnerabilities | length' "$output_file" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        
        if [ "$vuln_count" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Found $vuln_count vulnerabilities in $image${NC}"
            
            # Show critical and high vulnerabilities
            echo -e "${RED}Critical and High severity vulnerabilities:${NC}"
            jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL" or .Severity == "HIGH") | "- \(.VulnerabilityID): \(.Title) (\(.Severity))"' "$output_file" 2>/dev/null | head -10
        else
            echo -e "${GREEN}✅ No vulnerabilities found in $image${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to scan $image with Trivy${NC}"
        return 1
    fi
}

# Function to scan with Docker Scout (if available)
scan_with_docker_scout() {
    local image=$1
    
    echo -e "${BLUE}Scanning $image with Docker Scout...${NC}"
    
    if docker scout cves --format json "$image" > "$SCAN_RESULTS_DIR/scout-${image//[:\/]/-}.json" 2>/dev/null; then
        echo -e "${GREEN}✅ Docker Scout scan completed for $image${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker Scout not available or failed for $image${NC}"
        return 1
    fi
}

# Function to perform basic Docker security checks
basic_security_checks() {
    local image=$1
    
    echo -e "${BLUE}Performing basic security checks for $image...${NC}"
    
    # Check if image runs as root
    local user=$(docker inspect "$image" --format='{{.Config.User}}' 2>/dev/null || echo "")
    if [ -z "$user" ] || [ "$user" = "root" ] || [ "$user" = "0" ]; then
        echo -e "${YELLOW}⚠️  Image $image runs as root user${NC}"
    else
        echo -e "${GREEN}✅ Image $image runs as non-root user: $user${NC}"
    fi
    
    # Check for exposed ports
    local ports=$(docker inspect "$image" --format='{{range $port, $config := .Config.ExposedPorts}}{{$port}} {{end}}' 2>/dev/null || echo "")
    if [ -n "$ports" ]; then
        echo -e "${BLUE}ℹ️  Exposed ports: $ports${NC}"
    fi
    
    # Check image size
    local size=$(docker images "$image" --format "{{.Size}}" 2>/dev/null | head -1)
    if [ -n "$size" ]; then
        echo -e "${BLUE}ℹ️  Image size: $size${NC}"
    fi
}

# Function to check Dockerfile security
check_dockerfile_security() {
    local dockerfile_path="./Dockerfile.gateway"
    
    if [ ! -f "$dockerfile_path" ]; then
        echo -e "${YELLOW}⚠️  Dockerfile not found at $dockerfile_path${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Checking Dockerfile security...${NC}"
    
    local issues=0
    
    # Check for non-root user
    if ! grep -q "USER " "$dockerfile_path" || grep -q "USER root" "$dockerfile_path"; then
        echo -e "${YELLOW}⚠️  Dockerfile should specify non-root USER${NC}"
        ((issues++))
    else
        echo -e "${GREEN}✅ Dockerfile specifies non-root user${NC}"
    fi
    
    # Check for package updates
    if ! grep -q "apk update\|apt-get update\|yum update" "$dockerfile_path"; then
        echo -e "${YELLOW}⚠️  Dockerfile should update packages for security patches${NC}"
        ((issues++))
    else
        echo -e "${GREEN}✅ Dockerfile updates packages${NC}"
    fi
    
    # Check for HEALTHCHECK
    if ! grep -q "HEALTHCHECK" "$dockerfile_path"; then
        echo -e "${YELLOW}⚠️  Dockerfile should include HEALTHCHECK${NC}"
        ((issues++))
    else
        echo -e "${GREEN}✅ Dockerfile includes health check${NC}"
    fi
    
    # Check for minimal base image
    if ! grep -q "alpine\|distroless\|scratch" "$dockerfile_path"; then
        echo -e "${YELLOW}⚠️  Consider using minimal base image (alpine, distroless)${NC}"
        ((issues++))
    else
        echo -e "${GREEN}✅ Dockerfile uses minimal base image${NC}"
    fi
    
    # Check for secrets in Dockerfile
    if grep -qi "password\|secret\|key\|token" "$dockerfile_path"; then
        echo -e "${RED}❌ Potential secrets found in Dockerfile${NC}"
        ((issues++))
    else
        echo -e "${GREEN}✅ No obvious secrets in Dockerfile${NC}"
    fi
    
    if [ $issues -eq 0 ]; then
        echo -e "${GREEN}✅ Dockerfile security check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Dockerfile has $issues security recommendations${NC}"
    fi
}

# Main scanning logic
main() {
    local total_issues=0
    local scan_tools_available=0
    
    # Check available scanning tools
    if command_exists trivy; then
        echo -e "${GREEN}✅ Trivy scanner available${NC}"
        ((scan_tools_available++))
    else
        echo -e "${YELLOW}⚠️  Trivy not available. Install with: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin${NC}"
    fi
    
    if command_exists docker && docker scout version >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker Scout available${NC}"
        ((scan_tools_available++))
    else
        echo -e "${YELLOW}⚠️  Docker Scout not available${NC}"
    fi
    
    if [ $scan_tools_available -eq 0 ]; then
        echo -e "${RED}❌ No vulnerability scanners available. Installing basic checks only.${NC}"
    fi
    
    echo ""
    
    # Check Dockerfile security
    check_dockerfile_security
    echo ""
    
    # Scan each image
    for image in "${IMAGES_TO_SCAN[@]}"; do
        echo -e "${BLUE}Scanning image: $image${NC}"
        echo "----------------------------------------"
        
        # Check if image exists locally
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  Image $image not found locally. Pulling...${NC}"
            if ! docker pull "$image"; then
                echo -e "${RED}❌ Failed to pull $image${NC}"
                ((total_issues++))
                continue
            fi
        fi
        
        # Run basic security checks
        basic_security_checks "$image"
        
        # Run vulnerability scans if tools are available
        if command_exists trivy; then
            if ! scan_with_trivy "$image"; then
                ((total_issues++))
            fi
        fi
        
        if command_exists docker && docker scout version >/dev/null 2>&1; then
            scan_with_docker_scout "$image" || true
        fi
        
        echo ""
    done
    
    # Generate summary report
    echo -e "${BLUE}📊 Scan Summary${NC}"
    echo "==============="
    echo "Scanned images: ${#IMAGES_TO_SCAN[@]}"
    echo "Results directory: $SCAN_RESULTS_DIR"
    
    if [ $total_issues -gt 0 ]; then
        echo -e "${RED}❌ Security scan completed with $total_issues issues${NC}"
        echo -e "${YELLOW}Review the detailed results in $SCAN_RESULTS_DIR${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Security scan completed successfully${NC}"
        exit 0
    fi
}

# Run main function
main "$@"