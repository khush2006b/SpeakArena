# SpeakArena — Scaling Strategy

## Overview

SpeakArena is designed for horizontal scalability. The architecture supports
growth from 1,000 to 1,000,000 concurrent users through well-defined scaling
milestones.

---

## Current Architecture (1K Users)

```
Internet → Cloudflare CDN → Nginx (1 server)
                                     |
                               [Single VPS]
                                /    |    \
                          FastAPI  Redis  PostgreSQL
                         (3 workers)
```

**Resources**: 4 CPU, 8GB RAM, 100GB SSD  
**Cost**: ~$40-80/month (Hetzner CX31 or DigitalOcean Droplet)

---

## Tier 1: 10K Users — Vertical + Caching

### Changes
- **Vertical scale VPS**: 8 CPU, 16GB RAM
- **Gunicorn workers**: 16 (2 × CPU)
- **Database tuning**: Increase `shared_buffers` to 4GB
- **Redis**: Dedicated Redis instance (separate server)
- **Read caching**: Add Redis caching for hot endpoints (course lists, user profiles)
- **CDN**: Route static assets + media through Cloudflare
- **PgBouncer**: Add connection pooler (PostgreSQL max_connections=100 limit)

### Cost Estimate
~$150/month

---

## Tier 2: 100K Users — Horizontal Scaling

### Infrastructure Changes

```
Internet → Cloudflare → Load Balancer (AWS ALB / Hetzner LB)
                                    |
              ┌───────────────────────────────┐
           API Pod 1            API Pod 2          API Pod N
           (FastAPI)            (FastAPI)           (FastAPI)
              └───────────────────────────────┘
                                    |
              ┌─────────────────────────┐
              │                         │
          Redis Cluster           PostgreSQL Primary
          (3-node HA)                    |
                                 PostgreSQL Read Replica(s)
```

### Key Changes
- **API**: 3-5 pods behind load balancer (NO sticky sessions — all state in Redis)
- **Redis**: Upgrade to Redis Cluster (3 shards × 2 replicas)
- **PostgreSQL**: Primary + 1 read replica (reads go to replica)
- **Deployments**: Blue-green across all pods simultaneously
- **WebSockets**: Work natively — Redis Pub/Sub broadcasts to all pods
- **File storage**: All files on Cloudflare R2 (not local disk)
- **Background jobs**: Migrate FastAPI BackgroundTasks to Celery + Redis broker
- **Session storage**: JWT tokens (stateless) + Redis blacklist (already implemented)

### Kubernetes Migration Path
```yaml
# k8s/deployment.yaml (example)
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### Cost Estimate
~$500-1000/month

---

## Tier 3: 1M Users — Cloud-Native

### Infrastructure

```
Internet
    ↓
Cloudflare (DDoS protection, CDN, WAF)
    ↓
AWS Application Load Balancer
    ↓
EKS Cluster (Kubernetes)
┌────────────────────────────────────────────┐
│  FastAPI pods (20-100 replicas)                  │
│  HPA: scale on CPU/RPS metrics                  │
│  WebSocket pods (separate deployment)            │
└────────────────────────────────────────────┘
         │                      │
  ElastiCache Redis      Amazon RDS Aurora PostgreSQL
  (cluster mode)         (Multi-AZ, with read replicas)
         │
  Celery Workers (SQS or Redis broker)
         │
  Cloudflare R2 (global object storage)
```

### Key Components
- **API**: Kubernetes HPA auto-scales 20-100 pods based on CPU/RPS
- **WebSockets**: Separate Kubernetes deployment, scales independently
- **Database**: Amazon RDS Aurora PostgreSQL (Multi-AZ, auto-scaling read replicas)
- **Cache**: Amazon ElastiCache Redis Cluster (6 nodes)
- **Queue**: Celery with SQS or Redis broker for all background tasks
- **Storage**: Cloudflare R2 (already global, zero-egress cost)
- **CI/CD**: ArgoCD for GitOps-based Kubernetes deployments
- **Monitoring**: Datadog or Grafana Cloud + Prometheus

### Cost Estimate
~$5,000-20,000/month (depending on workload patterns)

---

## WebSocket Scaling Notes

SpeakArena's WebSocket system is already multi-instance safe:

- **Redis Pub/Sub** broadcasts events to ALL pods — no sticky sessions needed
- Each pod subscribes to relevant Redis channels on WS connect
- Presence state stored in Redis ZSets (O(1) reads, shared across pods)
- Zero WebSocket-specific changes needed to scale horizontally

---

## Database Scaling Notes

| Stage | Strategy |
|-------|----------|
| 1K | Single PostgreSQL + tuned config |
| 10K | PgBouncer + vertical scale |
| 100K | Primary + 1 read replica, PgBouncer per pod |
| 1M | Aurora Serverless v2 + auto-scaling read replicas |

---

## Read vs Write Separation

Slowly migrate heavy read endpoints to use the read replica:

```python
# Future: route-level read replica support
async def get_courses(db: AsyncSession = Depends(get_db_session_read_only)):
    ...
```

All write operations continue to use the primary.
