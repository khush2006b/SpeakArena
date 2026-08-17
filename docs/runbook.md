# SpeakArena — Incident Response Runbook

## Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **P0 — Critical** | Production is completely down | 15 minutes | API returns 5xx, database unreachable, SSL expired |
| **P1 — High** | Core feature broken | 1 hour | Payment processing failing, login broken |
| **P2 — Medium** | Degraded performance | 4 hours | Slow API responses, chat lag, upload failures |
| **P3 — Low** | Minor issue | Next business day | UI bug, non-critical feature broken |

---

## Emergency Contacts

- **Slack**: `#incidents` channel (alert via webhook on deploy failure)
- **Sentry**: https://sentry.io/organizations/{org}/projects/
- **Server**: SSH as `deployer@<VPS_IP>`

---

## Runbook: API Completely Down (P0)

### Symptoms
- `https://api.speakarena.com/health/live` returns non-200 or times out
- Users cannot log in or access any API

### Diagnosis

```bash
# 1. Check container status
docker ps -a --filter name=speakarena

# 2. Check API logs
docker logs speakarena_api --tail=100

# 3. Check Nginx
docker logs speakarena_nginx --tail=50

# 4. Check disk space (full disk = common cause)
df -h

# 5. Check memory
free -h

# 6. Check API health directly (bypassing Nginx)
curl -fsS http://localhost:8000/health/live
```

### Resolution

```bash
# Option A: Restart API container
docker restart speakarena_api

# Option B: Rollback to previous image (if recent deploy caused outage)
/var/speakarena/infrastructure/scripts/rollback.sh

# Option C: Full stack restart
docker compose -f /var/speakarena/docker-compose.prod.yml --env-file /etc/speakarena/.env.prod restart

# Option D: If disk full — clean up Docker
docker system prune -f
df -h  # Verify space freed
```

---

## Runbook: Database Unreachable (P0)

### Symptoms
- `GET /health/ready` returns 503 or database error
- API logs show `OperationalError` or connection refused

### Diagnosis

```bash
# 1. Check PostgreSQL container
docker ps --filter name=speakarena_db
docker logs speakarena_db --tail=100

# 2. Test DB connectivity directly
docker exec speakarena_db pg_isready -U speakarena

# 3. Connect to DB manually
docker exec -it speakarena_db psql -U speakarena -d speakarena_db -c "SELECT 1;"

# 4. Check data volume
df -h /var/speakarena/data/postgres/
```

### Resolution

```bash
# Restart PostgreSQL
docker restart speakarena_db

# Wait for health check to pass, then restart API
sleep 30
docker restart speakarena_api

# If data corruption suspected — restore from backup:
bash /var/speakarena/infrastructure/scripts/restore-db.sh \
  /var/speakarena/backups/postgres/speakarena_db_<latest>.sql.gz
```

---

## Runbook: Redis Unreachable

### Symptoms
- Login fails (sessions use Redis)
- Chat WebSocket fails to connect
- Rate limiting broken

### Diagnosis

```bash
docker ps --filter name=speakarena_redis
docker logs speakarena_redis --tail=50
docker exec speakarena_redis redis-cli ping
docker exec speakarena_redis redis-cli info memory
```

### Resolution

```bash
# Restart Redis
docker restart speakarena_redis

# Verify
docker exec speakarena_redis redis-cli ping  # Should return PONG
curl https://api.speakarena.com/health/ready  # Should return 200
```

---

## Runbook: SSL Certificate Expired (P0)

### Symptoms
- Browser shows certificate error
- `curl https://api.speakarena.com` fails with SSL error

### Resolution

```bash
# Force certificate renewal
docker run --rm \
  -v /var/speakarena/ssl:/etc/letsencrypt \
  -v /var/speakarena/ssl/www:/var/www/certbot \
  certbot/certbot renew --force-renewal

# Reload Nginx
docker exec speakarena_nginx nginx -s reload

# Verify
curl -I https://api.speakarena.com/health/live
```

---

## Runbook: High Error Rate (P1)

### Diagnosis

```bash
# 1. Check API logs for errors
docker logs speakarena_api --tail=200 | grep -E '"level":"error"|ERROR|5[0-9]{2}'

# 2. Check Nginx access log for 5xx
tail -100 /var/speakarena/logs/nginx/access.log | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line)
        if d.get('status', 200) >= 500:
            print(d)
    except: pass
"

# 3. Check Sentry for error spikes
# https://sentry.io/organizations/{org}/

# 4. Check if a specific endpoint is failing
curl -v https://api.speakarena.com/health/ready
```

### Resolution

```bash
# Rollback if recent deploy caused errors
/var/speakarena/infrastructure/scripts/rollback.sh

# Or restart API to clear potential memory leak
docker restart speakarena_api
```

---

## Runbook: High Latency (P2)

### Diagnosis

```bash
# Check slow queries in PostgreSQL
docker exec -it speakarena_db psql -U speakarena -d speakarena_db -c "
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
"

# Check Redis memory and hit rate
docker exec speakarena_redis redis-cli info stats | grep -E 'keyspace_hits|keyspace_misses|evicted_keys'

# Check system resources
top -bn1 | head -20
free -h
iostat -x 1 5
```

### Resolution

```bash
# Scale Gunicorn workers (adjust env var and restart)
docker stop speakarena_api
docker run -d --name speakarena_api \
  --env GUNICORN_WORKERS=8 \
  ... (same args as docker-compose.prod.yml)

# OR: Increase Redis cache hit rate by reviewing hot paths
# OR: Add EXPLAIN ANALYZE to slow queries and add missing indexes
```

---

## Post-Incident Actions

1. **Timeline**: Document exact timestamps of detection, response, and resolution.
2. **Root cause**: Identify root cause (not just symptoms).
3. **Impact**: Estimate number of affected users and duration.
4. **Fix**: Document what was changed to resolve the incident.
5. **Prevention**: What monitoring/alerting would have caught this earlier?
6. **Blameless postmortem**: Share with the team within 24 hours.
