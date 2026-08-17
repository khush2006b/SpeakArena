#!/usr/bin/env bash
# =============================================================================
# SpeakArena — Ubuntu 24.04 VPS Bootstrap Script
#
# Run this ONCE on a fresh Ubuntu 24.04 server to prepare it for deployment.
# Idempotent: safe to run multiple times.
#
# Usage (as root):
#   curl -fsSL https://raw.githubusercontent.com/speakarena/speakarena/main/infrastructure/scripts/server-setup.sh | bash
#
# Or copy and run:
#   bash infrastructure/scripts/server-setup.sh
# =============================================================================

set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [server-setup] $*"; }

log "Starting SpeakArena VPS bootstrap (Ubuntu 24.04)"

# --- Ensure running as root ---
[[ $(id -u) -eq 0 ]] || { log "ERROR: must be run as root"; exit 1; }

# =============================================================================
# 1. System updates and essential packages
# =============================================================================
log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl \
    wget \
    git \
    unzip \
    htop \
    ncdu \
    tmux \
    jq \
    fail2ban \
    ufw \
    logrotate \
    cron \
    ca-certificates \
    gnupg \
    lsb-release \
    net-tools \
    postgresql-client \
    redis-tools

log "System packages installed"

# =============================================================================
# 2. Docker Engine
# =============================================================================
if ! command -v docker &>/dev/null; then
    log "Installing Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log "Docker installed: $(docker --version)"
else
    log "Docker already installed: $(docker --version)"
fi

# =============================================================================
# 3. Create deploy user (non-root)
# =============================================================================
DEPLOY_USER="deployer"
if ! id "${DEPLOY_USER}" &>/dev/null; then
    log "Creating deploy user: ${DEPLOY_USER}"
    useradd \
        --system \
        --create-home \
        --shell /bin/bash \
        --groups docker \
        "${DEPLOY_USER}"
    # Generate SSH key pair for GitHub Actions
    mkdir -p /home/${DEPLOY_USER}/.ssh
    chmod 700 /home/${DEPLOY_USER}/.ssh
    touch /home/${DEPLOY_USER}/.ssh/authorized_keys
    chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys
    chown -R ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/.ssh
    log "User '${DEPLOY_USER}' created. Add SSH public key to: /home/${DEPLOY_USER}/.ssh/authorized_keys"
else
    log "Deploy user '${DEPLOY_USER}' already exists"
    usermod -aG docker "${DEPLOY_USER}" 2>/dev/null || true
fi

# =============================================================================
# 4. Directory structure
# =============================================================================
log "Creating /var/speakarena directory structure..."
mkdir -p \
    /var/speakarena/data/postgres \
    /var/speakarena/data/redis \
    /var/speakarena/logs/nginx \
    /var/speakarena/logs/app \
    /var/speakarena/ssl/www \
    /var/speakarena/ssl/live \
    /var/speakarena/backups/postgres \
    /var/speakarena/backups/redis \
    /var/speakarena/scripts

mkdir -p /etc/speakarena

chown -R ${DEPLOY_USER}:${DEPLOY_USER} /var/speakarena
chown root:root /etc/speakarena
chmod 700 /etc/speakarena

log "Directory structure created"

# =============================================================================
# 5. Firewall (UFW)
# =============================================================================
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP (Nginx)'
ufw allow 443/tcp   comment 'HTTPS (Nginx)'
ufw --force enable

log "UFW configured: SSH(22), HTTP(80), HTTPS(443) open"

# =============================================================================
# 6. Fail2ban — SSH brute force protection
# =============================================================================
log "Configuring Fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(syslog_backend)s
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2ban configured"

# =============================================================================
# 7. Kernel / sysctl optimizations
# =============================================================================
log "Applying kernel optimizations..."
cat > /etc/sysctl.d/99-speakarena.conf << 'EOF'
# Network optimizations for production
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File descriptors
fs.file-max = 2097152
fs.nr_open = 2097152

# Virtual memory
vm.overcommit_memory = 1
vm.swappiness = 10
EOF

sysctl --system -q
log "Kernel optimizations applied"

# =============================================================================
# 8. Logrotate for app logs
# =============================================================================
cat > /etc/logrotate.d/speakarena << 'EOF'
/var/speakarena/logs/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker exec speakarena_nginx nginx -s reopen 2>/dev/null || true
    endscript
}

/var/speakarena/logs/app/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
}
EOF

log "Logrotate configured"

# =============================================================================
# 9. Swap space (useful for small VPS)
# =============================================================================
if [[ ! -f /swapfile ]]; then
    log "Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "Swap configured: 2GB"
else
    log "Swap already exists"
fi

# =============================================================================
# Summary
# =============================================================================
log "Bootstrap complete!"
log ""
log "Next steps:"
log "  1. Add deploy SSH key to: /home/${DEPLOY_USER}/.ssh/authorized_keys"
log "  2. Copy /etc/speakarena/.env.prod (from your secrets manager)"
log "  3. Clone repo to /var/speakarena/"
log "  4. Run: bash infrastructure/scripts/ssl-init.sh your@email.com"
log "  5. Run: docker compose -f docker-compose.prod.yml up -d"
