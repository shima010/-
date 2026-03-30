#!/bin/bash
# Music School DB Backup Script

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/music-school}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-music_school_db}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log "Starting backup of database: $DB_NAME"
log "Backup file: $BACKUP_FILE"

# Run pg_dump
if PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "$BACKUP_FILE"; then
    log "Backup completed successfully: $BACKUP_FILE"
    log "File size: $(du -sh "$BACKUP_FILE" | cut -f1)"
else
    error "Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Remove old backups
log "Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
log "Cleanup completed"

# List remaining backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || warn "No backup files found"

log "Backup process finished"
