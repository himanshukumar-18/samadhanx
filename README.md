# SamadhanX 🇮🇳
> **Smart India Hackathon 2026 (Problem Statement: SIH 26043)**  
> *An AI-powered digital platform connecting citizens, universities, student innovators, faculty mentors, and industry partners to turn real-world societal problems into collaborative solutions and measurable impact.*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-75%2F75%20passing-success.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)]()
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791.svg?logo=postgresql&logoColor=white)]()
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D.svg?logo=redis&logoColor=white)]()
[![Celery](https://img.shields.io/badge/Celery-5.3-37814A.svg?logo=celery&logoColor=white)]()
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)]()

---

## 🏛️ System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    PRESENTATION TIER                                  |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   |                  React 18 + TypeScript + Vite + Tailwind CSS                  |   |
|   |  - Role-Based Dynamic Dashboards (Citizen, Student, Faculty, Industry, Admin) |   |
|   |  - Real-Time Citizen Problem Timeline & Milestone Tracker                     |   |
|   |  - Zustand Global Auth & Profile State | TanStack Query Async State Cache     |   |
|   |  - Lucide React Iconography | Responsive Desktop/Mobile Viewports             |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------+--------------------------------------------+
                                           | HTTPS / JSON REST API (X-Request-ID, Bearer JWT)
                                           v
+---------------------------------------------------------------------------------------+
|                                   APPLICATION GATEWAY                                 |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   |                         FastAPI Application Gateway                           |   |
|   |  - Lifespan State Manager | Security Headers Middleware (CSP, CORS, Referrer) |   |
|   |  - Correlation ID Middleware (X-Request-ID propagation to logs & errors)      |   |
|   |  - Multi-Tier RBAC & BOLA Authorization Guards (Strict Ownership Checks)      |   |
|   |  - Pydantic v2 Schema Validation | OpenAPI 3.1 & ReDoc Auto-Documentation     |   |
|   +-------------------------------------------------------------------------------+   |
+----------------------+------------------------------------+---------------------------+
                       |                                    |
                       v                                    v
+--------------------------------------+   +--------------------------------------------+
|             STORAGE TIER             |   |            ASYNC & WORKER TIER             |
|                                      |   |                                            |
|   +------------------------------+   |   |   +------------------------------------+   |
|   |   PostgreSQL 16 + pgvector   |   |   |   |          Redis 7 In-Memory         |   |
|   |  - SQLAlchemy 2.0 Async ORM  |   |   |   |  - Celery Message Broker & Backend |   |
|   |  - Alembic Schema Revision   |   |   |   |  - Rate-Limiting & Session Cache   |   |
|   |  - Relational Integrity      |   |   |   |  - OTP Anti-Brute-Force Tracker    |   |
|   |  - pgvector Cosine Distance  |   |   |   +-----------------+------------------+   |
|   |  - Tamper-Evident Audit Trail|   |   |                     |                      |
|   +------------------------------+   |   |                     v                      |
+--------------------------------------+   |   +------------------------------------+   |
                                           |   |           Celery Worker            |   |
                                           |   |  - Asynchronous Email Dispatch     |   |
                                           |   |  - AISHE Master Institution Sync   |   |
                                           |   |  - Automated Timeline Status Pushes|   |
                                           |   |  - Periodic Cleanup & Maintenance  |   |
                                           |   +------------------------------------+   |
                                           +--------------------------------------------+
```

---

## 🌟 The 6-Role Governance Model & End-to-End Pipeline

SamadhanX unites six critical societal stakeholders in a single transparent, verified pipeline:

```
[1. Citizen Submits Problem]
            │
            ▼
[2. Admin Moderation & AI De-duplication]
            │ (Problem Status: VERIFIED)
            ▼
[3. Student Innovators Form Solution Pod]
            │ (Problem Status: IN_PROGRESS)
            ▼
[4. Pod Milestones & Engineering Logs]
            │ (Status: IN_PROGRESS)
            ▼
[5. Faculty Mentorship Adoption & Academic Review]
            │ (Pod Status: REVIEW_PENDING -> FACULTY_APPROVED)
            ▼
[6. Industry Partner CSR Funding & Pilot Sponsorship]
            │ (Pod Status: PILOT)
            ▼
[7. Field Deployment & Societal Impact Report]
            │ (Pod Status: COMPLETED -> Problem Status: RESOLVED)
            ▼
[8. Real-Time Citizen Resolution Notification]
```

### Role Breakdown:
1. **🧑 Citizen (Problem Submitter)**: Submits local civic issues, uploads geo-tagged evidence, upvotes community problems, and monitors resolution through the **Real-Time Problem Timeline**.
2. **🎓 Student Innovator (Pod Lead & Members)**: Discovers verified problems, forms multi-disciplinary pods of up to 6 members, logs engineering milestones, submits prototypes for faculty review, receives industry funding, and deploys solutions.
3. **🔬 Faculty Mentor (Academic Evaluator)**: Adopts student pods within their institution, guides technical execution, evaluates prototypes against a structured academic rubric, and grants pilot approvals.
4. **🏢 Industry Partner (CSR & Pilot Sponsor)**: Discovers faculty-vetted solutions, extends CSR grant funding, laboratory equipment, or cloud resources, and inspects gated impact reports for compliance.
5. **🏫 University Nodal Desk (Campus Innovation Hub)**: Manages institutional profile, verifies AISHE master data, onboards departmental faculty, and tracks campus innovation metrics.
6. **🛡️ National Governance Administrator**: Verifies institutional credentials, approves corporate partner applications, moderates civic challenges, manages AISHE database syncs, and reviews tamper-evident audit logs.

---

## 🚀 Quick Start (Docker)

The recommended and fastest way to launch the entire platform:

### 1. Clone & Prepare Environment
```bash
cp .env.example .env
```

### 2. Launch All Services with Docker Compose
```bash
docker compose up --build -d
```

### 3. Check Container Health
```bash
docker compose ps
```

All 5 core services will initialize with automatic health checks:
- `samadhanx-frontend` (Port `5173`)
- `samadhanx-backend` (Port `8000`)
- `samadhanx-postgres` (Port `5432`)
- `samadhanx-redis` (Port `6379`)
- `samadhanx-celery-worker`

---

## 🌐 Service URLs & Health Endpoints

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:5173` | React 18 Application |
| **Backend API** | `http://localhost:8000` | FastAPI Root Gateway |
| **Swagger UI Docs** | `http://localhost:8000/docs` | Interactive OpenAPI 3.1 Explorer |
| **ReDoc UI Docs** | `http://localhost:8000/redoc` | API Documentation |
| **Liveness Probe** | `http://localhost:8000/health/live` | Process liveness check (`200 OK`) |
| **Readiness Probe** | `http://localhost:8000/health/ready` | DB (`SELECT 1`) & Redis (`PING`) check |
| **pgvector Engine** | `http://localhost:8000/api/v1/system/pgvector-test` | Vector cosine/Euclidean distance check |
| **Celery Worker** | `http://localhost:8000/api/v1/system/celery-test` | Asynchronous task queue check |

---

## 🛠️ Local Development (Without Docker)

### Backend Setup:
- Requires **Python 3.12+**, PostgreSQL 16 + pgvector, and Redis 7.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run Database Migrations
alembic upgrade head

# Start FastAPI Dev Server
uvicorn app.main:app --reload --port 8000

# Start Celery Worker (in a separate terminal)
celery -A app.celery_app.celery_app worker --loglevel=info
```

### Frontend Setup:
- Requires **Node.js 20+** and npm.

```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing & Code Quality

### Backend Test Suite (75/75 Tests Passing):
```bash
# Inside docker container or local venv:
docker exec samadhanx-backend pytest tests/ -v --cov=app
```

### Frontend Typecheck & Build (0 Errors):
```bash
# Inside frontend directory or container:
docker exec samadhanx-frontend npm run build
```

---

## 🔒 Security & Defense-in-Depth

- **Zero Hardcoded Credentials**: Strictly configured via Pydantic v2 Settings and validated environment variables.
- **Broken Object Level Authorization (BOLA) Defenses**: Explicit ownership checks at the service layer prevent unauthorized cross-user data tampering.
- **Strict Role-Based Access Control (RBAC)**: All routes enforced by dependencies requiring specific role permissions.
- **Anti-Brute-Force Protections**: Redis-backed rate limiting on authentication and OTP verification (3 attempts per 10-minute window).
- **Comprehensive Audit Trails**: Immutable audit log captures every sensitive action with user ID, IP address, action type, and correlation ID (`X-Request-ID`).
- **Standard Security Headers**: Injects `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 📚 Complete Documentation Index

For in-depth technical specifications, please explore the documentation directory:

- 🏛️ **[System Architecture & Data Models](docs/architecture.md)** — Relational ER diagrams, component interaction, pgvector AI search, and worker pipelines.
- 🔄 **[User Workflows & Role Guides](docs/user-workflows.md)** — Step-by-step walkthroughs for Citizen, Student, Faculty, Industry, University, and Admin roles.
- 📡 **[REST API Reference](docs/api-reference.md)** — Comprehensive OpenAPI specification with payload schemas and query parameters.
- 🛡️ **[Permissions & RBAC Matrix](docs/permissions-matrix.md)** — Granular route-by-route authorization and access control matrix.
- ⚠️ **[Error Code Dictionary](docs/error-codes.md)** — Standardized JSON error response schemas and error code definitions.
- 🚀 **[Production Deployment Guide](docs/deployment.md)** — Production topology, environment configurations, backup/restore, and scaling guidelines.
- 🎨 **[Frontend Architecture](frontend/README.md)** — Modular frontend structure, routing guards, and state management.

---

## 👥 Team & Hackathon Submission
- **Event**: Smart India Hackathon (SIH) 2026
- **Problem Statement**: SIH 26043 — AI-Powered Collaborative Problem-Solving & Impact Platform
- **Project Name**: SamadhanX 🇮🇳
