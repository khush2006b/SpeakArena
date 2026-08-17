#!/usr/bin/env bash
# =============================================================================
# SpeakArena — PostgreSQL Backup Script
#
# Performs a pg_dump of the production database, compresses it, and uploads
# it to Cloudflare R2 (via AWS CLI s3 API compatibility).
# Also maintains local retention: keeps 7 days of local backups.
#
# Cron schedule (example — run daily at 02:00 UTC):
#   0 2 * * * /var/speakarena/scripts/backup-db.sh >> /var/speakarena/logs/backup-db.log 2>&1
#
# Requirements:
#   - Docker running (uses postgres:16 image for pg_dump)
#   - AWS CLI v2 configured with R2 credentials (~/.aws/credentials or env vars)
#   - /etc/speakarena/.env.prod contains DB credentials
#   - R2 bucket: speakarena-backups
# =============================================================================

set -euo pipefail

# --- Load production environment ---
# shellcheck source=/dev/null
source /etc/speakarena/.env.prod 2>/dev/null || true

# --- Config ---
BACKUP_DIR="/var/speakarena/backups/postgres"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
BACKUP_FILE="speakarena_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
R2_BUCKET="${R2_BACKUP_BUCKET:-speakarena-backups}"
R2_PREFIX="postgres"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
RETENTION_DAYS=7

# Database connection (from env)
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-speakarena}"
DB_NAME="${POSTGRES_DB:-speakarena_db}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [backup-db] $*"; }
fail() { log "ERROR: $*"; exit 1; }

log "Starting database backup: ${BACKUP_FILE}"

# --- Create backup directory ---
mkdir -p "${BACKUP_DIR}"

# --- Perform pg_dump via Docker ---
log "Running pg_dump..."
PGPASSWORD="${DB_PASSWORD}" docker run --rm \
    --network speakarena_backend \
    -e PGPASSWORD="${DB_PASSWORD}" \
    postgres:16 \
    pg_dump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --format=plain \
        --no-password \
        --verbose \
    | gzip --best > "${BACKUP_PATH}"

BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
log "Backup created: ${BACKUP_PATH} (${BACKUP_SIZE})"

# --- Verify backup is not empty ---
[[ -s "${BACKUP_PATH}" ]] || fail "Backup file is empty! Aborting upload."

# --- Upload to Cloudflare R2 ---
log "Uploading to R2: s3://${R2_BUCKET}/${R2_PREFIX}/${BACKUP_FILE}"
aws s3 cp "${BACKUP_PATH}" \
    "s3://${R2_BUCKET}/${R2_PREFIX}/${BACKUP_FILE}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --storage-class STANDARD \
    --no-progress

log "Upload complete: s3://${R2_BUCKET}/${R2_PREFIX}/${BACKUP_FILE}"

# --- Prune old remote backups (keep last 30) ---
log "Pruning remote backups (keeping last 30)..."
OLD_REMOTE=$(aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
    --endpoint-url "${R2_ENDPOINT}" \
    | sort -k4 \
    | head -n -30 \
    | awk '{print $4}')

for key in ${OLD_REMOTE}; do
    [[ -n "${key}" ]] || continue
    log "Removing old remote backup: ${key}"
    aws s3 rm "s3://${R2_BUCKET}/${R2_PREFIX}/${key}" \
        --endpoint-url "${R2_ENDPOINT}"
done

# --- Prune old local backups ---
log "Pruning local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name 'speakarena_db_*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete

log "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
