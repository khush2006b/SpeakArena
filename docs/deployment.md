# SpeakArena — Deployment Guide

## Overview

SpeakArena uses a zero-downtime, blue-green deployment strategy:

- **Frontend**: Deployed automatically to **Vercel** on push to `main`.
- **Backend**: Docker container deployed to a **Ubuntu 24.04 VPS** via GitHub Actions + SSH.
- **Database**: PostgreSQL 16 on Docker, persisted via bind-mounted host volume.
- **Redis**: Redis 7 on Docker, persisted with AOF + RDB.
- **Proxy**: Nginx 1.27 with Let's Encrypt TLS (auto-renewed).

---

## Prerequisites

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 40 GB SSD | 100+ GB SSD |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Open Ports | 22, 80, 443 | 22, 80, 443 |

### DNS Configuration

Point these DNS A records to your VPS IP before deploying:

```
api.speakarena.com   A   <VPS_IP>
```

---

## Initial Server Setup

### Step 1: Bootstrap the VPS

```bash
# As root:
curl -fsSL https://raw.githubusercontent.com/your-org/speakarena/main/infrastructure/scripts/server-setup.sh | bash
```

This script:
- Updates system packages
- Installs Docker Engine + Compose plugin
- Creates `deployer` user with Docker access
- Creates `/var/speakarena/` directory structure
- Configures UFW firewall (22/80/443)
- Configures Fail2ban (SSH brute force)
- Applies kernel optimizations
- Creates 2GB swap

### Step 2: Add Deploy SSH Key

On your local machine:
```bash
ssh-keygen -t ed25519 -C "speakarena-deploy" -f ~/.ssh/speakarena_deploy
cat ~/.ssh/speakarena_deploy.pub
```

On the VPS:
```bash
echo "<paste-public-key>" >> /home/deployer/.ssh/authorized_keys
```

Add the **private key** (`~/.ssh/speakarena_deploy`) to GitHub Secrets as `VPS_SSH_KEY`.

### Step 3: Configure Production Secrets

```bash
# On VPS (as root):
cp /var/speakarena/infrastructure/backend/.env.prod.example /etc/speakarena/.env.prod
chmod 600 /etc/speakarena/.env.prod
vim /etc/speakarena/.env.prod    # Fill in all values
```

### Step 4: GitHub Container Registry Login

```bash
# On VPS as deployer:
docker login ghcr.io -u <github-username> -p <github-PAT-with-packages:read>
```

### Step 5: Initial SSL Certificate

```bash
# On VPS:
bash /var/speakarena/infrastructure/scripts/ssl-init.sh your@email.com api.speakarena.com
```

### Step 6: First Deploy

```bash
# On VPS:
export GITHUB_REPOSITORY=your-org/speakarena
export IMAGE_TAG=latest
docker compose -f /var/speakarena/docker-compose.prod.yml --env-file /etc/speakarena/.env.prod up -d
```

---

## GitHub Actions Setup

### Required Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Production server IP or hostname |
| `VPS_USER` | SSH username (`deployer`) |
| `VPS_SSH_KEY` | Ed25519 private key |
| `GHCR_TOKEN` | GitHub PAT with `packages:write` |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `SENTRY_AUTH_TOKEN` | Sentry auth token |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |

### Required Environments

Create a **`production`** environment in:
Repository → Settings → Environments → New environment

Add protection rules:
- Required reviewers: 1 (optional but recommended)
- Wait timer: 0 minutes

---

## Deployment Flow

```
Pull Request → backend-ci.yml runs:
  └─ quality  (lint, type check, security scan)
  └─ test     (unit + integration, ≥80% coverage)
  └─ build    (Docker build + Trivy scan)

Merge to main → deploy-prod.yml runs:
  └─ build-push    (Build + push to GHCR)
  └─ deploy        (SSH to VPS, run deploy.sh)
  └─ smoke-test    (Validate /health endpoints + SSL + headers)
  └─ sentry-release (Mark release in Sentry)
  └─ notify        (Slack success/failure)
  └─ rollback      (Automatic if smoke tests fail)
```

---

## Manual Deployment

```bash
# SSH into VPS as deployer:
ssh deployer@<VPS_IP>

# Deploy a specific image tag:
GITHUB_REPOSITORY=your-org/speakarena \
  /var/speakarena/infrastructure/scripts/deploy.sh <git-sha>

# Rollback to previous image:
/var/speakarena/infrastructure/scripts/rollback.sh
```

---

## Database Migrations

Migrations run **automatically** as part of `deploy.sh` before traffic is switched.

```bash
# Manual migration (on VPS):
IMAGE=$(cat /var/speakarena/current_image.txt)
docker run --rm \
  --network speakarena_backend \
  --env-file /etc/speakarena/.env.prod \
  "${IMAGE}" \
  alembic upgrade head

# Downgrade:
docker run --rm \
  --network speakarena_backend \
  --env-file /etc/speakarena/.env.prod \
  "${IMAGE}" \
  alembic downgrade -1
```

---

## Monitoring Containers

```bash
# Container status:
docker compose -f /var/speakarena/docker-compose.prod.yml ps

# API logs:
docker logs speakarena_api --tail=100 -f

# Nginx logs:
tail -f /var/speakarena/logs/nginx/access.log

# DB logs:
docker logs speakarena_db --tail=50

# Health check:
curl -s https://api.speakarena.com/health/ready | python3 -m json.tool
```

---

## Updating Nginx Config

```bash
# Test new config:
docker exec speakarena_nginx nginx -t

# Reload (zero-downtime):
docker exec speakarena_nginx nginx -s reload
```

---

## Updating SSL Certificates

```bash
# Force renewal:
docker run --rm \
  -v /var/speakarena/ssl:/etc/letsencrypt \
  -v /var/speakarena/ssl/www:/var/www/certbot \
  certbot/certbot renew --force-renewal

docker exec speakarena_nginx nginx -s reload

# Check expiry:
docker run --rm -v /var/speakarena/ssl:/etc/letsencrypt certbot/certbot certificates
```
