from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.enums import OTPPurpose, UserRole
from app.models.otp import OTPVerification
from app.models.user import User


@pytest.mark.asyncio
async def test_verify_otp_success(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="test_otp@example.com",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=False,
        is_active=True,
    )
    db_session.add(user)
    otp = OTPVerification(
        email="test_otp@example.com",
        otp_code="123456",
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.commit()

    verify_payload = {
        "email": "test_otp@example.com",
        "otp_code": "123456",
        "purpose": "registration",
    }
    response = await async_client.post("/api/v1/auth/verify-otp", json=verify_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["is_verified"] is True

    # Expire cache and re-query
    db_session.expire_all()
    refreshed_user = (await db_session.execute(select(User).where(User.email == "test_otp@example.com"))).scalar_one_or_none()
    assert refreshed_user.is_verified is True

@pytest.mark.asyncio
async def test_verify_otp_invalid_code(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="test_invalid@example.com",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=False,
    )
    db_session.add(user)
    otp = OTPVerification(
        email="test_invalid@example.com",
        otp_code="654321",
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.commit()

    verify_payload = {
        "email": "test_invalid@example.com",
        "otp_code": "000000",
        "purpose": "registration",
    }
    response = await async_client.post("/api/v1/auth/verify-otp", json=verify_payload)
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "INVALID_OTP"

@pytest.mark.asyncio
async def test_verify_otp_expired(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="test_expired@example.com",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=False,
    )
    db_session.add(user)
    otp = OTPVerification(
        email="test_expired@example.com",
        otp_code="888888",
        purpose=OTPPurpose.REGISTRATION,
        expires_at=datetime.now(UTC) - timedelta(minutes=2),
    )
    db_session.add(otp)
    await db_session.commit()

    verify_payload = {
        "email": "test_expired@example.com",
        "otp_code": "888888",
        "purpose": "registration",
    }
    response = await async_client.post("/api/v1/auth/verify-otp", json=verify_payload)
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "OTP_EXPIRED"
