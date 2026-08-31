# SamadhanX 🇮🇳
> **Smart India Hackathon 2026 (Problem Statement: SIH 26043)**  
> *An AI-powered digital platform connecting communities, universities, students, faculty, NGOs, government organizations, and industry to turn real-world societal problems into collaborative solutions and measurable impact.*

---

## 🏛️ System Architecture

```
                    React 18 + Vite + TypeScript Frontend
                                     |
                                     v
                       FastAPI Application Gateway
            (Lifespan, OpenAPI, Security Headers, Correlation IDs)
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
     PostgreSQL 16 + pgvector                         Redis 7
 (SQLAlchemy 2.0 + Alembic)                  (Broker, Backend, Cache)
              |                                             |
              |                                             v
              |                                       Celery Worker
              |                                     (Async Execution)
              +----------------------+----------------------+
                                     |
                             [Future AI Layer]
                         (LangGraph / Embeddings)
```

---

## 🚀 Quick Start (Docker)

The fastest and most reproducible way to run the complete SamadhanX foundation:

### 1. Clone & Prepare Environment
```bash
cp .env.example .env
```

### 2. Launch All Services
```bash
docker compose up --build -d
```

### 3. Verify Container Status
```bash
docker compose ps
```

All 5 core services will initialize with automatic healthchecks:
- `samadhanx-frontend` (Port `5173`)
- `samadhanx-backend` (Port `8000`)
- `samadhanx-postgres` (Port `5432`)
- `samadhanx-redis` (Port `6379`)
- `samadhanx-celery-worker`

---

## 🌐 Service URLs & Health Endpoints

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:5173` | System Health Dashboard & Foundation UI |
| **Backend API** | `http://localhost:8000` | FastAPI Root Gateway |
| **Swagger UI Docs** | `http://localhost:8000/docs` | Interactive OpenAPI Documentation |
| **ReDoc UI Docs** | `http://localhost:8000/redoc` | Alternative API Documentation |
| **Liveness Probe** | `http://localhost:8000/health/live` | Process liveness check (`200 OK`) |
| **Readiness Probe** | `http://localhost:8000/health/ready` | DB (`SELECT 1`) & Redis (`PING`) check |
| **pgvector Test** | `http://localhost:8000/api/v1/system/pgvector-test` | Vector cosine/Euclidean distance check |
| **Celery Test** | `http://localhost:8000/api/v1/system/celery-test` | Async Celery worker task trigger |

---

## 🛠️ Local Development (Without Docker)

If developing directly on your host machine:

### Backend Prerequisites:
- Python 3.12+
- Local or Dockerized PostgreSQL with pgvector on `localhost:5432`
- Local or Dockerized Redis on `localhost:6379`

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run Database Migrations
alembic upgrade head

# Start FastAPI Dev Server
uvicorn app.main:app --reload --port 8000

# In a separate terminal, start Celery Worker
celery -A app.celery_app.celery_app worker --loglevel=info
```

### Frontend Prerequisites:
- Node.js 20+
- npm

```bash
cd frontend
npm install
npm run dev
```

---

## 🗄️ Database Migrations (Alembic)

Database schema is strictly managed via Alembic. Manual SQL schema modifications are prohibited.

```bash
# Inside backend container or local venv:
# 1. Apply all pending migrations:
alembic upgrade head

# 2. Generate a new migration revision:
alembic revision --autogenerate -m "describe_changes"

# 3. Rollback one revision:
alembic downgrade -1
```

---

## 🧪 Testing & Code Quality

### Backend Quality Suite:
```bash
cd backend

# Run Linter
ruff check .

# Run Code Formatter Check
ruff format --check .

# Execute Automated Tests
pytest -v --cov=app
```

### Frontend Quality Suite:
```bash
cd frontend

# Run ESLint
npm run lint

# TypeScript Type Check
npx tsc --noEmit

# Production Build
npm run build
```

---

## ⚠️ Docker Volume Management Caution

> [!CAUTION]
> **Data Persistence vs Data Wipe**:
> - `docker compose down` : Safely stops and removes containers, preserving all PostgreSQL and Redis data inside persistent volumes.
> - `docker compose down -v` : **Destructive**. Deletes all named volumes including database contents. Use ONLY when you intend a complete database reset.

---

## 🔒 Security Standards

- **Zero Hardcoded Secrets**: All configuration is validated via Pydantic Settings from `.env`.
- **Production Secret Validation**: In `production` environment mode, placeholder or short keys (<32 chars) immediately halt startup.
- **Strict CORS Policy**: Disallows wildcard `*` origins in production mode.
- **Security Headers**: Standard headers injected (`X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`).
- **Correlation ID Tracking**: `X-Request-ID` attached to all incoming requests and structured log outputs.
