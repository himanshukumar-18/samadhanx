# SamadhanX (SIH 2026) — Error Code Dictionary

All SamadhanX APIs adhere to a standardized JSON error response schema:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "Human-readable explanation.",
    "request_id": "req-uuid-...",
    "details": null
  }
}
```

---

## 1. Authentication & Account Access

| Code | HTTP Status | Description |
|---|---|---|
| `EMAIL_EXISTS` | 409 | An account is already registered with this email address. |
| `INVALID_CREDENTIALS` | 401 | Email or password entered is incorrect. |
| `ACCOUNT_NOT_VERIFIED` | 403 | Account email has not been verified via OTP. |
| `ACCOUNT_PENDING_APPROVAL` | 403 | Institutional/Industry account is awaiting Administrator approval. |
| `ACCOUNT_REJECTED` | 403 | Institutional/Industry registration was rejected by administrator. |
| `ACCOUNT_INACTIVE` | 403 | Account is deactivated or suspended. |
| `INVALID_OTP` | 400 | The entered 6-digit OTP is incorrect. |
| `OTP_EXPIRED` | 400 | The OTP has expired (valid for 10 minutes). |
| `MAX_OTP_ATTEMPTS_EXCEEDED` | 429 | Exceeded maximum OTP verification or resend attempts. |
| `INVALID_TOKEN` | 401 | JWT access or refresh token is malformed, invalid, or corrupted. |
| `TOKEN_EXPIRED` | 401 | JWT token has expired. |
| `INVALID_UNIVERSITY` | 400 | Selected university is invalid or not yet approved. |

---

## 2. Authorization & RBAC

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | No authentication credentials provided or header missing. |
| `FORBIDDEN` | 403 | Authenticated user does not have permission for the requested resource (BOLA/RBAC violation). |
| `CITIZEN_ONLY` | 403 | Endpoint is restricted to Citizen accounts. |
| `STUDENT_ONLY` | 403 | Endpoint is restricted to Student Innovator accounts. |
| `FACULTY_ONLY` | 403 | Endpoint is restricted to Faculty Mentor accounts. |
| `INDUSTRY_ONLY` | 403 | Endpoint is restricted to approved Industry Partner accounts. |
| `UNIVERSITY_ONLY` | 403 | Endpoint is restricted to approved University Nodal accounts. |
| `ADMIN_ONLY` | 403 | Endpoint is restricted to National Governance Administrators. |
| `NOT_AN_INDUSTRY_ACCOUNT` | 403 | Non-industry user attempted to access industry partner portal. |

---

## 3. Civic Problems & Citizen Timeline

| Code | HTTP Status | Description |
|---|---|---|
| `PROBLEM_NOT_FOUND` | 404 | The requested civic problem does not exist. |
| `COMMENT_NOT_FOUND` | 404 | The requested comment does not exist. |
| `INVALID_PROBLEM_STATUS` | 400 | Problem cannot transition to the requested status. |

---

## 4. Student Innovation Pods & Teammates

| Code | HTTP Status | Description |
|---|---|---|
| `PROJECT_NOT_FOUND` | 404 | The requested solution pod does not exist. |
| `DUPLICATE_POD` | 409 | Student is already leading an active pod for this problem. |
| `POD_ACCESS_DENIED` | 403 | User is not a member of the solution pod. |
| `NOT_POD_LEAD` | 403 | Only the student team lead can perform this action. |
| `INVALID_POD_STATUS` | 400 | Illegal pod status transition requested. |
| `USER_NOT_FOUND` | 404 | The target user/teammate could not be located. |
| `USER_NOT_A_STUDENT` | 400 | Only student accounts can be added as pod teammates. |
| `USER_ALREADY_IN_PROJECT` | 409 | User is already an active member of this solution pod. |
| `INVITATION_NOT_FOUND` | 404 | Pod teammate invitation was not found. |
| `INVITATION_NOT_PENDING` | 400 | Invitation has already been accepted or revoked. |
| `NOT_INVITED_USER` | 403 | User is not the designated recipient of the invitation. |
| `MAX_MEMBERS_REACHED` | 400 | Solution pod has reached maximum team capacity (6 members). |

---

## 5. Faculty Mentorship & Reviews

| Code | HTTP Status | Description |
|---|---|---|
| `FACULTY_NOT_ASSIGNED` | 403 | Faculty member is not the assigned mentor for this pod. |
| `CROSS_UNIVERSITY_FORBIDDEN` | 403 | Faculty cannot mentor or review pods outside their affiliated institution. |
| `REVIEW_NOT_FOUND` | 404 | The requested academic review could not be found. |
| `INVALID_REVIEW_DECISION` | 400 | Invalid review decision (allowed: approved, changes_requested, rejected). |

---

## 6. Industry Partner & Funding Offers

| Code | HTTP Status | Description |
|---|---|---|
| `POD_NOT_VETTED` | 400 | Industry can only fund faculty-approved pods (status: pilot or completed). |
| `DUPLICATE_OFFER` | 409 | Industry user already has a pending funding offer on this pod. |
| `OFFER_NOT_FOUND` | 404 | The specified funding offer does not exist. |
| `OFFER_NOT_PENDING` | 400 | Funding offer cannot be modified because it is no longer pending. |
| `NO_ACCEPTED_OFFER` | 403 | Funder access requires an approved/accepted funding offer on the pod. |
| `INVALID_SUPPORT_TYPE` | 400 | Unrecognized support type provided. |

---

## 7. Impact Reports & Field Resolution

| Code | HTTP Status | Description |
|---|---|---|
| `IMPACT_REPORT_NOT_FOUND` | 404 | No impact report submitted for this pod. |
| `IMPACT_REPORT_ALREADY_EXISTS`| 409 | An impact report is already registered for this pod. |
| `POD_NOT_COMPLETED` | 400 | Impact report requires pod to have reached completed/pilot milestone. |

---

## 8. Institution Master & Verification Requests

| Code | HTTP Status | Description |
|---|---|---|
| `INSTITUTION_NOT_FOUND` | 404 | AISHE master institution entry does not exist. |
| `DUPLICATE_AISHE_CODE` | 409 | Institution with this AISHE code is already registered. |
| `VERIFICATION_REQUEST_NOT_FOUND`| 404 | Institution verification request does not exist. |
| `SYNC_IN_PROGRESS` | 409 | Background AISHE database sync is already active. |
