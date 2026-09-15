# SamadhanX (SIH 2026 — PS 26043) Production Deployment & Operations

This guide provides complete instructions for deploying and operating SamadhanX in staging and production environments.

---

## 1. Production Architecture Topology

```
                         [ Internet / Client Traffic ]
                                      │
                                      ▼
                           [ Nginx Reverse Proxy ]
                          (SSL / TLS Termination)
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
      [ Frontend Static Server ]               [ FastAPI Gateway Cluster ]
          (Port 5173 / Nginx)                       (Port 8000 / Uvicorn)
                                                           │
                                ┌──────────────────────────┼──────────────────────────┐
                                │                          │                          │
                                ▼                          ▼                          ▼
                     [ PostgreSQL 16 + pgvector ]     [ Redis 7 Cluster ]      [ Celery Worker(s) ]
                            (Port 5432)                   (Port 6379)           (Background Tasks)
```

---

## 2. Environment Variables Configuration

Create a `.env` file from `.env.example`:

| Variable | Description | Production Default / Example |
|---|---|---|
| `ENVIRONMENT` | Runtime mode (`development`, `staging`, `production`) | `production` |
| `SECRET_KEY` | High-entropy JWT signing key (Min 32 characters) | `openssl rand -hex 32` |
| `POSTGRES_SERVER` | PostgreSQL server hostname | `samadhanx-postgres` or RDS endpoint |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `samadhanx_db` |
| `POSTGRES_USER` | Database username | `postgres` |
| `POSTGRES_PASSWORD` | Strong database password | `SuperSecurePassword!` |
| `REDIS_URL` | Redis connection URL | `redis://samadhanx-redis:6379/0` |
| `CELERY_BROKER_URL` | Celery broker URL | `redis://samadhanx-redis:6379/1` |
| `CELERY_RESULT_BACKEND` | Celery result storage | `redis://samadhanx-redis:6379/2` |
| `SMTP_HOST` | Outgoing email server | `smtp.sendgrid.net` |
| `SMTP_PORT` | Outgoing SMTP port | `587` |
| `SMTP_USER` | SMTP username / API key | `apikey` |
| `SMTP_PASSWORD` | SMTP password | `<sendgrid-secret>` |
| `EMAILS_FROM_EMAIL` | Sender email address | `no-reply@samadhanx.gov.in` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | `https://samadhanx.gov.in` |

---

## 3. Docker Compose Production Deployment

### 3.1 Launch All Services
```bash
# Build and start all 5 containers in detached mode
docker compose -f docker-compose.yml up --build -d

# Verify all services are healthy
docker compose ps
```

### 3.2 Run Database Migrations
```bash
docker exec samadhanx-backend alembic upgrade head
```

### 3.3 Create Initial Platform Administrator
```bash
docker exec samadhanx-backend python -m app.commands.create_admin \
  --email admin@samadhanx.gov.in \
  --password SecureAdminPassword2026! \
  --first-name Admin \
  --last-name Desk
```

### 3.4 Ingest National AISHE Master Institutions
```bash
docker exec samadhanx-backend python -m app.commands.seed_institutions
```

---

## 4. Health Checks & Verification

| Check | Command / Endpoint | Expected Response |
|---|---|---|
| API Liveness | `curl -f http://localhost:8000/health/live` | `{"status": "alive"}` |
| API Readiness | `curl -f http://localhost:8000/health/ready` | `{"status": "ready", "database": "connected", "redis": "connected"}` |
| pgvector Engine | `curl -f http://localhost:8000/api/v1/system/pgvector-test` | `{"status": "ok", "similarity_score": ...}` |
| Celery Worker | `curl -f -X POST http://localhost:8000/api/v1/system/celery-test` | `{"status": "dispatched", "task_id": ...}` |

---

## 5. Backup & Disaster Recovery

### Database Backup
```bash
docker exec -t samadhanx-postgres pg_dump -U postgres samadhanx_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Database Restore
```bash
gunzip -c backup_20260915_120000.sql.gz | docker exec -i samadhanx-postgres psql -U postgres -d samadhanx_db
```
