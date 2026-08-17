# SpeakArena — Production Checklists

## Deployment Checklist

### Pre-Deployment
- [ ] All CI checks pass on the PR (quality, test, build)
- [ ] PR reviewed and approved
- [ ] Database migration reviewed (if any) — backward compatible?
- [ ] Environment variables updated in `/etc/speakarena/.env.prod` (if new vars added)
- [ ] Rollback plan documented for major changes
- [ ] Staging environment tested (if applicable)

### During Deployment
- [ ] Monitor GitHub Actions deployment job in real time
- [ ] Watch Nginx logs: `tail -f /var/speakarena/logs/nginx/access.log`
- [ ] Watch API logs: `docker logs speakarena_api --tail=50 -f`
- [ ] All smoke tests pass (automated)

### Post-Deployment
- [ ] Health endpoint returns 200: `curl https://api.speakarena.com/health/ready`
- [ ] Readiness endpoint returns 200: `curl https://api.speakarena.com/health/live`
- [ ] Login flow works end-to-end
- [ ] Critical user flows verified (if major release)
- [ ] Sentry release created and showing in dashboard
- [ ] Slack notification received
- [ ] No error spike in Sentry (monitor for 15 minutes)

---

## Security Checklist

### Server Hardening
- [ ] UFW enabled: only ports 22, 80, 443 open
- [ ] Fail2ban active and protecting SSH
- [ ] Root SSH login disabled (`PermitRootLogin no` in sshd_config)
- [ ] SSH password authentication disabled (`PasswordAuthentication no`)
- [ ] Docker daemon not exposed externally
- [ ] `/etc/speakarena/.env.prod` permissions: 600, owner root

### Application Security
- [ ] `DEBUG=false` in production environment
- [ ] `SECRET_KEY` is cryptographically random, 64+ chars
- [ ] `JWT_SECRET_KEY` is different from `SECRET_KEY`
- [ ] CORS origins restricted to production domains only
- [ ] All API keys rotated from development values
- [ ] Razorpay webhook secret set and validated
- [ ] Rate limiting active (verified in Nginx logs)
- [ ] Security headers present (verified by Mozilla Observatory)

### SSL/TLS
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] HSTS header present with `max-age=31536000; includeSubDomains; preload`
- [ ] TLS 1.2+ only (1.0 and 1.1 disabled)
- [ ] Certificate auto-renewal cron installed
- [ ] Certificate validity > 30 days
- [ ] SSL Labs score: A or A+

### Database Security
- [ ] PostgreSQL not exposed externally (Docker internal network only)
- [ ] Strong database password set
- [ ] Read-only user password changed from default
- [ ] pg_stat_statements extension enabled for query monitoring

---

## Performance Checklist

### Application
- [ ] `GUNICORN_WORKERS` set to `2 × CPU cores`
- [ ] Database connection pool sized correctly (DB_POOL_SIZE)
- [ ] Redis connection pool sized correctly
- [ ] All database indexes verified (run EXPLAIN ANALYZE on slow queries)
- [ ] N+1 query patterns checked and resolved

### Nginx
- [ ] Gzip compression enabled
- [ ] HTTP/2 active
- [ ] Keepalive connections to upstream configured
- [ ] Large file upload size configured (512MB for videos)

### Database
- [ ] `shared_buffers` set to 25% of RAM
- [ ] `effective_cache_size` set to 75% of RAM
- [ ] `random_page_cost=1.1` (for SSD)
- [ ] Autovacuum tuned for high write workload
- [ ] `pg_stat_statements` monitoring active

### Redis
- [ ] `maxmemory` set appropriately
- [ ] `maxmemory-policy: allkeys-lru` active
- [ ] AOF persistence enabled
- [ ] Slow log configured

---

## Monitoring Checklist

- [ ] `/health/live` endpoint returns 200
- [ ] `/health/ready` endpoint checks DB + Redis connectivity
- [ ] `/metrics` endpoint accessible for Prometheus (if enabled)
- [ ] Sentry DSN configured and receiving events
- [ ] Error rate baseline established
- [ ] Response time P95 baseline established
- [ ] Disk usage monitoring active (alert at 80%)
- [ ] Memory usage monitoring active (alert at 85%)
- [ ] CPU usage monitoring active (alert at 90%)
- [ ] Certificate expiry monitoring active
- [ ] Log rotation configured and working

---

## Backup Checklist

- [ ] `backup-db.sh` cron installed: `0 2 * * *`
- [ ] `backup-redis.sh` cron installed: `0 */6 * * *`
- [ ] Backup uploads verified in Cloudflare R2
- [ ] Test restore procedure completed at least once
- [ ] Backup retention policy set (7 days local, 30 days remote)
- [ ] Disaster recovery plan documented and tested

---

## Release Checklist

- [ ] CHANGELOG updated
- [ ] Version tag created in Git
- [ ] All feature flags reviewed
- [ ] Email templates tested (if email changes)
- [ ] Database migration rollback plan documented
- [ ] API breaking change documentation updated
- [ ] Frontend deployment on Vercel verified
- [ ] CDN cache purged (if applicable)
