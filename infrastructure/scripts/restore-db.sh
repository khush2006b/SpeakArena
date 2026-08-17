#!/usr/bin/env bash
# =============================================================================
# SpeakArena — PostgreSQL Restore Script
#
# Restores a PostgreSQL backup from a .sql.gz file (local or from R2).
# WARNING: This is a destructive operation. The target database will be
# dropped and recreated from the backup.
#
# Usage:
#   # Restore from local file:
#   bash restore-db.sh /var/speakarena/backups/postgres/speakarena_db_2026-08-01T02-00-00Z.sql.gz
#
#   # Restore from R2 (downloads first):
#   bash restore-db.sh --from-r2 speakarena_db_2026-08-01T02-00-00Z.sql.gz
# =============================================================================

set -euo pipefail

# --- Load production environment ---
# shellcheck source=/dev/null
source /etc/speakarena/.env.prod 2>/dev/null || true

# --- Config ---
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-speakarena}"
DB_NAME="${POSTGRES_DB:-speakarena_db}"
DB_PASSWORD="${POSTGRES_PASSWORD}"
R2_BUCKET="${R2_BACKUP_BUCKET:-speakarena-backups}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
TEMP_DIR="/tmp/speakarena-restore-$$"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [restore-db] $*"; }
fail() { log "ERROR: $*"; exit 1; }
warn() { log "WARNING: $*"; }

# --- Parse arguments ---
FROM_R2=false
BACKUP_FILE=""

if [[ "${1:-}" == "--from-r2" ]]; then
    FROM_R2=true
    BACKUP_FILE="${2:-}"
else
    BACKUP_FILE="${1:-}"
fi

[[ -n "${BACKUP_FILE}" ]] || fail "Usage: $0 [--from-r2] <backup-file>"

# --- Safety confirmation ---
log "==========================================================="
log "⚠️  WARNING: Database restore is a DESTRUCTIVE operation!"
log "  Target database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
log "  Backup file: ${BACKUP_FILE}"
log "==========================================================="
read -rp "Type 'RESTORE' to confirm: " CONFIRM
[[ "${CONFIRM}" == "RESTORE" ]] || { log "Aborted"; exit 0; }

mkdir -p "${TEMP_DIR}"
cleanup() { rm -rf "${TEMP_DIR}"; }
trap cleanup EXIT

# --- Download from R2 if needed ---
if [[ "${FROM_R2}" == true ]]; then
    log "Downloading backup from R2..."
    R2_KEY="postgres/${BACKUP_FILE}"
    LOCAL_PATH="${TEMP_DIR}/${BACKUP_FILE}"
    aws s3 cp \
        "s3://${R2_BUCKET}/${R2_KEY}" \
        "${LOCAL_PATH}" \
        --endpoint-url "${R2_ENDPOINT}"
    BACKUP_FILE="${LOCAL_PATH}"
    log "Downloaded: ${LOCAL_PATH}"
else
    [[ -f "${BACKUP_FILE}" ]] || fail "Backup file not found: ${BACKUP_FILE}"
fi

# --- Pre-restore: create a safety backup of current state ---
log "Creating pre-restore safety backup..."
SAFETY_BACKUP="${TEMP_DIR}/pre-restore-safety-backup.sql.gz"
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
    | gzip --best > "${SAFETY_BACKUP}" || warn "Pre-restore safety backup failed (database may be empty)"

log "Safety backup created: ${SAFETY_BACKUP}"

# --- Stop the API to prevent writes during restore ---
log "Stopping API containers..."
docker stop speakarena_api 2>/dev/null || true

# --- Restore ---
log "Restoring database from: ${BACKUP_FILE}"
PGPASSWORD="${DB_PASSWORD}" docker run --rm \
    --network speakarena_backend \
    -e PGPASSWORD="${DB_PASSWORD}" \
    -v "${BACKUP_FILE}:/backup.sql.gz:ro" \
    postgres:16 \
    sh -c '
        # Drop all connections to the database
        psql --host="'"${DB_HOST}"'" --port="'"${DB_PORT}"'" --username="'"${DB_USER}"'" postgres \
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"'"'"${DB_NAME}"'"'"' AND pid <> pg_backend_pid();"
        # Drop and recreate
        psql --host="'"${DB_HOST}"'" --port="'"${DB_PORT}"'" --username="'"${DB_USER}"'" postgres \
            -c "DROP DATABASE IF EXISTS '"'"'"${DB_NAME}"'"'"';"
        psql --host="'"${DB_HOST}"'" --port="'"${DB_PORT}"'" --username="'"${DB_USER}"'" postgres \
            -c "CREATE DATABASE '"'"'"${DB_NAME}"'"'"' ENCODING '"'"'UTF8'"'"';"
        # Restore
        zcat /backup.sql.gz | psql \
            --host="'"${DB_HOST}"'" \
            --port="'"${DB_PORT}"'" \
            --username="'"${DB_USER}"'" \
            --dbname="'"${DB_NAME}"'"
    '

log "Database restored successfully!"

# --- Run migrations to ensure schema is current ---
log "Running Alembic migrations..."
IMAGE=$(cat /var/speakarena/current_image.txt 2>/dev/null || echo "ghcr.io/speakarena/speakarena/backend:latest")
docker run --rm \
    --network speakarena_backend \
    --env-file /etc/speakarena/.env.prod \
    "${IMAGE}" \
    alembic upgrade head

# --- Restart API ---
log "Restarting API..."
docker start speakarena_api 2>/dev/null || true

log "Restore complete. Database is live."
log "Safety backup retained at: ${SAFETY_BACKUP}"
