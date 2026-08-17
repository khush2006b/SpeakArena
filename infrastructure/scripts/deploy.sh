#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Zero-Downtime Blue-Green Deployment Script
#
# Strategy:
#   1. Pull new Docker image
#   2. Run DB migrations with new image (before switching traffic)
#   3. Start new container (shadow, not yet receiving traffic)
#   4. Poll health endpoint until healthy (max 90s)
#   5. Switch Nginx upstream to new container
#   6. Drain in-flight requests (30s grace period)
#   7. Remove old container
#   8. Record deployment state for rollback
#
# Usage:
#   ./deploy.sh <git-sha>
#   GITHUB_REPOSITORY=org/repo ./deploy.sh abc1234
#
# Requirements:
#   - Docker with Compose plugin
#   - GHCR credentials configured
#   - /etc/speakarena/.env.prod exists
#   - /var/speakarena/ directory structure created by server-setup.sh
# =============================================================================

set -euo pipefail

# --- Config ---
GIT_SHA="${1:-latest}"
GHCR_IMAGE="ghcr.io/${GITHUB_REPOSITORY:-speakarena/speakarena}/backend"
NEW_IMAGE="${GHCR_IMAGE}:${GIT_SHA}"
COMPOSE_FILE="/var/speakarena/docker-compose.prod.yml"
ENV_FILE="/etc/speakarena/.env.prod"
STATE_DIR="/var/speakarena"
HEALTH_URL="http://localhost:8000/health/ready"
HEALTH_TIMEOUT=90
DRAIN_TIMEOUT=30

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [deploy] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# --- Preflight ---
[[ -f "${COMPOSE_FILE}" ]] || fail "Compose file not found: ${COMPOSE_FILE}"
[[ -f "${ENV_FILE}" ]]     || fail "Production env file not found: ${ENV_FILE}"
mkdir -p "${STATE_DIR}/scripts"

log "=== SpeakArena Deployment ==="
log "Image: ${NEW_IMAGE}"
log "Compose: ${COMPOSE_FILE}"

# --- Step 1: Record current image for rollback ---
CURRENT_IMAGE=$(docker inspect speakarena_api --format='{{.Config.Image}}' 2>/dev/null || echo "none")
echo "${CURRENT_IMAGE}" > "${STATE_DIR}/previous_image.txt"
log "Previous image: ${CURRENT_IMAGE}"

# --- Step 2: Pull new image ---
log "Pulling new image..."
docker pull "${NEW_IMAGE}" || fail "docker pull failed for: ${NEW_IMAGE}"

# --- Step 3: Run DB migrations BEFORE switching traffic ---
# This ensures the new schema is ready before the new code serves traffic.
# Migrations must be backward-compatible to support the old container during
# the brief overlap period.
log "Running database migrations..."
docker run --rm \
    --network speakarena_backend \
    --env-file "${ENV_FILE}" \
    "${NEW_IMAGE}" \
    alembic upgrade head \
    || fail "Migration failed — aborting deployment (old container still running)"
log "Migrations complete"

# --- Step 4: Start new container (not yet receiving traffic) ---
log "Starting new container (shadow)..."
docker run -d \
    --name speakarena_api_new \
    --network speakarena_backend \
    --network speakarena_frontend \
    --env-file "${ENV_FILE}" \
    --restart always \
    --log-driver json-file \
    --log-opt max-size=100m \
    --log-opt max-file=10 \
    "${NEW_IMAGE}" \
    || fail "Failed to start new container"

# --- Step 5: Wait for health check ---
log "Waiting for new container health (timeout: ${HEALTH_TIMEOUT}s)..."
elapsed=0
while true; do
    STATUS=$(docker exec speakarena_api_new \
        curl -fsS -o /dev/null -w '%{http_code}' \
        "${HEALTH_URL}" 2>/dev/null || echo "000")
    if [[ "${STATUS}" == "200" ]]; then
        log "Health check passed (HTTP ${STATUS}) after ${elapsed}s"
        break
    fi
    if [[ ${elapsed} -ge ${HEALTH_TIMEOUT} ]]; then
        log "Health check failed after ${HEALTH_TIMEOUT}s (last status: ${STATUS})"
        log "Removing failed container..."
        docker rm -f speakarena_api_new || true
        fail "New container failed health check — deployment aborted, old container still running"
    fi
    log "  Health: ${STATUS} (${elapsed}/${HEALTH_TIMEOUT}s)"
    sleep 5
    elapsed=$((elapsed + 5))
done

# --- Step 6: Switch Nginx upstream to new container ---
log "Switching Nginx upstream to new container..."
docker network disconnect speakarena_backend speakarena_api 2>/dev/null || true

# Update Nginx upstream config
docker exec speakarena_nginx \
    sed -i 's/server api:.*/server speakarena_api_new:8000 max_fails=3 fail_timeout=30s;/' \
    /etc/nginx/nginx.conf 2>/dev/null || true

docker exec speakarena_nginx nginx -t \
    || { log "Nginx config invalid after upstream switch!"; docker network connect speakarena_backend speakarena_api; fail "Nginx reload aborted"; }

docker exec speakarena_nginx nginx -s reload
log "Traffic switched to new container"

# --- Step 7: Drain in-flight requests ---
log "Draining in-flight requests (${DRAIN_TIMEOUT}s grace period)..."
sleep "${DRAIN_TIMEOUT}"

# --- Step 8: Remove old container ---
if [[ "${CURRENT_IMAGE}" != "none" ]]; then
    log "Stopping and removing old container..."
    docker stop speakarena_api --time=30 2>/dev/null || true
    docker rm speakarena_api 2>/dev/null || true
fi

# --- Step 9: Rename new container to canonical name ---
docker rename speakarena_api_new speakarena_api
log "Container renamed to speakarena_api"

# --- Step 10: Reconnect Nginx to canonical name ---
docker exec speakarena_nginx \
    sed -i 's/server speakarena_api_new:.*/server api:8000 max_fails=3 fail_timeout=30s;/' \
    /etc/nginx/nginx.conf 2>/dev/null || true
docker exec speakarena_nginx nginx -s reload

# --- Step 11: Record deployment state ---
echo "${NEW_IMAGE}" > "${STATE_DIR}/current_image.txt"
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "${STATE_DIR}/last_deploy.txt"
echo "${GIT_SHA}" > "${STATE_DIR}/current_sha.txt"

log "=== Deployment Successful ==="
log "Running image: ${NEW_IMAGE}"
