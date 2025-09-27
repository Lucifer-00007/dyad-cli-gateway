#!/bin/bash

# Database Backup Script for Dyad CLI Gateway
# Supports both local and cloud storage backups

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/backup.log"

# Database configuration
DB_HOST="${MONGODB_HOST:-localhost}"
DB_PORT="${MONGODB_PORT:-27017}"
DB_NAME="${MONGODB_DATABASE:-dyad-gateway}"
DB_USERNAME="${MONGODB_USERNAME:-}"
DB_PASSWORD="${MONGODB_PASSWORD:-}"

# Backup configuration
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
COMPRESS_BACKUPS="${COMPRESS_BACKUPS:-true}"
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-false}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Cloud storage configuration
CLOUD_BACKUP_ENABLED="${CLOUD_BACKUP_ENABLED:-false}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    # Check for mongodump
    if ! command -v mongodump &> /dev/null; then
        missing_deps+=("mongodump (MongoDB Database Tools)")
    fi
    
    # Check for compression tools if enabled
    if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
        if ! command -v gzip &> /dev/null; then
            missing_deps+=("gzip")
        fi
    fi
    
    # Check for encryption tools if enabled
    if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
        if ! command -v openssl &> /dev/null; then
            missing_deps+=("openssl")
        fi
    fi
    
    # Check for AWS CLI if cloud backup is enabled
    if [[ "$CLOUD_BACKUP_ENABLED" == "true" ]]; then
        if ! command -v aws &> /dev/null; then
            missing_deps+=("aws-cli")
        fi
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    # Set proper permissions
    chmod 750 "$BACKUP_DIR"
    chmod 750 "$LOG_DIR"
}

# Generate backup filename
generate_backup_filename() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local hostname=$(hostname -s)
    echo "${DB_NAME}_${hostname}_${timestamp}"
}

# Create MongoDB backup
create_mongodb_backup() {
    local backup_name=$1
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    log_info "Creating MongoDB backup: $backup_name"
    
    # Build mongodump command
    local mongodump_cmd="mongodump"
    mongodump_cmd+=" --host ${DB_HOST}:${DB_PORT}"
    mongodump_cmd+=" --db ${DB_NAME}"
    mongodump_cmd+=" --out ${backup_path}"
    
    # Add authentication if provided
    if [[ -n "$DB_USERNAME" ]]; then
        mongodump_cmd+=" --username ${DB_USERNAME}"
        if [[ -n "$DB_PASSWORD" ]]; then
            mongodump_cmd+=" --password ${DB_PASSWORD}"
        fi
        mongodump_cmd+=" --authenticationDatabase admin"
    fi
    
    # Add additional options
    mongodump_cmd+=" --gzip"
    mongodump_cmd+=" --oplog"
    
    # Execute backup
    if eval "$mongodump_cmd"; then
        log_success "MongoDB backup created successfully"
        return 0
    else
        log_error "MongoDB backup failed"
        return 1
    fi
}

# Compress backup
compress_backup() {
    local backup_name=$1
    local backup_path="${BACKUP_DIR}/${backup_name}"
    local compressed_path="${backup_path}.tar.gz"
    
    if [[ "$COMPRESS_BACKUPS" != "true" ]]; then
        echo "$backup_path"
        return 0
    fi
    
    log_info "Compressing backup..."
    
    if tar -czf "$compressed_path" -C "$BACKUP_DIR" "$backup_name"; then
        # Remove uncompressed backup
        rm -rf "$backup_path"
        log_success "Backup compressed successfully"
        echo "$compressed_path"
        return 0
    else
        log_error "Backup compression failed"
        return 1
    fi
}

# Encrypt backup
encrypt_backup() {
    local backup_path=$1
    local encrypted_path="${backup_path}.enc"
    
    if [[ "$ENCRYPT_BACKUPS" != "true" ]] || [[ -z "$ENCRYPTION_KEY" ]]; then
        echo "$backup_path"
        return 0
    fi
    
    log_info "Encrypting backup..."
    
    if openssl enc -aes-256-cbc -salt -in "$backup_path" -out "$encrypted_path" -k "$ENCRYPTION_KEY"; then
        # Remove unencrypted backup
        rm -f "$backup_path"
        log_success "Backup encrypted successfully"
        echo "$encrypted_path"
        return 0
    else
        log_error "Backup encryption failed"
        return 1
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    local backup_path=$1
    local backup_filename=$(basename "$backup_path")
    
    if [[ "$CLOUD_BACKUP_ENABLED" != "true" ]] || [[ -z "$AWS_S3_BUCKET" ]]; then
        return 0
    fi
    
    log_info "Uploading backup to S3..."
    
    local s3_path="s3://${AWS_S3_BUCKET}/dyad-gateway/backups/${backup_filename}"
    
    if aws s3 cp "$backup_path" "$s3_path" --region "$AWS_REGION"; then
        log_success "Backup uploaded to S3: $s3_path"
        return 0
    else
        log_error "Failed to upload backup to S3"
        return 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
    
    # Local cleanup
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "${DB_NAME}_*" -type f -mtime +$BACKUP_RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_info "Deleted $deleted_count old local backups"
    fi
    
    # Cloud cleanup (if enabled)
    if [[ "$CLOUD_BACKUP_ENABLED" == "true" ]] && [[ -n "$AWS_S3_BUCKET" ]]; then
        local cutoff_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" '+%Y-%m-%d')
        
        # List and delete old S3 objects
        aws s3api list-objects-v2 \
            --bucket "$AWS_S3_BUCKET" \
            --prefix "dyad-gateway/backups/" \
            --query "Contents[?LastModified<='${cutoff_date}'].Key" \
            --output text 2>/dev/null | \
        while read -r key; do
            if [[ -n "$key" ]] && [[ "$key" != "None" ]]; then
                aws s3 rm "s3://${AWS_S3_BUCKET}/${key}" --region "$AWS_REGION"
                log_info "Deleted old S3 backup: $key"
            fi
        done
    fi
    
    log_success "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_path=$1
    
    log_info "Verifying backup integrity..."
    
    # Check if file exists and is not empty
    if [[ ! -f "$backup_path" ]] || [[ ! -s "$backup_path" ]]; then
        log_error "Backup file is missing or empty"
        return 1
    fi
    
    # Verify compressed file integrity
    if [[ "$backup_path" == *.tar.gz ]]; then
        if tar -tzf "$backup_path" > /dev/null 2>&1; then
            log_success "Compressed backup integrity verified"
        else
            log_error "Compressed backup is corrupted"
            return 1
        fi
    fi
    
    # Verify encrypted file (basic check)
    if [[ "$backup_path" == *.enc ]]; then
        if file "$backup_path" | grep -q "data"; then
            log_success "Encrypted backup appears valid"
        else
            log_error "Encrypted backup may be corrupted"
            return 1
        fi
    fi
    
    return 0
}

# Generate backup report
generate_report() {
    local backup_path=$1
    local backup_size=$(du -h "$backup_path" | cut -f1)
    local backup_filename=$(basename "$backup_path")
    
    cat << EOF

=== Backup Report ===
Database: $DB_NAME
Backup File: $backup_filename
Backup Size: $backup_size
Backup Location: $backup_path
Timestamp: $(date)
Compression: $COMPRESS_BACKUPS
Encryption: $ENCRYPT_BACKUPS
Cloud Upload: $CLOUD_BACKUP_ENABLED

EOF
}

# Main backup function
perform_backup() {
    log_info "=== Starting database backup ==="
    log_info "Database: $DB_NAME"
    log_info "Host: $DB_HOST:$DB_PORT"
    
    local backup_name=$(generate_backup_filename)
    local backup_path
    
    # Create MongoDB backup
    if ! create_mongodb_backup "$backup_name"; then
        log_error "Backup failed during MongoDB dump"
        exit 1
    fi
    
    backup_path="${BACKUP_DIR}/${backup_name}"
    
    # Compress backup
    backup_path=$(compress_backup "$backup_name")
    if [[ $? -ne 0 ]]; then
        log_error "Backup failed during compression"
        exit 1
    fi
    
    # Encrypt backup
    backup_path=$(encrypt_backup "$backup_path")
    if [[ $? -ne 0 ]]; then
        log_error "Backup failed during encryption"
        exit 1
    fi
    
    # Verify backup integrity
    if ! verify_backup "$backup_path"; then
        log_error "Backup verification failed"
        exit 1
    fi
    
    # Upload to cloud storage
    if ! upload_to_cloud "$backup_path"; then
        log_warn "Cloud upload failed, but local backup is available"
    fi
    
    # Generate report
    generate_report "$backup_path"
    
    log_success "=== Backup completed successfully ==="
    log_info "Backup location: $backup_path"
}

# Restore function
restore_backup() {
    local backup_file=$1
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file path is required for restore"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "=== Starting database restore ==="
    log_info "Backup file: $backup_file"
    log_info "Target database: $DB_NAME"
    
    # Confirm restore operation
    read -p "This will overwrite the existing database. Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    local temp_dir=$(mktemp -d)
    local restore_path="$temp_dir/restore"
    
    # Decrypt if needed
    if [[ "$backup_file" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            log_error "Encryption key required to decrypt backup"
            exit 1
        fi
        
        log_info "Decrypting backup..."
        local decrypted_file="${backup_file%.enc}"
        if ! openssl enc -aes-256-cbc -d -in "$backup_file" -out "$decrypted_file" -k "$ENCRYPTION_KEY"; then
            log_error "Failed to decrypt backup"
            exit 1
        fi
        backup_file="$decrypted_file"
    fi
    
    # Decompress if needed
    if [[ "$backup_file" == *.tar.gz ]]; then
        log_info "Decompressing backup..."
        if ! tar -xzf "$backup_file" -C "$temp_dir"; then
            log_error "Failed to decompress backup"
            exit 1
        fi
        restore_path="$temp_dir"
    else
        restore_path="$backup_file"
    fi
    
    # Build mongorestore command
    local mongorestore_cmd="mongorestore"
    mongorestore_cmd+=" --host ${DB_HOST}:${DB_PORT}"
    mongorestore_cmd+=" --db ${DB_NAME}"
    mongorestore_cmd+=" --drop"
    mongorestore_cmd+=" --gzip"
    
    # Add authentication if provided
    if [[ -n "$DB_USERNAME" ]]; then
        mongorestore_cmd+=" --username ${DB_USERNAME}"
        if [[ -n "$DB_PASSWORD" ]]; then
            mongorestore_cmd+=" --password ${DB_PASSWORD}"
        fi
        mongorestore_cmd+=" --authenticationDatabase admin"
    fi
    
    mongorestore_cmd+=" ${restore_path}/${DB_NAME}"
    
    # Execute restore
    log_info "Restoring database..."
    if eval "$mongorestore_cmd"; then
        log_success "Database restore completed successfully"
    else
        log_error "Database restore failed"
        exit 1
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "=== Restore completed successfully ==="
}

# List available backups
list_backups() {
    log_info "=== Available Backups ==="
    
    # Local backups
    echo "Local backups:"
    if ls "${BACKUP_DIR}/${DB_NAME}_"* 2>/dev/null; then
        ls -lh "${BACKUP_DIR}/${DB_NAME}_"* | awk '{print $9, $5, $6, $7, $8}'
    else
        echo "No local backups found"
    fi
    
    echo ""
    
    # Cloud backups
    if [[ "$CLOUD_BACKUP_ENABLED" == "true" ]] && [[ -n "$AWS_S3_BUCKET" ]]; then
        echo "Cloud backups (S3):"
        aws s3 ls "s3://${AWS_S3_BUCKET}/dyad-gateway/backups/" --region "$AWS_REGION" 2>/dev/null || echo "No cloud backups found or AWS CLI not configured"
    fi
}

# Main execution
main() {
    local command="${1:-backup}"
    
    case "$command" in
        "backup")
            check_dependencies
            create_backup_dir
            perform_backup
            cleanup_old_backups
            ;;
        "restore")
            check_dependencies
            restore_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {backup|restore|list|cleanup}"
            echo "  backup           - Create a new backup"
            echo "  restore <file>   - Restore from backup file"
            echo "  list             - List available backups"
            echo "  cleanup          - Clean up old backups"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi