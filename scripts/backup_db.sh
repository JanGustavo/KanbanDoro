#!/bin/bash
# KanbanDoro Database Backup Script
# Runs daily via cron at 3 AM

set -euo pipefail

BACKUP_DIR="/opt/kanbandoro/backups/db"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/opt/kanbandoro/kanbandoro.db"
BACKUP_FILE="${BACKUP_DIR}/kanbandoro_${DATE}.db"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [[ ! -f "$DB_PATH" ]]; then
    echo "Database not found at $DB_PATH"
    exit 1
fi

# Create backup using SQLite backup API (safe for concurrent access)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "kanbandoro_*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${BACKUP_FILE}.gz"