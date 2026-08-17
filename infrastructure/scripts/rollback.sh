#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Emergency Rollback Script
#
# Switches back to the previously running image as fast as possible.
# Used by GitHub Actions auto-rollback job and manually by on-call engineers.
#
# Usage:
#   ./rollback.sh              # Rolls back to previous_image.txt
#   ./rollback.sh <image>     # Rolls back to a specific image tag
#
# Requirements:
#   - /var/speakarena/previous_image.txt must exist
#   - /etc/speakarena/.env.prod must exist
# =============================================================================

set -euo pipefail

# --- Config ---
STATE_DIR="/var/speakarena"
ENV_FILE="/etc/speakarena/.env.prod"
HEALTH_URL="http://localhost:8000/health/ready"
HEALTH_TIMEOUT=90
DRAIN_TIMEOUT=15

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [rollback] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# --- Determine rollback target ---
if [[ -n "${1:-}" ]]; then
    ROLLBACK_IMAGE="${1}"
    log "Rolling back to specified image: ${ROLLBACK_IMAGE}"
else
    [[ -f "${STATE_DIR}/previous_image.txt" ]] \
        || fail "No previous image recorded. Cannot rollback automatically."
    ROLLBACK_IMAGE=$(cat "${STATE_DIR}/previous_image.txt")
    [[ "${ROLLBACK_IMAGE}" != "none" ]] \
        || fail "Previous image is 'none'. No rollback target available."
    log "Rolling back to previous image: ${ROLLBACK_IMAGE}"
fi

[[ -f "${ENV_FILE}" ]] || fail "Production env file not found: ${ENV_FILE}"

CURRENT_IMAGE=$(docker inspect speakarena_api --format='{{.Config.Image}}' 2>/dev/null || echo "none")
log "Current (failing) image: ${CURRENT_IMAGE}"

# --- Pull rollback image ---
log "Pulling rollback image..."
docker pull "${ROLLBACK_IMAGE}" || fail "Failed to pull rollback image: ${ROLLBACK_IMAGE}"

# --- Start rollback container ---
log "Starting rollback container..."
docker run -d \
    --name speakarena_api_rollback \
    --network speakarena_backend \
    --network speakarena_frontend \
    --env-file "${ENV_FILE}" \
    --restart always \
    --log-driver json-file \
    --log-opt max-size=100m \
    --log-opt max-file=10 \
    "${ROLLBACK_IMAGE}" \
    || fail "Failed to start rollback container"

# --- Wait for health check ---
log "Waiting for rollback container health (timeout: ${HEALTH_TIMEOUT}s)..."
elapsed=0
while true; do
    STATUS=$(docker exec speakarena_api_rollback \
        curl -fsS -o /dev/null -w '%{http_code}' \
        "${HEALTH_URL}" 2>/dev/null || echo "000")
    if [[ "${STATUS}" == "200" ]]; then
        log "Rollback container healthy (HTTP ${STATUS}) after ${elapsed}s"
        break
    fi
    if [[ ${elapsed} -ge ${HEALTH_TIMEOUT} ]]; then
        docker rm -f speakarena_api_rollback || true
        fail "Rollback container failed health check! CRITICAL: no healthy API running."
    fi
    sleep 5
    elapsed=$((elapsed + 5))
done

# --- Switch Nginx upstream to rollback container ---
log "Switching traffic to rollback container..."
docker exec speakarena_nginx \
    sed -i 's/server api:.*/server speakarena_api_rollback:8000 max_fails=3 fail_timeout=30s;/' \
    /etc/nginx/nginx.conf 2>/dev/null || true
docker exec speakarena_nginx nginx -t
docker exec speakarena_nginx nginx -s reload

# --- Drain and remove failing container ---
log "Draining in-flight requests (${DRAIN_TIMEOUT}s)..."
sleep "${DRAIN_TIMEOUT}"

log "Removing failing container..."
docker stop speakarena_api --time=15 2>/dev/null || true
docker rm speakarena_api 2>/dev/null || true

# --- Rename rollback container to canonical name ---
docker rename speakarena_api_rollback speakarena_api

# --- Reconnect Nginx to canonical name ---
docker exec speakarena_nginx \
    sed -i 's/server speakarena_api_rollback:.*/server api:8000 max_fails=3 fail_timeout=30s;/' \
    /etc/nginx/nginx.conf 2>/dev/null || true
docker exec speakarena_nginx nginx -s reload

# --- Update state files ---
echo "${ROLLBACK_IMAGE}" > "${STATE_DIR}/current_image.txt"
echo "${CURRENT_IMAGE}" > "${STATE_DIR}/previous_image.txt"
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ROLLBACK to ${ROLLBACK_IMAGE}" >> "${STATE_DIR}/rollback.log"

log "=== Rollback Complete ==="
log "Running image: ${ROLLBACK_IMAGE}"
log "IMPORTANT: Investigate the failing image before redeploying!"
