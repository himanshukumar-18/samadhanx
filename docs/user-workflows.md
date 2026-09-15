# SamadhanX (SIH 2026 — PS 26043) User Workflows & Role Guides

SamadhanX unifies 6 distinct user roles in a continuous innovation pipeline. This document outlines the step-by-step user workflows for each stakeholder.

---

## 1. 🏛️ Role 1: Citizen (Problem Submitter)

### Workflow Overview
Citizens are the grassroots origin of civic problem statements. They submit local challenges, provide evidence, engage with the community, and track resolution in real time.

```
+-------------------------------------------------------------------------------+
|  1. Register with Email + 6-digit OTP                                         |
|  2. Submit Civic Problem (Title, Category, District, Evidence Images)         |
|  3. Real-Time Tracking via ProblemTimeline (Submitted -> Pod -> Mentored ->   |
|     Funded -> Deployed)                                                       |
|  4. Upvote & Comment on Community Challenges                                  |
|  5. Receive Automated Stage Notifications upon Field Resolution               |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **Submit Problem (`/citizen/submit`)**:
   - Fill in title, detailed problem description, select sector (Healthcare, Water & Sanitation, Agriculture, Clean Energy, Urban Mobility, Education).
   - Enter district/state location tags and optional attachments.
2. **Citizen Dashboard (`/citizen`)**:
   - View summary metrics: Total Problems Submitted, Active Pods Working, Resolved Challenges.
   - Click **"Track Live Progress"** on any problem to open the full interactive `ProblemTimeline`.
3. **Problem Detail (`/problems/:id`)**:
   - View community upvotes, comments, and current solution pods assigned to the problem.

---

## 2. 🎓 Role 2: Student Innovator (Solution Pod Lead & Member)

### Workflow Overview
Students discover verified civic challenges, form multi-disciplinary innovation pods, invite campus peers, build prototypes, log engineering milestones, submit for faculty review, receive industry funding, and submit impact reports.

```
+-------------------------------------------------------------------------------+
|  1. Register & Select Verified University Affiliation                         |
|  2. Discover Verified Civic Challenges (`/problems`)                          |
|  3. Form Solution Pod (`POST /api/v1/projects`)                               |
|  4. Assemble Roster: Invite up to 5 Teammates (`POST /pods/:id/members`)      |
|  5. Log Engineering Milestones (`/projects/:id/updates`)                      |
|  6. Submit for Academic Review (`POST /pods/:id/submit-review`)                |
|  7. Review & Accept Industry CSR Funding Offers (`/funding-offers`)           |
|  8. Deploy Solution & Submit Societal Impact Report (`/impact-report`)        |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **Pod Hub (`/student/pods`)**:
   - Manage solution pod roster, define member roles (`lead`, `developer`, `designer`, `researcher`, `hardware_engineer`).
2. **Milestones & Engineering Log**:
   - Post milestone updates with evidence links, GitHub repos, and test results.
3. **Faculty Academic Review**:
   - Click "Submit for Faculty Review" when prototype is ready for academic evaluation.
4. **Funding Offers**:
   - Review incoming corporate offers (CSR Grant, Lab Equipment, Cloud Credits). Team Lead can Accept or Decline.
5. **Impact Report Submission**:
   - Upon field testing, submit quantitative metrics (Citizens Benefited, Efficiency Gain %, Cost Reduction), before/after photos, and field outcomes.

---

## 3. 🔬 Role 3: Faculty Mentor (Academic Evaluator)

### Workflow Overview
Faculty mentors adopt campus student pods, guide technical development, conduct formal academic rubric reviews, request revisions, and grant institutional approval to unlock industry sponsorship.

```
+-------------------------------------------------------------------------------+
|  1. Onboard via University Invitation Link                                    |
|  2. Faculty Mentorship Dashboard (`/faculty`)                                 |
|  3. Adopt Campus Pods (`POST /faculty/projects/:id/adopt`)                     |
|  4. Evaluate Pod Milestones & Engineering Logs                                |
|  5. Submit Formal Academic Review (`POST /reviews/:projectId`)                |
|     - Approved -> Unlocks Industry Pilot Funding                              |
|     - Changes Requested -> Returns to Student Pod with Feedback               |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **Mentorship Hub (`/faculty`)**:
   - View assigned student pods, pending review requests, and departmental project rosters.
2. **Formal Evaluation Modal**:
   - Grade technical feasibility, societal impact, and methodological rigor.
   - Provide actionable written critique and issue formal decision (`approved`, `changes_requested`, `rejected`).

---

## 4. 🏢 Role 4: Industry Partner (CSR & Pilot Sponsor)

### Workflow Overview
Corporate partners and CSR foundations discover faculty-vetted pilot solutions, propose CSR grants, equipment, and lab access, review progress in gated channels, and verify field impact reports.

```
+-------------------------------------------------------------------------------+
|  1. Submit Corporate Registration Request (Company PAN/CIN, CSR Focus)        |
|  2. Await National Administrator Desk Verification & Approval                 |
|  3. Browse Faculty-Vetted Solutions (`/industry/vetted-projects`)             |
|  4. Propose Funding / CSR Support (`POST /industry/offers`)                  |
|  5. Track Funded Portfolios & Access Gated Engineering Logs                   |
|  6. Validate Final Field Impact Reports for CSR Compliance                    |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **Vetted Solutions Catalog (`/industry/vetted-projects`)**:
   - Filter faculty-approved projects by sector, technology stack, and geographic target.
   - Privacy-safe view (protects student PII while exposing technical solution architecture).
2. **Submit Support Offer**:
   - Offer Type: `CSR_GRANT`, `EQUIPMENT`, `CLOUD_CREDITS`, `PILOT_TESTING`.
   - Specify grant amount (INR), equipment specifications, and mentorship terms.
3. **Funded Portfolio Hub (`/industry/partnerships`)**:
   - Gated access to real-time engineering logs, milestone progress, and verified impact metrics for CSR audit compliance.

---

## 5. 🏫 Role 5: University Nodal Desk (Institutional Innovation Hub)

### Workflow Overview
University administrators manage their institutional profile, sync campus AISHE credentials, invite departmental faculty members, and monitor institutional innovation metrics.

```
+-------------------------------------------------------------------------------+
|  1. Apply with Official AISHE Code & Institutional Credentials                |
|  2. Admin Desk Verification & Institutional Approval                          |
|  3. Onboard & Manage Department Faculty Mentors (`/university/faculty`)       |
|  4. Monitor Enrolled Student Innovators (`/university/students`)              |
|  5. Track Campus IP, Patents, and Pod Success Metrics                         |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **University Dashboard (`/university`)**:
   - Campus innovation KPI overview: Active Pods, Faculty Mentors, Industry Funding Secured.
2. **Faculty Roster & Invitations**:
   - Send secure email invitation tokens to department professors and track activation status.
3. **Student Roster**:
   - View campus student innovators actively addressing national civic challenges.

---

## 6. 🛡️ Role 6: National Administrator (Governance Desk)

### Workflow Overview
Platform administrators govern platform trust, verify institutional AISHE credentials, approve corporate partners, moderate reported civic problems, trigger AISHE data syncs, and monitor immutable audit logs.

```
+-------------------------------------------------------------------------------+
|  1. National Governance Dashboard (`/admin`)                                  |
|  2. Approve / Reject Institutional & Industry Applications                    |
|  3. Moderate Reported Civic Challenges                                        |
|  4. Trigger Background AISHE Master Data Sync                                 |
|  5. Inspect Tamper-Evident System Audit Trail (`/admin/audit-logs`)           |
+-------------------------------------------------------------------------------+
```

### Key Actions & Pages
1. **Verification Requests Queue (`/admin/requests`)**:
   - Inspect university accreditation documents and corporate CIN/PAN proofs.
   - Approve or reject with recorded administrative justifications.
2. **Challenge Moderation**:
   - Review reported or flagged civic problems to maintain high quality.
3. **Audit Log Explorer (`/admin/audit-logs`)**:
   - Real-time immutable record of all platform authentication, authorization, approval, and funding events with IP tracking and correlation IDs.
