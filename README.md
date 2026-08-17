# SpeakArena

> Production-grade education platform for programming, DSA, and interview preparation.  
> Expert-led courses · Live classes · Interactive community · Secure payments via Razorpay.

[![Backend CI](https://github.com/speakarena/speakarena/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/speakarena/speakarena/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/speakarena/speakarena/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/speakarena/speakarena/actions/workflows/frontend-ci.yml)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| State | TanStack Query, Zustand, React Hook Form + Zod |
| Backend | FastAPI, SQLAlchemy 2 (async), Alembic |
| Database | PostgreSQL 16 (UUIDv7 primary keys) |
| Cache / Realtime | Redis 7 (Pub/Sub, JWT blacklist, rate limiting) |
| Storage | Cloudflare R2 (presigned uploads) |
| Payments | Razorpay |
| Deployment | Docker, Nginx, Ubuntu VPS + Vercel |
| Monitoring | Sentry, structured JSON logging |

---

## Project Structure

```
speakarena/
├── frontend/          # Next.js 15 app → deployed to Vercel
├── backend/           # FastAPI app → deployed to VPS via Docker
├── infrastructure/    # Docker Compose, Nginx, deploy scripts
└── .github/workflows/ # GitHub Actions CI/CD
```

---

## Prerequisites

| Tool | Minimum Version |
|---|---|
| Docker | 24.x |
| Docker Compose | v2.x |
| Node.js | 22.x |
| Python | 3.12 |
| PostgreSQL client | 16 (for migrations) |

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/speakarena/speakarena.git
cd speakarena
```

### 2. Configure backend environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your secrets
```

### 3. Configure frontend environment

```bash
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local and fill in your values
```

### 4. Start infrastructure (PostgreSQL + Redis)

```bash
docker compose up db redis -d
```

### 5. Run database migrations

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
cd ..
```

### 6. Start the backend API

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is now available at: **http://localhost:8000**  
Interactive docs (development only): **http://localhost:8000/docs**

### 7. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is now available at: **http://localhost:3000**

---

## Running with Docker (full stack)

```bash
# Start DB + Redis + API only
docker compose up db redis api -d

# Start the full stack including the web app
docker compose --profile fullstack up -d
```

---

## Health Checks

| Endpoint | Description |
|---|---|
| `GET /health/live` | Liveness — process alive |
| `GET /health/ready` | Readiness — DB + Redis connected |
| `GET /health` | Full health — aggregated |

```bash
curl http://localhost:8000/health/ready
```

---

## Running Tests (Backend)

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## Linting & Type Checking

**Backend:**
```bash
cd backend
ruff check .          # Lint
ruff format --check . # Format check
mypy app/ --strict    # Type check
```

**Frontend:**
```bash
cd frontend
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run format:check  # Prettier
```

---

## Database Migrations

```bash
# Generate a new migration (after changing models)
alembic revision --autogenerate -m "add_users_table"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Check current migration state
alembic current
```

---

## Deployment

Deployment is automated via GitHub Actions on every merge to `main`.

**Manual deployment:**
```bash
ssh user@your-vps
/var/speakarena/scripts/deploy.sh <git-sha>
```

**Manual rollback:**
```bash
ssh user@your-vps
/var/speakarena/scripts/rollback.sh
```

See [`infrastructure/scripts/`](./infrastructure/scripts/) for full deployment scripts.

---

## Environment Variables

| File | Purpose |
|---|---|
| `backend/.env.example` | Backend environment template |
| `frontend/.env.example` | Frontend environment template |

**Never commit `.env` or `.env.local` files.** They are in `.gitignore`.

---

## Architecture

The full architecture is documented in the architecture files:

- `architecture.md` — v1.0 base architecture
- `architecture_review.md` — v2.0 Principal Architect review

Key architectural decisions:

- **UUIDv7** primary keys — monotonically increasing, B-tree friendly
- **Direct-to-R2** presigned uploads — API never proxies file bytes
- **WebSocket + Redis Pub/Sub** — real-time chat across multiple workers
- **JWT in-memory + Refresh in HttpOnly cookie** — XSS-safe token storage
- **Video lifecycle state machine** — `uploading → processing → ready → published`

---

## CI/CD Pipeline

| Trigger | Pipeline | Jobs |
|---|---|---|
| PR to `main` | `backend-ci.yml` | Lint → Type check → Security → Test → Docker build |
| PR to `main` | `frontend-ci.yml` | Type check → ESLint → Prettier → Build |
| Push to `main` | `deploy-prod.yml` | Build → Push GHCR → SSH Deploy → Smoke test → Slack |

---

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes following the coding standards in the architecture document
3. Run all tests and linting before pushing
4. Open a PR — CI must pass before merge
5. Squash and merge to `main`

---

## License

Proprietary — All rights reserved. © 2026 SpeakArena.
