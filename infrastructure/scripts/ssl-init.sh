#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Let's Encrypt Initial Certificate Provisioning
#
# Run this ONCE on a fresh server to obtain the first SSL certificate.
# Subsequent renewals are handled automatically by the certbot container.
#
# Prerequisites:
#   - DNS A record for api.speakarena.com points to this server
#   - Ports 80 and 443 open in firewall
#   - Docker and Docker Compose installed
#   - /var/speakarena/ssl/www directory exists
#
# Usage:
#   sudo bash infrastructure/scripts/ssl-init.sh your@email.com api.speakarena.com
# =============================================================================

set -euo pipefail

EMAIL="${1:-}"
DOMAIN="${2:-api.speakarena.com}"
WEBROOT="/var/speakarena/ssl/www"
CERT_DIR="/var/speakarena/ssl"
COMPOSE_FILE="/var/speakarena/docker-compose.prod.yml"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ssl-init] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# Validate inputs
[[ -n "${EMAIL}" ]] || fail "Usage: $0 <email> [domain]"

log "Starting SSL certificate provisioning for domain: ${DOMAIN}"
log "Contact email: ${EMAIL}"

# --- Step 1: Create required directories ---
log "Creating directory structure..."
mkdir -p "${WEBROOT}" "${CERT_DIR}/live/${DOMAIN}"

# --- Step 2: Deploy SSL-init nginx config (HTTP only) ---
log "Switching Nginx to HTTP-only provisioning mode..."
if [[ -f "/etc/nginx/conf.d/speakarena.conf" ]]; then
    cp /etc/nginx/conf.d/speakarena.conf /etc/nginx/conf.d/speakarena.conf.bak
    rm /etc/nginx/conf.d/speakarena.conf
fi

# Ensure the init config is active
if [[ ! -f "/etc/nginx/conf.d/speakarena-ssl-init.conf" ]]; then
    fail "SSL init config not found at /etc/nginx/conf.d/speakarena-ssl-init.conf"
fi

# --- Step 3: Start (or reload) Nginx in provisioning mode ---
if docker ps --format '{{.Names}}' | grep -q speakarena_nginx; then
    log "Reloading Nginx..."
    docker exec speakarena_nginx nginx -s reload
else
    log "Starting Nginx in provisioning mode..."
    docker compose -f "${COMPOSE_FILE}" up -d nginx
    sleep 5
fi

# --- Step 4: Obtain certificate from Let's Encrypt ---
log "Running Certbot to obtain certificate..."
docker run --rm \
    -v "${CERT_DIR}:/etc/letsencrypt" \
    -v "${WEBROOT}:/var/www/certbot" \
    certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "${EMAIL}" \
        --agree-tos \
        --no-eff-email \
        --domain "${DOMAIN}" \
        --rsa-key-size 4096 \
        --non-interactive \
        || fail "Certbot failed to obtain certificate"

log "Certificate issued successfully!"
log "Certificate location: ${CERT_DIR}/live/${DOMAIN}/"

# --- Step 5: Restore production Nginx config ---
log "Restoring production Nginx configuration..."
if [[ -f "/etc/nginx/conf.d/speakarena.conf.bak" ]]; then
    mv /etc/nginx/conf.d/speakarena.conf.bak /etc/nginx/conf.d/speakarena.conf
elif [[ -f "$(dirname "${BASH_SOURCE[0]}")/../nginx/conf.d/speakarena.conf" ]]; then
    cp "$(dirname "${BASH_SOURCE[0]}")/../nginx/conf.d/speakarena.conf" \
       /etc/nginx/conf.d/speakarena.conf
fi

# Test Nginx config before reloading
docker exec speakarena_nginx nginx -t \
    || fail "Nginx config test failed after restoring production config"

docker exec speakarena_nginx nginx -s reload
log "Nginx reloaded with production HTTPS config"

# --- Step 6: Set up auto-renewal cron ---
log "Installing auto-renewal cron job..."
RENEW_SCRIPT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/ssl-renew.sh")"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "ssl-renew.sh"; then
    (
        crontab -l 2>/dev/null || true
        echo "0 3 * * * ${RENEW_SCRIPT} >> /var/speakarena/logs/ssl-renew.log 2>&1"
    ) | crontab -
    log "Cron job installed: runs daily at 03:00 UTC"
else
    log "Cron job already exists — skipping"
fi

log "SSL provisioning complete!"
log "Your API is now available at: https://${DOMAIN}"
