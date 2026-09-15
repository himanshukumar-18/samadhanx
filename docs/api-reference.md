# SamadhanX (SIH 2026 — PS 26043) REST API Reference

All SamadhanX endpoints return structured JSON conforming to standard REST conventions.

- **Base URL**: `http://localhost:8000/api/v1`
- **Authentication**: `Authorization: Bearer <jwt_access_token>`
- **Tracking Header**: `X-Request-ID: <uuid>` (automatically attached and returned)

---

## 1. Authentication & Onboarding (`/api/v1/auth`)

### `GET /api/v1/auth/universities`
Returns a list of approved institutions for student and faculty registration dropdowns.
- **Access**: Public
- **Response**: `200 OK`
```json
[
  {
    "id": 1,
    "name": "Indian Institute of Technology, Bombay",
    "aishe_code": "U-0123",
    "state": "Maharashtra",
    "status": "APPROVED"
  }
]
```

### `POST /api/v1/auth/register/citizen`
Registers a new citizen user and dispatches a 6-digit verification OTP.
- **Access**: Public (Rate-Limited: 5/min)
- **Body**:
```json
{
  "email": "citizen@example.com",
  "password": "SecurePassword123!",
  "first_name": "Ramesh",
  "last_name": "Kumar",
  "phone": "+919876543210",
  "city": "Pune",
  "state": "Maharashtra"
}
```
- **Response**: `201 Created`

### `POST /api/v1/auth/register/student`
Registers a student innovator linked to an approved university.
- **Access**: Public (Rate-Limited: 5/min)
- **Body**:
```json
{
  "email": "student@iitb.ac.in",
  "password": "SecurePassword123!",
  "first_name": "Aarav",
  "last_name": "Sharma",
  "university_id": 1,
  "enrollment_number": "2024CS101",
  "department": "Computer Science & Engineering",
  "degree": "B.Tech",
  "year_of_study": 3
}
```
- **Response**: `201 Created`

### `POST /api/v1/auth/verify-otp`
Validates the 6-digit OTP to complete email verification.
- **Access**: Public
- **Body**:
```json
{
  "email": "citizen@example.com",
  "otp": "123456"
}
```
- **Response**: `200 OK`

### `POST /api/v1/auth/login`
Authenticates user and returns JWT tokens with user profile context.
- **Access**: Public
- **Body**:
```json
{
  "username": "citizen@example.com",
  "password": "SecurePassword123!"
}
```
- **Response**: `200 OK`
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "citizen@example.com",
    "role": "citizen",
    "is_verified": true,
    "first_name": "Ramesh",
    "last_name": "Kumar"
  }
}
```

---

## 2. Citizen & Civic Problems (`/api/v1/citizen` & `/api/v1/problems`)

### `GET /api/v1/citizen/dashboard`
Returns live metrics and submitted problems for the authenticated citizen.
- **Access**: `citizen`, `admin`
- **Response**: `200 OK`
```json
{
  "total_submitted": 3,
  "active_solutions": 2,
  "resolved_count": 1,
  "recent_problems": [...]
}
```

### `GET /api/v1/citizen/my-problems/{id}/timeline`
**Real-Time Lifecycle Timeline Tracker** (BOLA protected). Returns granular milestone stages for the problem from submission to field deployment.
- **Access**: `citizen` (Author), `admin`
- **Response**: `200 OK`
```json
{
  "problem_id": 1,
  "problem_title": "Water Contamination in Ward 7",
  "current_status": "IN_PROGRESS",
  "created_at": "2026-09-10T10:00:00Z",
  "stages": [
    {
      "key": "SUBMITTED",
      "label": "Problem Submitted",
      "description": "Civic problem registered by citizen.",
      "status": "COMPLETED",
      "timestamp": "2026-09-10T10:00:00Z",
      "metadata": { "submitted_by": "Ramesh Kumar" }
    },
    {
      "key": "VERIFIED",
      "label": "Admin Verified",
      "description": "Challenge approved by national desk.",
      "status": "COMPLETED",
      "timestamp": "2026-09-11T12:00:00Z",
      "metadata": {}
    },
    {
      "key": "POD_ADOPTED",
      "label": "Innovation Pod Formed",
      "description": "Student team 'AquaPure' adopted this problem.",
      "status": "COMPLETED",
      "timestamp": "2026-09-12T14:30:00Z",
      "metadata": { "pod_name": "AquaPure", "university": "IIT Bombay" }
    },
    {
      "key": "FACULTY_APPROVED",
      "label": "Faculty Mentored & Vetted",
      "description": "Academic review approved prototype feasibility.",
      "status": "COMPLETED",
      "timestamp": "2026-09-13T16:00:00Z",
      "metadata": { "faculty_name": "Dr. S. Mehta" }
    },
    {
      "key": "INDUSTRY_FUNDED",
      "label": "Industry Sponsored",
      "description": "CSR Grant funding provided by Tata Trusts.",
      "status": "IN_PROGRESS",
      "timestamp": "2026-09-14T09:00:00Z",
      "metadata": { "company_name": "Tata Trusts", "support_type": "CSR_GRANT" }
    },
    {
      "key": "DEPLOYED_RESOLVED",
      "label": "Field Tested & Resolved",
      "description": "Impact report filed and validated in the field.",
      "status": "PENDING",
      "timestamp": null,
      "metadata": {}
    }
  ]
}
```

---

## 3. Student Innovation Pods (`/api/v1/student` & `/api/v1/projects`)

### `GET /api/v1/student/pods`
Lists all innovation pods where the current student is a team lead or active member.
- **Access**: `student`, `admin`
- **Response**: `200 OK`

### `POST /api/v1/student/pods/{id}/members`
Invites or adds a student peer to the innovation pod (Max 6 members per pod).
- **Access**: `student` (Pod Lead)
- **Body**:
```json
{
  "user_id": 14,
  "role": "developer"
}
```
- **Response**: `200 OK`

### `POST /api/v1/student/pods/{id}/submit-review`
Submits current pod milestones and engineering logs for faculty academic evaluation.
- **Access**: `student` (Pod Lead)
- **Response**: `200 OK`

### `POST /api/v1/student/pods/{id}/funding-offers/{offer_id}/respond`
Accepts or declines a corporate funding/sponsorship proposal.
- **Access**: `student` (Pod Lead)
- **Body**:
```json
{
  "decision": "ACCEPTED"
}
```
- **Response**: `200 OK`

---

## 4. Faculty Mentorship (`/api/v1/faculty` & `/api/v1/reviews`)

### `GET /api/v1/faculty/dashboard`
Returns assigned campus pods, pending academic reviews, and departmental metrics.
- **Access**: `faculty`, `admin`
- **Response**: `200 OK`

### `POST /api/v1/reviews/{project_id}`
Submits a formal academic evaluation rubric and verdict.
- **Access**: `faculty` (Affiliated University), `admin`
- **Body**:
```json
{
  "status": "approved",
  "technical_score": 9,
  "impact_score": 9,
  "feasibility_score": 8,
  "feedback": "Outstanding IoT sensor design. Low unit cost enables rapid ward deployment.",
  "recommended_stage": "pilot"
}
```
- **Response**: `200 OK`

---

## 5. Industry Partner Module (`/api/v1/industry`)

### `GET /api/v1/industry/vetted-projects`
Lists faculty-approved pods ready for CSR sponsorship, lab equipment, or pilot deployment.
- **Access**: `industry` (Approved)
- **Response**: `200 OK`

### `POST /api/v1/industry/offers`
Submits a corporate funding, CSR grant, or resource support proposal.
- **Access**: `industry` (Approved)
- **Body**:
```json
{
  "project_id": 5,
  "support_type": "CSR_GRANT",
  "amount": 250000.0,
  "description": "Funding for field deployment of 50 water monitoring nodes.",
  "mentorship_offered": true
}
```
- **Response**: `201 Created`

---

## 6. Administrator Governance Desk (`/api/v1/admin`)

### `GET /api/v1/admin/dashboard/stats`
Returns system-wide aggregated metrics across all stakeholders.
- **Access**: `admin`
- **Response**: `200 OK`

### `PATCH /api/v1/admin/requests/{id}/approve`
Approves an institutional or industry account application.
- **Access**: `admin`
- **Response**: `200 OK`

### `GET /api/v1/admin/audit-logs`
Queries the tamper-evident security audit trail with filtering.
- **Access**: `admin`
- **Response**: `200 OK`
