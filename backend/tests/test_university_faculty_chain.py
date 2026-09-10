import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import InvitationStatus, OTPPurpose, RequestStatus, UserRole
from app.models.institution_master import InstitutionMaster
from app.models.invitation import FacultyInvitation
from app.models.otp import OTPVerification
from app.models.profiles import FacultyProfile, StudentProfile, UniversityProfile
from app.models.project import SolutionProject
from app.models.problem import Problem
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User


@pytest.mark.asyncio
async def test_university_registration_and_admin_approval_chain(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: User,
):
    # 1. Seed InstitutionMaster
    inst_master = InstitutionMaster(
        name="Indian Institute of Technology Bombay",
        normalized_name="indian institute of technology bombay",
        aishe_code="U-0306",
        ugc_code="UGC-IITB",
        state="Maharashtra",
        district="Mumbai Suburban",
        is_active=True,
    )
    db_session.add(inst_master)
    await db_session.commit()
    await db_session.refresh(inst_master)

    # 2. Register University Request
    reg_payload = {
        "email": "nodal@iitb.ac.in",
        "password": "StrongPassword123!",
        "university_name": "IIT Bombay",
        "institution_id": str(inst_master.id),
        "aishe_code": "U-0306",
        "state": "Maharashtra",
        "district": "Mumbai Suburban",
        "nodal_officer_name": "Prof. Subhasis Chaudhuri",
        "official_email": "nodal@iitb.ac.in",
        "website": "https://www.iitb.ac.in",
    }
    reg_res = await async_client.post("/api/v1/auth/register/university-request", json=reg_payload)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()["data"]
    assert reg_data["email"] == "nodal@iitb.ac.in"
    assert reg_data["role"] == "university"
    assert reg_data["status"] == "pending_approval"

    # 3. Retrieve OTP and Verify Email
    otp_record = (
        await db_session.execute(
            select(OTPVerification).where(
                OTPVerification.email == "nodal@iitb.ac.in",
                OTPVerification.purpose == OTPPurpose.REGISTRATION,
            )
        )
    ).scalar_one_or_none()
    assert otp_record is not None

    verify_res = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "nodal@iitb.ac.in", "otp_code": otp_record.otp_code, "purpose": "registration"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["data"]["is_verified"] is True
    assert verify_res.json()["data"]["is_approved"] is False

    # 4. Attempt login before Admin Approval -> HTTP 403 ACCOUNT_PENDING_APPROVAL
    login_fail_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nodal@iitb.ac.in", "password": "StrongPassword123!"},
    )
    assert login_fail_res.status_code == 403
    assert login_fail_res.json()["error"]["code"] == "ACCOUNT_PENDING_APPROVAL"

    # 5. Admin Approves the Request
    admin_token = create_access_token(seed_admin.id, seed_admin.role.value)
    req_record = (
        await db_session.execute(
            select(RestrictedAccountRequest).where(RestrictedAccountRequest.official_email == "nodal@iitb.ac.in")
        )
    ).scalar_one_or_none()
    assert req_record is not None

    approve_res = await async_client.patch(
        f"/api/v1/admin/requests/{req_record.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_res.status_code == 200

    # 6. University Logs in Successfully
    login_success_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nodal@iitb.ac.in", "password": "StrongPassword123!"},
    )
    assert login_success_res.status_code == 200
    univ_auth_data = login_success_res.json()["data"]
    assert univ_auth_data["role"] == "university"
    assert univ_auth_data["is_approved"] is True
    assert "access_token" in univ_auth_data


@pytest.mark.asyncio
async def test_faculty_invitation_acceptance_and_onboarding(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seed_approved_university: tuple[User, UniversityProfile],
):
    univ_user, univ_prof = seed_approved_university
    univ_token = create_access_token(univ_user.id, univ_user.role.value)

    # 1. University Invites Faculty Mentor
    invite_payload = {
        "email": "dr.kavita@iitd.ac.in",
        "full_name": "Dr. Kavita Sharma",
        "department": "Computer Science & Engineering",
        "designation": "Associate Professor",
        "research_areas": ["Artificial Intelligence", "NLP", "Robotics"],
    }
    invite_res = await async_client.post(
        "/api/v1/university/faculty/invite",
        json=invite_payload,
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    assert invite_res.status_code == 200
    invite_data = invite_res.json()["data"]
    assert invite_data["email"] == "dr.kavita@iitd.ac.in"
    assert invite_data["status"] == "pending"

    # Query DB to get token hash
    invitation_record = (
        await db_session.execute(
            select(FacultyInvitation).where(FacultyInvitation.email == "dr.kavita@iitd.ac.in")
        )
    ).scalar_one_or_none()
    assert invitation_record is not None

    # Test Public Invitation Inspection with invalid token
    bad_res = await async_client.get("/api/v1/auth/invitations/invalid-nonexistent-token-123")
    assert bad_res.status_code == 404
    assert bad_res.json()["error"]["code"] == "INVITATION_NOT_FOUND"

    # 2. Resend Invitation (updates token)
    resend_res = await async_client.post(
        f"/api/v1/university/faculty/invitations/{invitation_record.id}/resend",
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    # Could be rate-limited if under 2 minutes
    assert resend_res.status_code in [200, 429]

    # Directly create a known token test
    import hashlib
    plain_test_token = "test_secure_faculty_invitation_token_abc123"
    invitation_record.token_hash = hashlib.sha256(plain_test_token.encode("utf-8")).hexdigest()
    await db_session.commit()

    # 3. Public Validate Invitation Details
    val_res = await async_client.get(f"/api/v1/auth/invitations/{plain_test_token}")
    assert val_res.status_code == 200
    val_data = val_res.json()["data"]
    assert val_data["university_name"] == univ_prof.university_name
    assert val_data["email"] == "dr.kavita@iitd.ac.in"
    assert val_data["full_name"] == "Dr. Kavita Sharma"
    assert val_data["is_valid"] is True

    # 4. Faculty Accepts Invitation and Sets Password
    accept_payload = {
        "password": "FacultySecurePassword999!",
        "full_name": "Dr. Kavita Sharma",
        "department": "Computer Science & Engineering",
        "designation": "Associate Professor",
        "research_areas": ["AI", "Robotics"],
    }
    accept_res = await async_client.post(
        f"/api/v1/auth/invitations/{plain_test_token}/accept",
        json=accept_payload,
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["data"]["email"] == "dr.kavita@iitd.ac.in"
    assert accept_res.json()["data"]["role"] == "faculty"

    # Verify invitation marked ACCEPTED
    await db_session.refresh(invitation_record)
    assert invitation_record.status == InvitationStatus.ACCEPTED
    assert invitation_record.accepted_at is not None

    # Negative test: Second attempt to accept same token -> 400 ALREADY_ACCEPTED
    second_accept = await async_client.post(
        f"/api/v1/auth/invitations/{plain_test_token}/accept",
        json=accept_payload,
    )
    assert second_accept.status_code == 400
    assert second_accept.json()["error"]["code"] == "INVITATION_ALREADY_ACCEPTED"

    # 5. Verify Faculty OTP
    faculty_otp = (
        await db_session.execute(
            select(OTPVerification).where(
                OTPVerification.email == "dr.kavita@iitd.ac.in",
                OTPVerification.purpose == OTPPurpose.REGISTRATION,
            )
        )
    ).scalar_one_or_none()
    assert faculty_otp is not None

    fac_verify_res = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "dr.kavita@iitd.ac.in", "otp_code": faculty_otp.otp_code, "purpose": "registration"},
    )
    assert fac_verify_res.status_code == 200
    assert fac_verify_res.json()["data"]["is_verified"] is True

    # 6. Faculty Logs In
    fac_login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.kavita@iitd.ac.in", "password": "FacultySecurePassword999!"},
    )
    assert fac_login_res.status_code == 200
    fac_auth = fac_login_res.json()["data"]
    assert fac_auth["role"] == "faculty"
    assert fac_auth["is_verified"] is True
    assert fac_auth["is_approved"] is True


@pytest.mark.asyncio
async def test_faculty_dashboard_and_mentorship_review(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seed_approved_university: tuple[User, UniversityProfile],
):
    univ_user, univ_prof = seed_approved_university

    # 1. Create Faculty User & Profile
    faculty_user = User(
        email="mentor.singh@iitd.ac.in",
        hashed_password=get_password_hash("MentorPass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(faculty_user)
    await db_session.flush()

    fac_prof = FacultyProfile(
        user_id=faculty_user.id,
        university_id=univ_prof.id,
        created_by=univ_user.id,
        full_name="Prof. R. Singh",
        department="Mechanical Engineering",
        designation="Professor",
        research_areas=["Thermal Systems"],
    )
    db_session.add(fac_prof)

    # 2. Create Student Lead
    student_user = User(
        email="student.innovator@iitd.ac.in",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)
    await db_session.flush()

    stu_prof = StudentProfile(
        user_id=student_user.id,
        university_id=univ_prof.id,
        full_name="Aarav Verma",
        department="Mechanical Engineering",
    )
    db_session.add(stu_prof)

    # 3. Create Problem & Assigned Project
    problem = Problem(
        created_by_id=student_user.id,
        title="Solar Water Desalination Unit",
        description="Low-cost solar thermal desalination for coastal communities.",
        category="Water",
        location="Coastal Tamil Nadu",
        district="Ramanathapuram",
        state="Tamil Nadu",
    )
    db_session.add(problem)
    await db_session.flush()

    project = SolutionProject(
        problem_id=problem.id,
        team_name="AquaSolar Team",
        title="Passive Solar Still Prototype",
        description="High efficiency multi-effect solar still with vacuum tube collector.",
        lead_student_id=student_user.id,
        faculty_mentor_id=faculty_user.id,
        university_id=univ_prof.id,
    )
    db_session.add(project)
    await db_session.commit()

    faculty_token = create_access_token(faculty_user.id, faculty_user.role.value)

    # 4. Faculty Queries Dashboard
    dash_res = await async_client.get(
        "/api/v1/faculty/dashboard",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["faculty_name"] == "Prof. R. Singh"
    assert dash_data["university_name"] == univ_prof.university_name
    assert dash_data["assigned_projects_count"] >= 1
    assert len(dash_data["assigned_projects"]) >= 1

    # 5. Faculty Submits Project Review
    review_res = await async_client.post(
        f"/api/v1/faculty/projects/{project.id}/reviews",
        json={
            "decision": "approved",
            "feedback_text": "Excellent thermal efficiency metrics. The condenser design is validated. Approved for pilot.",
        },
        headers={"Authorization": f"Bearer {faculty_token}"},
    )
    assert review_res.status_code == 201
    assert review_res.json()["decision"] == "approved"


@pytest.mark.asyncio
async def test_idor_and_security_protections(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seed_approved_university: tuple[User, UniversityProfile],
):
    univ_a_user, univ_a_prof = seed_approved_university
    univ_a_token = create_access_token(univ_a_user.id, univ_a_user.role.value)

    # 1. Create University B
    univ_b_user = User(
        email="nodal@iitk.ac.in",
        hashed_password=get_password_hash("UnivBPass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(univ_b_user)
    await db_session.flush()

    univ_b_prof = UniversityProfile(
        user_id=univ_b_user.id,
        university_name="IIT Kanpur",
        aishe_code="U-0500",
        state="Uttar Pradesh",
        district="Kanpur",
        nodal_officer_name="Dr. Kanpur Nodal",
        official_email="nodal@iitk.ac.in",
        is_approved=True,
    )
    db_session.add(univ_b_prof)
    await db_session.commit()

    univ_b_token = create_access_token(univ_b_user.id, univ_b_user.role.value)

    # 2. University A invites Faculty Member
    invite_res = await async_client.post(
        "/api/v1/university/faculty/invite",
        json={
            "email": "prof.alpha@iitd.ac.in",
            "full_name": "Prof. Alpha",
            "department": "Civil Engineering",
            "designation": "Professor",
        },
        headers={"Authorization": f"Bearer {univ_a_token}"},
    )
    assert invite_res.status_code == 200
    invitation_a_id = invite_res.json()["data"]["id"]

    # 3. IDOR Attack 1: University B attempts to resend University A's invitation
    resend_attack = await async_client.post(
        f"/api/v1/university/faculty/invitations/{invitation_a_id}/resend",
        headers={"Authorization": f"Bearer {univ_b_token}"},
    )
    assert resend_attack.status_code == 404
    assert resend_attack.json()["error"]["code"] == "INVITATION_NOT_FOUND"

    # 4. IDOR Attack 2: University B attempts to revoke University A's invitation
    revoke_attack = await async_client.delete(
        f"/api/v1/university/faculty/invitations/{invitation_a_id}",
        headers={"Authorization": f"Bearer {univ_b_token}"},
    )
    assert revoke_attack.status_code == 404
    assert revoke_attack.json()["error"]["code"] == "INVITATION_NOT_FOUND"

    # 5. IDOR Attack 3: University B attempts to deactivate University A's faculty member
    fac_user = User(
        email="prof.delhi.faculty@iitd.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(fac_user)
    await db_session.flush()

    fac_a_prof = FacultyProfile(
        user_id=fac_user.id,
        university_id=univ_a_prof.id,
        created_by=univ_a_user.id,
        full_name="Prof. Delhi Resident",
        department="Chemistry",
        designation="Professor",
    )
    db_session.add(fac_a_prof)
    await db_session.commit()

    deactivate_attack = await async_client.patch(
        f"/api/v1/university/faculty/{fac_a_prof.id}/status",
        headers={"Authorization": f"Bearer {univ_b_token}"},
    )
    assert deactivate_attack.status_code == 404
    assert deactivate_attack.json()["error"]["code"] == "FACULTY_NOT_FOUND"

    # 6. Legitimate University A deactivates its own faculty member
    legit_toggle = await async_client.patch(
        f"/api/v1/university/faculty/{fac_a_prof.id}/status",
        headers={"Authorization": f"Bearer {univ_a_token}"},
    )
    assert legit_toggle.status_code == 200
    assert legit_toggle.json()["data"]["is_active"] is False

    # 7. Unapproved University Denial Check
    unapproved_univ_user = User(
        email="unapproved@fakeuniv.edu",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=False,
    )
    db_session.add(unapproved_univ_user)
    await db_session.commit()
    unapproved_token = create_access_token(unapproved_univ_user.id, unapproved_univ_user.role.value)

    blocked_invite = await async_client.post(
        "/api/v1/university/faculty/invite",
        json={"email": "victim@univ.edu", "full_name": "Victim", "department": "EE", "designation": "Professor"},
        headers={"Authorization": f"Bearer {unapproved_token}"},
    )
    assert blocked_invite.status_code == 403
    assert blocked_invite.json()["error"]["code"] == "UNIVERSITY_NOT_APPROVED"
