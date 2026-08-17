# SpeakArena — Backup & Restore Guide

## Backup Strategy

| Component | Method | Frequency | Retention | Location |
|-----------|--------|-----------|-----------|----------|
| PostgreSQL | `pg_dump` → gzip | Daily 02:00 UTC | 7d local, 30d R2 | R2 `speakarena-backups/postgres/` |
| Redis | `BGSAVE` → rdb.gz | Every 6 hours | 3d local | R2 `speakarena-backups/redis/` |
| Application config | Git | On change | Forever | GitHub |
| R2 Storage (media) | Native R2 redundancy | Continuous | Per R2 policy | Cloudflare R2 |

---

## Automated Backup Setup

### Install Cron Jobs

```bash
# As deployer user on VPS:
crontab -e
```

Add:
```cron
# Database backup daily at 02:00 UTC
0 2 * * * /var/speakarena/infrastructure/scripts/backup-db.sh >> /var/speakarena/logs/backup-db.log 2>&1

# Redis backup every 6 hours
0 */6 * * * /var/speakarena/infrastructure/scripts/backup-redis.sh >> /var/speakarena/logs/backup-redis.log 2>&1

# SSL certificate renewal check daily at 03:00 UTC
0 3 * * * /var/speakarena/infrastructure/scripts/ssl-renew.sh >> /var/speakarena/logs/ssl-renew.log 2>&1
```

### Verify Backups

```bash
# List recent local backups
ls -lh /var/speakarena/backups/postgres/
ls -lh /var/speakarena/backups/redis/

# List R2 backups
aws s3 ls s3://speakarena-backups/postgres/ \
  --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com \
  | tail -10

# Test backup integrity (decompress and inspect header)
zcat /var/speakarena/backups/postgres/speakarena_db_<timestamp>.sql.gz | head -30
```

---

## Database Restore Procedures

### Restore from Local Backup

```bash
bash /var/speakarena/infrastructure/scripts/restore-db.sh \
  /var/speakarena/backups/postgres/speakarena_db_<TIMESTAMP>.sql.gz
```

### Restore from R2 Backup

```bash
bash /var/speakarena/infrastructure/scripts/restore-db.sh \
  --from-r2 speakarena_db_<TIMESTAMP>.sql.gz
```

### Manual Restore (Emergency)

```bash
# 1. Stop API to prevent writes
docker stop speakarena_api

# 2. Drop and recreate database
docker exec -it speakarena_db psql -U speakarena -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'speakarena_db';
  DROP DATABASE IF EXISTS speakarena_db;
  CREATE DATABASE speakarena_db ENCODING 'UTF8';
"

# 3. Restore
zcat backup.sql.gz | docker exec -i speakarena_db \
  psql -U speakarena -d speakarena_db

# 4. Run migrations to ensure schema currency
IMAGE=$(cat /var/speakarena/current_image.txt)
docker run --rm \
  --network speakarena_backend \
  --env-file /etc/speakarena/.env.prod \
  "${IMAGE}" alembic upgrade head

# 5. Restart API
docker start speakarena_api
```

---

## Disaster Recovery Plan

### RTO (Recovery Time Objective): 4 hours
### RPO (Recovery Point Objective): 6 hours

### Scenario: VPS Destroyed or Unrecoverable

```bash
# 1. Provision new VPS (Ubuntu 24.04)
# 2. Run server-setup.sh
bash infrastructure/scripts/server-setup.sh

# 3. Configure secrets
cp /path/to/backup/.env.prod /etc/speakarena/.env.prod

# 4. Pull latest docker-compose.prod.yml from GitHub
git clone https://github.com/your-org/speakarena.git /var/speakarena

# 5. Pull and start containers
docker compose -f /var/speakarena/docker-compose.prod.yml --env-file /etc/speakarena/.env.prod up -d db redis

# 6. Restore latest database backup from R2
bash /var/speakarena/infrastructure/scripts/restore-db.sh \
  --from-r2 speakarena_db_<latest>.sql.gz

# 7. Start remaining services
docker compose -f /var/speakarena/docker-compose.prod.yml --env-file /etc/speakarena/.env.prod up -d

# 8. Provision SSL
bash infrastructure/scripts/ssl-init.sh your@email.com api.speakarena.com

# 9. Update DNS A record to new VPS IP

# 10. Run smoke tests
bash infrastructure/scripts/smoke-test.sh https://api.speakarena.com
```

---

## Testing Backups

Test restore quarterly on a staging server:

```bash
# On staging server:
bash restore-db.sh --from-r2 speakarena_db_<timestamp>.sql.gz
bash smoke-test.sh https://staging.speakarena.com
```

Document the test date and result in the team wiki.
