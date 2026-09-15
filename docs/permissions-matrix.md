# SamadhanX (SIH 2026 — PS 26043) Role & Permissions Matrix

## 1. Role Hierarchy & Governance Model

```
Admin (National Governance Desk)
 ├── Approves / Rejects / Suspends
 │    ├── University Institutional Accounts (AISHE Master Verified)
 │    │    └── Invites & Onboards → Faculty Mentors (Department Mentors)
 │    └── Industry Partner Accounts (CSR, Equipment & Pilot Sponsors)
 └── Verifies & Moderates Civic Challenges

Public Self-Registration
 ├── Citizen / Problem Submitter (Open to Public via Email OTP Verification)
 └── Student Innovator (Open to Public via Email OTP + Approved Institution Link)
```

---

## 2. API Endpoints Permissions Matrix

### 2.1 Authentication & Onboarding (`/api/v1/auth`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/auth/universities` | `GET` | **Public** | Lists approved institutions for student registration dropdown |
| `/api/v1/auth/register/citizen` | `POST` | **Public** (Rate-Limited) | Citizen self-registration (dispatches email OTP) |
| `/api/v1/auth/register/student` | `POST` | **Public** (Rate-Limited) | Student self-registration (validates university link) |
| `/api/v1/auth/register/university-request` | `POST` | **Public** | University institutional registration application |
| `/api/v1/auth/register/industry-request` | `POST` | **Public** | Industry corporate registration application |
| `/api/v1/auth/verify-otp` | `POST` | **Public** | Validates 6-digit OTP and verifies email |
| `/api/v1/auth/resend-otp` | `POST` | **Public** (Rate-Limited) | Resends 6-digit OTP (3 per 10 min window) |
| `/api/v1/auth/login` | `POST` | **Public** | Returns Access & Refresh JWTs |
| `/api/v1/auth/refresh` | `POST` | **Public** | Issues fresh JWT access token |
| `/api/v1/auth/logout` | `POST` | **Authenticated** | Revokes session & logs audit event |
| `/api/v1/auth/me` | `GET` | **Authenticated** | Returns authenticated profile & role context |
| `/api/v1/auth/faculty/accept-invitation` | `POST` | **Public** | Completes faculty onboarding from email invite token |

---

### 2.2 Citizen Module (`/api/v1/citizen` & `/api/v1/problems`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/citizen/dashboard` | `GET` | `citizen`, `admin` | Real-time aggregated citizen submission metrics |
| `/api/v1/citizen/profile` | `GET` / `PATCH` | `citizen` | Civic profile read and update (ownership enforced) |
| `/api/v1/citizen/problems` | `POST` | `citizen`, `admin` | Submits new grassroots societal problem |
| `/api/v1/citizen/problems/my` | `GET` | `citizen`, `admin` | Lists citizen's own submitted problems |
| `/api/v1/citizen/my-problems/{id}/timeline` | `GET` | `citizen` (Author), `admin` | **Real-Time Lifecycle Timeline Tracker** (BOLA protected) |
| `/api/v1/problems` | `GET` | **Public / Authenticated** | Discover civic challenges with search/filter |
| `/api/v1/problems/{id}` | `GET` | **Public / Authenticated** | Detailed civic challenge view |
| `/api/v1/problems/{id}/comments` | `GET` / `POST` | **Authenticated** | Community & mentorship discussion thread |
| `/api/v1/problems/{id}/endorse` | `POST` | **Authenticated** | Citizen community upvote / endorsement |

---

### 2.3 Student Innovation Pods (`/api/v1/student` & `/api/v1/projects`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/student/dashboard` | `GET` | `student`, `admin` | Student innovator dashboard metrics & assigned pods |
| `/api/v1/student/pods` | `GET` | `student`, `admin` | Lists student's active problem pods & rosters |
| `/api/v1/student/people` | `GET` | **Authenticated** | Discover fellow student innovators (privacy protected) |
| `/api/v1/student/pods/{id}/members` | `POST` | `student` (Pod Lead) | Invites / adds student teammate to pod |
| `/api/v1/student/pods/{id}/members/{user_id}` | `DELETE` | `student` (Pod Lead), `admin` | Removes teammate from pod |
| `/api/v1/student/pods/{id}/submit-review` | `POST` | `student` (Pod Lead) | Submits pod milestone for faculty academic review |
| `/api/v1/student/pods/{id}/impact-report` | `GET` / `POST` / `PATCH` | `student` (Pod Member) | Submits & updates field societal impact report |
| `/api/v1/student/pods/{id}/funding-offers` | `GET` | `student` (Pod Member) | Lists industry funding offers received |
| `/api/v1/student/pods/{id}/funding-offers/{offer_id}/respond` | `POST` | `student` (Pod Lead) | Accepts or declines corporate funding offer |
| `/api/v1/projects` | `POST` | `student`, `admin` | Forms solution pod for a civic challenge |
| `/api/v1/projects/{id}/updates` | `GET` / `POST` | `student` (Pod Member) | Engineering Log milestone updates |

---

### 2.4 Faculty Mentorship Module (`/api/v1/faculty` & `/api/v1/reviews`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/faculty/dashboard` | `GET` | `faculty`, `admin` | Mentorship dashboard & review queues |
| `/api/v1/faculty/assigned-projects` | `GET` | `faculty`, `admin` | Lists campus pods assigned for faculty mentorship |
| `/api/v1/faculty/projects/{id}/adopt` | `POST` | `faculty`, `admin` | Adopts campus pod as designated faculty mentor |
| `/api/v1/reviews/{project_id}` | `POST` | `faculty` (Same Univ), `admin` | Submits academic evaluation & decision |
| `/api/v1/reviews/{project_id}` | `GET` | **Authenticated** | Reads academic review feedback |

---

### 2.5 Industry Partner Module (`/api/v1/industry`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/industry/dashboard/stats` | `GET` | `industry` (Approved) | Corporate partner KPI metrics & offer counts |
| `/api/v1/industry/vetted-projects` | `GET` | `industry` (Approved) | **Faculty-Vetted Pods Only** (`status IN ('pilot', 'completed')`) |
| `/api/v1/industry/vetted-projects/{id}` | `GET` | `industry` (Approved) | Vetted pod detail (privacy safe, no student PII) |
| `/api/v1/industry/offers` | `POST` | `industry` (Approved) | Submits funding offer / CSR grant / equipment |
| `/api/v1/industry/offers/my` | `GET` | `industry` (Approved) | Lists corporate partner's funding offers |
| `/api/v1/industry/offers/{id}/withdraw` | `PATCH` | `industry` (Offer Owner) | Withdraws own pending funding offer |
| `/api/v1/industry/funded-projects` | `GET` | `industry` (Approved) | Lists pods where company has accepted offer |
| `/api/v1/industry/funded-projects/{id}/updates` | `GET` | `industry` (Accepted Funder) | Gated Engineering Log access |
| `/api/v1/industry/funded-projects/{id}/impact-report` | `GET` | `industry` (Accepted Funder) | Gated Societal Impact Report access |
| `/api/v1/industry/funded-projects/{id}/comments` | `GET` / `POST` | `industry` (Accepted Funder) | Funder feedback thread |

---

### 2.6 Administrator Desk (`/api/v1/admin`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/admin/dashboard/stats` | `GET` | `admin` | National governance metrics & live platform counts |
| `/api/v1/admin/requests` | `GET` | `admin` | Lists institutional & industry onboarding applications |
| `/api/v1/admin/requests/{id}/approve` | `PATCH` | `admin` | Approves institution/industry access & triggers email |
| `/api/v1/admin/requests/{id}/reject` | `PATCH` | `admin` | Rejects application with justification |
| `/api/v1/admin/problems/{id}/moderate` | `PATCH` | `admin` | Verifies or rejects reported civic problems |
| `/api/v1/admin/audit-logs` | `GET` | `admin` | Complete tamper-evident system audit trail |
| `/api/v1/admin/institutions/sync` | `POST` | `admin` | Triggers background Celery AISHE master sync |

---

### 2.7 University Institutional Desk (`/api/v1/university`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/university/dashboard` | `GET` | `university` (Approved) | Campus innovation hub metrics & rosters |
| `/api/v1/university/faculty` | `GET` / `POST` | `university` (Approved) | Onboards and lists verified faculty members |
| `/api/v1/university/faculty/invite` | `POST` | `university` (Approved) | Sends email invitation tokens to professors |
| `/api/v1/university/students` | `GET` | `university` (Approved) | Lists enrolled student innovators |

---

### 2.8 Notifications & System (`/api/v1/notifications` & `/api/v1/system`)

| Endpoint | Method | Auth Level / Role | Description |
|---|---|---|---|
| `/api/v1/notifications` | `GET` | **Authenticated** | Real-time user notification feed |
| `/api/v1/notifications/{id}/read` | `PATCH` | **Authenticated** | Marks notification as read |
| `/api/v1/notifications/read-all` | `PATCH` | **Authenticated** | Marks all notifications as read |
| `/api/v1/system/pgvector-test` | `GET` | **Admin / Developer** | Tests pgvector cosine distance operations |
| `/api/v1/system/celery-test` | `POST` | **Admin / Developer** | Tests asynchronous worker pipeline |
