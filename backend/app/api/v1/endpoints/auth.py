import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db
from app.core.rate_limit import rate_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    get_password_hash,
    verify_password,
)
from app.models.audit_log import AuditLog
from app.models.enums import OrgType, OTPPurpose, RequestStatus, UserRole
from app.models.institution_master import InstitutionMaster
from app.models.otp import OTPVerification
from app.models.profiles import (
    CitizenProfile,
    IndustryProfile,
    StudentProfile,
    UniversityProfile,
)
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    OTPResendRequest,
    OTPVerifyRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    Token,
)
from app.schemas.common import StandardApiResponse
from app.schemas.user import (
    CitizenRegister,
    IndustryRequestRegister,
    StudentRegister,
    UniversityListItem,
    UniversityRequestRegister,
    UserResponse,
)
from app.tasks.email import send_otp_email_task, send_welcome_email_task

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def record_audit(db: AsyncSession, action: str, target_type: str, target_id: str, actor_id: uuid.UUID | None = None, metadata: dict = None):
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        metadata_json=metadata or {},
    )
    db.add(log)


# 1. Public list of approved universities for Student dropdown
@router.get("/universities", response_model=StandardApiResponse[list[UniversityListItem]])
async def list_approved_universities(db: AsyncSession = Depends(get_db)):
    query = select(UniversityProfile).where(UniversityProfile.is_approved.is_(True)).order_by(UniversityProfile.university_name)
    result = await db.execute(query)
    universities = result.scalars().all()
    items = [
        UniversityListItem(
            id=u.id,
            university_name=u.university_name,
            state=u.state,
            district=u.district,
            is_approved=u.is_approved,
        )
        for u in universities
    ]
    return StandardApiResponse(success=True, data=items)


# 2. Register Citizen (Public self-register)
@router.post("/register/citizen", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(10, "rl_reg_citizen"))])
async def register_citizen(data: CitizenRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists."},
        )

    user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.CITIZEN,
        is_verified=False,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.flush()

    profile = CitizenProfile(
        user_id=user.id,
        full_name=data.full_name,
        phone_number=data.phone_number,
        location=data.location,
        district=data.district,
        state=data.state,
    )
    db.add(profile)

    otp_code = generate_otp(6)
    otp_record = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(otp_record)
    await record_audit(db, "REGISTER_CITIZEN", "user", str(user.id), user.id, {"email": user.email})
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, "registration")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"user_id": str(user.id), "email": user.email, "role": user.role.value},
        message="Citizen account registered. Please verify your email with the 6-digit OTP.",
    )


# 3. Register Student (Public self-register, requires approved university)
@router.post("/register/student", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(10, "rl_reg_student"))])
async def register_student(data: StudentRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists."},
        )

    inst_master = None
    target_univ_id = None
    target_inst_id = None

    if data.institution_id:
        inst_query = select(InstitutionMaster).where(
            and_(InstitutionMaster.id == data.institution_id, InstitutionMaster.verification_status == "verified", InstitutionMaster.is_active.is_(True))
        )
        inst_master = (await db.execute(inst_query)).scalar_one_or_none()
        if not inst_master:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_INSTITUTION", "message": "Selected institution is unverified, suspended, or does not exist."},
            )
        target_inst_id = inst_master.id

        # Check if an approved university profile exists for this institution
        univ_profile_res = await db.execute(select(UniversityProfile).where(UniversityProfile.institution_id == inst_master.id))
        univ_prof = univ_profile_res.scalar_one_or_none()
        if univ_prof:
            target_univ_id = univ_prof.id
        else:
            # Fallback to any approved university or first university profile
            any_univ = (await db.execute(select(UniversityProfile).where(UniversityProfile.is_approved.is_(True)))).scalars().first()
            if any_univ:
                target_univ_id = any_univ.id

    if not target_univ_id and data.university_id:
        univ_query = select(UniversityProfile).where(
            and_(UniversityProfile.id == data.university_id, UniversityProfile.is_approved.is_(True))
        )
        univ_result = await db.execute(univ_query)
        university = univ_result.scalar_one_or_none()
        if not university:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_UNIVERSITY", "message": "Selected university is not approved or does not exist."},
            )
        target_univ_id = university.id
        target_inst_id = university.institution_id

    if not target_univ_id and not target_inst_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INSTITUTION", "message": "Please select a valid, verified university or institution."},
        )

    user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.STUDENT,
        is_verified=False,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.flush()

    profile = StudentProfile(
        user_id=user.id,
        full_name=data.full_name,
        university_id=target_univ_id,
        institution_id=target_inst_id,
        enrollment_number=data.enrollment_number,
        department=data.department,
        graduation_year=data.graduation_year,
        skills=data.skills or [],
    )
    db.add(profile)

    otp_code = generate_otp(6)
    otp_record = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(otp_record)
    inst_label = inst_master.name if inst_master else "Institution"
    await record_audit(db, "REGISTER_STUDENT", "user", str(user.id), user.id, {"email": user.email, "institution": inst_label})
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, "registration")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"user_id": str(user.id), "email": user.email, "role": user.role.value},
        message="Student account registered. Please verify your email with the 6-digit OTP.",
    )


# 4. University Request Registration (Goes to Pending for Admin Approval)
@router.post("/register/university-request", response_model=StandardApiResponse[dict])
async def register_university_request(data: UniversityRequestRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists."},
        )

    user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.UNIVERSITY,
        is_verified=False,
        is_active=True,
        is_approved=False,
    )
    db.add(user)
    await db.flush()

    profile = UniversityProfile(
        user_id=user.id,
        university_name=data.university_name,
        aishe_code=data.aishe_code,
        state=data.state,
        district=data.district,
        nodal_officer_name=data.nodal_officer_name,
        official_email=data.official_email.lower(),
        website=data.website,
        is_approved=False,
    )
    db.add(profile)

    request_record = RestrictedAccountRequest(
        user_id=user.id,
        org_type=OrgType.UNIVERSITY,
        org_name=data.university_name,
        registration_identifier=data.aishe_code,
        nodal_officer_name=data.nodal_officer_name,
        official_email=data.official_email.lower(),
        status=RequestStatus.PENDING,
    )
    db.add(request_record)

    otp_code = generate_otp(6)
    otp_record = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(otp_record)
    await record_audit(db, "REQUEST_UNIVERSITY_ACCESS", "request", str(request_record.id), user.id, {"org_name": data.university_name})
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, "registration")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"user_id": str(user.id), "email": user.email, "role": user.role.value, "status": "pending_approval"},
        message="University request submitted. Please verify OTP. Your account will undergo administrator review.",
    )


# 5. Industry Request Registration (Goes to Pending for Admin Approval)
@router.post("/register/industry-request", response_model=StandardApiResponse[dict])
async def register_industry_request(data: IndustryRequestRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists."},
        )

    user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.INDUSTRY,
        is_verified=False,
        is_active=True,
        is_approved=False,
    )
    db.add(user)
    await db.flush()

    profile = IndustryProfile(
        user_id=user.id,
        company_name=data.company_name,
        cin_number=data.cin_number,
        website=data.website,
        point_of_contact_name=data.point_of_contact_name,
        designation=data.designation,
        focus_sectors=data.focus_sectors or [],
        is_approved=False,
    )
    db.add(profile)

    request_record = RestrictedAccountRequest(
        user_id=user.id,
        org_type=OrgType.INDUSTRY,
        org_name=data.company_name,
        registration_identifier=data.cin_number,
        nodal_officer_name=data.point_of_contact_name,
        official_email=data.email.lower(),
        status=RequestStatus.PENDING,
    )
    db.add(request_record)

    otp_code = generate_otp(6)
    otp_record = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(otp_record)
    await record_audit(db, "REQUEST_INDUSTRY_ACCESS", "request", str(request_record.id), user.id, {"company_name": data.company_name})
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, "registration")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"user_id": str(user.id), "email": user.email, "role": user.role.value, "status": "pending_approval"},
        message="Industry request submitted. Please verify OTP. Your account will undergo administrator review.",
    )


# 6. Verify OTP
@router.post("/verify-otp", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(15, "rl_verify_otp"))])
async def verify_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    user_query = (
        select(User)
        .options(
            selectinload(User.citizen_profile),
            selectinload(User.student_profile),
            selectinload(User.university_profile),
            selectinload(User.industry_profile),
        )
        .where(User.email == data.email.lower())
    )
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "No account associated with this email address."},
        )

    otp_query = (
        select(OTPVerification)
        .where(
            and_(
                OTPVerification.email == data.email.lower(),
                OTPVerification.purpose == data.purpose,
                OTPVerification.is_used.is_(False),
            )
        )
        .order_by(OTPVerification.created_at.desc())
    )
    otp_result = await db.execute(otp_query)
    otp_record = otp_result.scalars().first()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "OTP_NOT_FOUND", "message": "No active OTP request found. Please request a new OTP."},
        )

    if otp_record.attempt_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "MAX_ATTEMPTS_EXCEEDED", "message": "Too many failed attempts. Please request a new OTP."},
        )

    expires = otp_record.expires_at if otp_record.expires_at.tzinfo else otp_record.expires_at.replace(tzinfo=UTC)
    if datetime.now(UTC) > expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "OTP_EXPIRED", "message": "Your OTP has expired. Please request a new one."},
        )

    if otp_record.otp_code != data.otp_code:
        otp_record.attempt_count += 1
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_OTP", "message": f"Incorrect OTP code. {5 - otp_record.attempt_count} attempts remaining."},
        )

    otp_record.is_used = True
    user.is_verified = True
    await record_audit(db, "VERIFY_OTP_SUCCESS", "user", str(user.id), user.id)
    await db.commit()

    full_name = user.email
    if user.citizen_profile:
        full_name = user.citizen_profile.full_name
    elif user.student_profile:
        full_name = user.student_profile.full_name

    if user.role in [UserRole.CITIZEN, UserRole.STUDENT]:
        try:
            send_welcome_email_task.delay(user.email, full_name, user.role.value)
        except Exception:
            pass

    return StandardApiResponse(
        success=True,
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "is_verified": True,
            "is_approved": user.is_approved,
        },
        message="Email verified successfully. You can now access the platform.",
    )


# 7. Resend OTP
@router.post("/resend-otp", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(5, "rl_resend_otp"))])
async def resend_otp(data: OTPResendRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == data.email.lower()))).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "No account associated with this email address."},
        )

    recent_otps = (
        await db.execute(
            select(OTPVerification).where(
                and_(
                    OTPVerification.email == data.email.lower(),
                    OTPVerification.created_at >= datetime.now(UTC) - timedelta(minutes=10),
                )
            )
        )
    ).scalars().all()

    if len(recent_otps) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMIT_EXCEEDED", "message": "Maximum OTP resend requests reached. Please wait 10 minutes."},
        )

    otp_code = generate_otp(6)
    new_otp = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=data.purpose,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(new_otp)
    await record_audit(db, "RESEND_OTP", "user", str(user.id), user.id)
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, data.purpose.value)
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"email": user.email},
        message="A new OTP has been dispatched to your email.",
    )


# 8. Forgot Password (Request Reset OTP)
@router.post("/forgot-password", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(5, "rl_forgot_pw"))])
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == data.email.lower()))).scalar_one_or_none()

    # Generic response to prevent email enumeration
    if not user:
        return StandardApiResponse(
            success=True,
            data={"email": data.email.lower()},
            message="If an account with this email exists, a password reset OTP has been dispatched.",
        )

    otp_code = generate_otp(6)
    otp_record = OTPVerification(
        email=user.email,
        otp_code=otp_code,
        purpose=OTPPurpose.PASSWORD_RESET,
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    db.add(otp_record)
    await record_audit(db, "FORGOT_PASSWORD_REQUEST", "user", str(user.id), user.id)
    await db.commit()

    try:
        send_otp_email_task.delay(user.email, otp_code, "password_reset")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={"email": user.email},
        message="If an account with this email exists, a password reset OTP has been dispatched.",
    )


# 9. Reset Password (Verify Reset OTP & Set New Password)
@router.post("/reset-password", response_model=StandardApiResponse[dict], dependencies=[Depends(rate_limiter(5, "rl_reset_pw"))])
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == data.email.lower()))).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "No account associated with this email address."},
        )

    otp_query = (
        select(OTPVerification)
        .where(
            and_(
                OTPVerification.email == data.email.lower(),
                OTPVerification.purpose == OTPPurpose.PASSWORD_RESET,
                OTPVerification.is_used.is_(False),
            )
        )
        .order_by(OTPVerification.created_at.desc())
    )
    otp_record = (await db.execute(otp_query)).scalars().first()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "OTP_NOT_FOUND", "message": "No active password reset request found."},
        )

    expires = otp_record.expires_at if otp_record.expires_at.tzinfo else otp_record.expires_at.replace(tzinfo=UTC)
    if datetime.now(UTC) > expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "OTP_EXPIRED", "message": "Your reset OTP has expired. Please request a new one."},
        )

    if otp_record.otp_code != data.otp_code:
        otp_record.attempt_count += 1
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_OTP", "message": "Incorrect OTP code."},
        )

    # Invalidate OTP & update user password hash
    otp_record.is_used = True
    user.hashed_password = get_password_hash(data.new_password)
    await record_audit(db, "RESET_PASSWORD_SUCCESS", "user", str(user.id), user.id)
    await db.commit()

    return StandardApiResponse(
        success=True,
        message="Password reset successfully. You can now login with your new password.",
    )


# 10. Login
@router.post("/login", response_model=StandardApiResponse[Token], dependencies=[Depends(rate_limiter(15, "rl_login"))])
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    query = (
        select(User)
        .options(
            selectinload(User.citizen_profile),
            selectinload(User.student_profile),
            selectinload(User.faculty_profile),
            selectinload(User.industry_profile),
            selectinload(User.university_profile),
            selectinload(User.restricted_request),
        )
        .where(User.email == data.email.lower())
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        await record_audit(db, "LOGIN_FAILED", "auth", data.email.lower(), metadata={"reason": "INVALID_CREDENTIALS"})
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Incorrect email or password."},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_DEACTIVATED", "message": "This account has been deactivated."},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "EMAIL_NOT_VERIFIED", "message": "Please verify your email with OTP before logging in."},
        )

    if user.role in [UserRole.UNIVERSITY, UserRole.INDUSTRY]:
        if not user.is_approved:
            req_status = user.restricted_request.status if user.restricted_request else RequestStatus.PENDING
            if req_status == RequestStatus.REJECTED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "ACCOUNT_REJECTED",
                        "message": f"Your institutional request was not approved. Reason: {user.restricted_request.rejection_reason if user.restricted_request else 'N/A'}",
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCOUNT_PENDING_APPROVAL", "message": "Your institutional account is pending administrative approval."},
            )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    await record_audit(db, "LOGIN_SUCCESS", "user", str(user.id), user.id)
    await db.commit()

    return StandardApiResponse(
        success=True,
        data=Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_id=str(user.id),
            email=user.email,
            role=user.role,
            is_verified=user.is_verified,
            is_approved=user.is_approved,
        ),
        message="Login successful.",
    )


# 11. Refresh Token
@router.post("/refresh", response_model=StandardApiResponse[dict])
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token is invalid or expired."},
        )

    user_id = uuid.UUID(payload.get("sub"))
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_INACTIVE", "message": "User session is no longer valid."},
        )

    new_access_token = create_access_token(user.id, user.role.value)
    new_refresh_token = create_refresh_token(user.id, user.role.value)

    return StandardApiResponse(
        success=True,
        data={"access_token": new_access_token, "refresh_token": new_refresh_token, "token_type": "bearer"},
    )


# 12. Logout
@router.post("/logout", response_model=StandardApiResponse[dict])
async def logout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await record_audit(db, "LOGOUT", "user", str(current_user.id), current_user.id)
    await db.commit()
    return StandardApiResponse(success=True, message="Logged out successfully.")


# 13. Get Current User (/me)
@router.get("/me", response_model=StandardApiResponse[UserResponse])
async def get_me(current_user: User = Depends(get_current_user)):
    full_name = None
    org_name = None

    if current_user.citizen_profile:
        full_name = current_user.citizen_profile.full_name
    elif current_user.student_profile:
        full_name = current_user.student_profile.full_name
        if current_user.student_profile.university:
            org_name = current_user.student_profile.university.university_name
    elif current_user.faculty_profile:
        full_name = current_user.faculty_profile.full_name
        if current_user.faculty_profile.university:
            org_name = current_user.faculty_profile.university.university_name
    elif current_user.university_profile:
        full_name = current_user.university_profile.nodal_officer_name
        org_name = current_user.university_profile.university_name
    elif current_user.industry_profile:
        full_name = current_user.industry_profile.point_of_contact_name
        org_name = current_user.industry_profile.company_name

    return StandardApiResponse(
        success=True,
        data=UserResponse(
            id=current_user.id,
            email=current_user.email,
            role=current_user.role,
            is_verified=current_user.is_verified,
            is_approved=current_user.is_approved,
            is_active=current_user.is_active,
            full_name=full_name,
            organization_name=org_name,
        ),
    )
