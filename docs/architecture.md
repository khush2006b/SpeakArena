# SpeakArena — Infrastructure Architecture

## Production Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      USERS                                  │
│               (browser, mobile app)                         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                     ┌─────────┴─────────┐
                     │    CLOUDFLARE    │
                     │  CDN + DDoS +   │
                     │   WAF + DNS     │
                     └─────────┬─────────┘
                               │
                    ┌────────┴────────┐
                    │                 │
              speakarena.com    api.speakarena.com
             (Next.js 15 app)   (FastAPI backend)
              │                        │
           VERCEL              ┌───────┴───────┐
                               │  Ubuntu VPS  │
                               │              │
                    ┌─────────┴─────────┐│
                    │    NGINX 1.27     ││
                    │  HTTPS + HTTP/2  ││
                    │  Rate Limiting   ││
                    │  WebSocket       ││
                    └─────────┬─────────┘│
                               ││
                    ┌────────┴─────────┐│
                    │   FASTAPI App    ││
                    │  Python 3.13    ││
                    │  Gunicorn + UV  ││
                    │  REST + WS API  ││
                    └───┬───────┬───┘│
                         │       │       │
              ┌─────────┴ ────── ┴──────┐ │
              │             │            │  │
       PostgreSQL 16    Redis 7      Cloudflare │
      ┌────────┐   ┌──────┐    R2 Storage │
      │Primary  │   │Cache │              │
      │+Indexes │   │Sess. │    (Videos,  │
      └────────┘   │PubSub│     PDFs,    │
                    │Rate  │  Attachments)│
                    └──────┘              │
                                           │
                    ┌───────────────────┘
```

---

## Component Breakdown

### Cloudflare
- **CDN**: Caches static content at edge nodes globally
- **DDoS Protection**: Automatic L3/L4/L7 mitigation
- **WAF**: Web Application Firewall rules
- **DNS**: Authoritative DNS with proxying
- **Real IP**: `CF-Connecting-IP` header passed to Nginx

### Vercel (Frontend)
- **Next.js 15** App Router with SSR/ISR
- Automatic deployments on push to `main`
- Edge Network globally distributed
- Environment variables managed via Vercel dashboard

### Nginx
- **Reverse proxy** to FastAPI upstream
- **HTTP/2** for multiplexed connections
- **WebSocket** upgrade for `/ws/chat/{room_id}`
- **Rate limiting**: Per-IP limits on auth, API, upload endpoints
- **Security headers**: HSTS, CSP, X-Frame-Options, etc.
- **SSL termination**: Let's Encrypt via Certbot
- **Gzip compression** for API responses

### FastAPI Application
- **Python 3.13** with Gunicorn + Uvicorn workers
- **Stateless**: All state in PostgreSQL or Redis
- **WebSocket**: Real-time chat (Redis Pub/Sub for multi-instance)
- **Background tasks**: FastAPI BackgroundTasks (Celery-ready stubs)
- **Sentry**: Error tracking + performance monitoring
- **Health endpoints**: `/health/live`, `/health/ready`, `/metrics`

### PostgreSQL 16
- **Production tuned**: `shared_buffers=2GB`, `effective_cache_size=6GB`
- **Extensions**: uuid-ossp, pgcrypto, pg_stat_statements, pg_trgm
- **Autovacuum**: Tuned for high write workload
- **Backups**: Daily `pg_dump` → gzip → Cloudflare R2

### Redis 7
- **Sessions**: JWT blacklist, token revocation
- **Pub/Sub**: WebSocket event broadcasting
- **Rate limiting**: Sliding window rate limit storage
- **Presence**: Online users, typing indicators
- **Cache**: Hot data (streamed URL cache, etc.)
- **Persistence**: AOF + RDB for durability
- **Backups**: Every 6 hours → Cloudflare R2

### Cloudflare R2
- **Video files**: Streaming via presigned URLs
- **PDF files**: Download via presigned URLs
- **Chat attachments**: Direct upload via presigned PUT
- **Assignment submissions**: Presigned PUT
- **Backups**: PostgreSQL dumps + Redis snapshots
- **Zero egress cost**: R2 charges no egress fees

---

## Network Security Model

```
Internet-facing:
  Port 80  (Nginx → Certbot ACME / redirect to 443)
  Port 443 (Nginx → FastAPI)

Docker internal only (not reachable from host):
  Port 8000 (FastAPI)
  Port 5432 (PostgreSQL)
  Port 6379 (Redis)

Firewall (UFW):
  ALLOW 22/tcp  (SSH)
  ALLOW 80/tcp  (HTTP)
  ALLOW 443/tcp (HTTPS)
  DENY all else
```

---

## Data Flow: Student Joins Live Chat

```
1. Student opens course chat in browser (Next.js)
2. Browser connects: WS wss://api.speakarena.com/ws/chat/{room_id}?token=<JWT>
3. Cloudflare passes request to Nginx
4. Nginx upgrades to WebSocket, proxies to FastAPI pod
5. FastAPI validates JWT, checks enrollment via PostgreSQL
6. FastAPI accepts WS, marks user online in Redis (ZSet)
7. Student sends message → FastAPI persists to PostgreSQL
8. FastAPI publishes event to Redis channel `chat:room:{room_id}`
9. All FastAPI pods subscribed to that channel receive the event
10. Each pod forwards event to connected WebSocket clients in that room
```

---

## Data Flow: Video Streaming

```
1. Student requests video: GET /api/v1/videos/{id}/stream
2. FastAPI checks enrollment + video visibility via PostgreSQL
3. FastAPI checks Redis cache for presigned URL (HIT: return cached URL)
4. MISS: FastAPI generates presigned GET URL from Cloudflare R2 (TTL: 1h)
5. FastAPI caches URL in Redis for 55 minutes
6. Student's browser fetches video directly from R2 (NOT through FastAPI)
7. Video streams from Cloudflare's global edge — zero FastAPI load
```
