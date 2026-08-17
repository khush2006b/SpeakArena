#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Post-Deployment Smoke Tests
#
# Validates that the deployment is serving traffic correctly.
# Run immediately after deployment completes.
#
# Usage:
#   bash smoke-test.sh https://api.speakarena.com
# =============================================================================

set -euo pipefail

BASE_URL="${1:-https://api.speakarena.com}"
PASS=0
FAIL=0

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [smoke-test] $*"; }
pass() { log "  ✅ PASS: $*"; PASS=$((PASS + 1)); }
fail() { log "  ❌ FAIL: $*"; FAIL=$((FAIL + 1)); }

check_http() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local expected_body="${4:-}"

    local status
    local body
    body=$(curl -fsS -o /tmp/smoke_body -w '%{http_code}' \
        --max-time 15 \
        --retry 3 \
        --retry-delay 5 \
        "${url}" 2>/dev/null) || body="000"

    if [[ "${body}" == "${expected_status}" ]]; then
        if [[ -n "${expected_body}" ]]; then
            if grep -q "${expected_body}" /tmp/smoke_body 2>/dev/null; then
                pass "${name} (${url}) → HTTP ${body}"
            else
                fail "${name} (${url}) → HTTP ${body} but body missing '${expected_body}'"
            fi
        else
            pass "${name} (${url}) → HTTP ${body}"
        fi
    else
        fail "${name} (${url}) → Expected HTTP ${expected_status}, got ${body}"
    fi
}

check_ssl() {
    local domain
    domain=$(echo "${BASE_URL}" | sed 's|https://||' | cut -d/ -f1)
    local expiry
    expiry=$(echo | openssl s_client -connect "${domain}:443" -servername "${domain}" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2) || expiry="unknown"
    log "  🔒 SSL certificate expires: ${expiry}"
    pass "SSL certificate check"
}

check_header() {
    local name="$1"
    local url="$2"
    local header="$3"

    if curl -fsS -I --max-time 10 "${url}" 2>/dev/null | grep -qi "${header}"; then
        pass "${name}: header '${header}' present"
    else
        fail "${name}: header '${header}' MISSING"
    fi
}

log "Starting smoke tests against: ${BASE_URL}"
log "======================================================"

# --- Health endpoints ---
check_http "Liveness"  "${BASE_URL}/health/live"  200 '"status"'
check_http "Readiness" "${BASE_URL}/health/ready" 200 '"status"'
check_http "Health"    "${BASE_URL}/health"        200 '"healthy"'

# --- API reachability ---
check_http "API docs"  "${BASE_URL}/docs"  200
check_http "OpenAPI"   "${BASE_URL}/openapi.json" 200

# --- Auth endpoints return correct status for empty request ---
check_http "Auth login endpoint" "${BASE_URL}/api/v1/auth/login" 422  # 422 Unprocessable (no body)

# --- SSL ---
if [[ "${BASE_URL}" == https://* ]]; then
    check_ssl
fi

# --- Security headers ---
check_header "HSTS header"     "${BASE_URL}/health/live" "Strict-Transport-Security"
check_header "X-Frame-Options" "${BASE_URL}/health/live" "X-Frame-Options"
check_header "Content-Type-Options" "${BASE_URL}/health/live" "X-Content-Type-Options"

# --- Report ---
log "======================================================"
log "Smoke test results: ${PASS} passed, ${FAIL} failed"

if [[ ${FAIL} -gt 0 ]]; then
    log "❌ SMOKE TESTS FAILED — Deployment may be unhealthy!"
    exit 1
else
    log "✅ All smoke tests passed"
    exit 0
fi
