#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Let's Encrypt Auto-Renewal Script
#
# Certbot automatically renews certificates 30 days before expiry.
# This script is called by cron daily at 03:00 UTC.
#
# Install cron job:
#   0 3 * * * /var/speakarena/scripts/ssl-renew.sh >> /var/speakarena/logs/ssl-renew.log 2>&1
# =============================================================================

set -euo pipefail

CERT_DIR="/var/speakarena/ssl"
WEBROOT="/var/speakarena/ssl/www"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ssl-renew] $*"; }

log "Starting certificate renewal check..."

# Attempt renewal (certbot only renews if within 30 days of expiry)
docker run --rm \
    -v "${CERT_DIR}:/etc/letsencrypt" \
    -v "${WEBROOT}:/var/www/certbot" \
    certbot/certbot renew \
        --webroot \
        --webroot-path=/var/www/certbot \
        --quiet \
        --deploy-hook "docker exec speakarena_nginx nginx -s reload"

log "Renewal check complete"

# Verify certificate expiry
EXPIRY=$(docker run --rm \
    -v "${CERT_DIR}:/etc/letsencrypt" \
    certbot/certbot certificates 2>/dev/null \
    | grep "Expiry Date" | head -1 | awk '{print $3}' || echo "unknown")

log "Certificate expiry: ${EXPIRY}"
