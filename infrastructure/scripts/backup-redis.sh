#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Redis Backup Script
#
# Triggers a BGSAVE on the running Redis container, waits for completion,
# copies the dump.rdb file, compresses it, and uploads to Cloudflare R2.
#
# Cron schedule (every 6 hours):
#   0 */6 * * * /var/speakarena/scripts/backup-redis.sh >> /var/speakarena/logs/backup-redis.log 2>&1
# =============================================================================

set -euo pipefail

# --- Load production environment ---
# shellcheck source=/dev/null
source /etc/speakarena/.env.prod 2>/dev/null || true

# --- Config ---
BACKUP_DIR="/var/speakarena/backups/redis"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
BACKUP_FILE="speakarena_redis_${TIMESTAMP}.rdb.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
R2_BUCKET="${R2_BACKUP_BUCKET:-speakarena-backups}"
R2_PREFIX="redis"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
RETENTION_DAYS=3
REDIS_CONTAINER="speakarena_redis"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [backup-redis] $*"; }
fail() { log "ERROR: $*"; exit 1; }

log "Starting Redis backup: ${BACKUP_FILE}"

mkdir -p "${BACKUP_DIR}"

# --- Trigger BGSAVE ---
log "Triggering BGSAVE on Redis container..."
docker exec "${REDIS_CONTAINER}" redis-cli BGSAVE

# --- Wait for BGSAVE to complete ---
log "Waiting for BGSAVE to complete..."
for i in $(seq 1 60); do
    STATUS=$(docker exec "${REDIS_CONTAINER}" redis-cli LASTSAVE 2>/dev/null)
    CURRENT=$(date +%s)
    # If LASTSAVE timestamp is within last 120s, save is done
    if [[ $((CURRENT - STATUS)) -lt 120 ]]; then
        BUSY=$(docker exec "${REDIS_CONTAINER}" redis-cli INFO persistence 2>/dev/null | grep rdb_bgsave_in_progress | cut -d: -f2 | tr -d '\r')
        [[ "${BUSY}" == "0" ]] && break
    fi
    sleep 2
done

log "BGSAVE complete"

# --- Copy and compress dump.rdb ---
log "Copying dump.rdb from container..."
docker cp "${REDIS_CONTAINER}:/data/dump.rdb" - | gzip --best > "${BACKUP_PATH}"

BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
log "Backup created: ${BACKUP_PATH} (${BACKUP_SIZE})"

[[ -s "${BACKUP_PATH}" ]] || fail "Backup file is empty!"

# --- Upload to R2 ---
log "Uploading to R2: s3://${R2_BUCKET}/${R2_PREFIX}/${BACKUP_FILE}"
aws s3 cp "${BACKUP_PATH}" \
    "s3://${R2_BUCKET}/${R2_PREFIX}/${BACKUP_FILE}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --no-progress

log "Upload complete"

# --- Prune old local backups ---
find "${BACKUP_DIR}" -name 'speakarena_redis_*.rdb.gz' -mtime +"${RETENTION_DAYS}" -delete

log "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
