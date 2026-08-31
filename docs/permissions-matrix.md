# SamadhanX (SIH 2026 — PS 26043) Permissions & Role Matrix

## 1. Role Hierarchy & Access Chain

```
Admin (National Governance Desk)
 └── Approves / Rejects
      ├── University Institutional Accounts
      │    └── Creates & Onboards → Faculty Accounts (Department Mentors)
      └── Industry Partner Accounts (CSR & Challenge Sponsors)

Public Self-Registration
 ├── Citizen / Problem Submitter (Open to Public via Email OTP)
 └── Student Innovator (Open to Public via Email OTP + Approved University Link)
```

---

## 2. API Endpoints Permissions Matrix

| Endpoint | Method | Allowed Roles / Auth Level | Description |
|---|---|---|---|
| `/api/v1/auth/universities` | `GET` | **Public** (No Auth) | Lists approved universities for student registration dropdown |
| `/api/v1/auth/register/citizen` | `POST` | **Public** (No Auth) | Self-registration for citizens (triggers OTP email) |
| `/api/v1/auth/register/student` | `POST` | **Public** (No Auth) | Self-registration for students (validates approved university FK) |
| `/api/v1/auth/register/university-request` | `POST` | **Public** (No Auth) | Institutional registration request (sets `pending` status) |
| `/api/v1/auth/register/industry-request` | `POST` | **Public** (No Auth) | Corporate registration request (sets `pending` status) |
| `/api/v1/auth/verify-otp` | `POST` | **Public** (No Auth) | Validates 6-digit OTP and activates account verification |
| `/api/v1/auth/resend-otp` | `POST` | **Public** (Rate-Limited) | Dispatches fresh OTP (max 3 per 10 min window) |
| `/api/v1/auth/login` | `POST` | **Public** (Valid Credentials) | Returns Access & Refresh JWTs (enforces verification & approval) |
| `/api/v1/auth/refresh` | `POST` | **Public** (Valid Refresh JWT) | Issues fresh access & refresh token pair |
| `/api/v1/auth/logout` | `POST` | **Authenticated User** | Terminates session and logs audit trail |
| `/api/v1/auth/me` | `GET` | **Authenticated User** | Returns authenticated profile details & role context |
| `/api/v1/admin/requests` | `GET` | `admin` | Lists pending/reviewed institutional onboarding applications |
| `/api/v1/admin/requests/{id}/approve` | `PATCH` | `admin` | Approves University/Industry access and dispatches approval email |
| `/api/v1/admin/requests/{id}/reject` | `PATCH` | `admin` | Rejects application with reason and dispatches notification |
| `/api/v1/admin/audit-logs` | `GET` | `admin` | Live security audit trail for all authentication & role actions |
| `/api/v1/university/faculty` | `POST` | `university` (`is_approved=True`) | University admin creates verified faculty mentor accounts |
| `/api/v1/university/faculty` | `GET` | `university` (`is_approved=True`) | Lists all faculty members associated with the university |

---

## 3. Error Standard & Status Code Schema

All endpoints return a standardized, predictable JSON shape:

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Action completed successfully."
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_PENDING_APPROVAL",
    "message": "Your institutional account is pending administrative approval.",
    "request_id": "req-uuid-...",
    "details": null
  }
}
```
