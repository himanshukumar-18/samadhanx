"""End-to-End Test for the AI Moderation Assistant workflow."""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.audit_log import AuditLog
from app.models.enums import AIAnalysisStatus, NotificationType, ProblemStatus, UserRole
from app.models.notification import Notification
from app.models.problem import Problem
from app.models.user import User
from app.ai_engine.providers.fake import FakeAIProvider
from app.ai_engine.services.ai_orchestrator import AIOrchestrator


@pytest.mark.asyncio
async def test_complete_e2e_ai_moderation_flow(async_client: AsyncClient, db_session: AsyncSession):
    # 1. Setup Citizen and Admin accounts
    citizen = User(
        id=uuid.uuid4(),
        email="citizen_sih@test.in",
        hashed_password="pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    admin = User(
        id=uuid.uuid4(),
        email="admin_sih@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    db_session.add_all([citizen, admin])
    await db_session.commit()

    citizen_token = create_access_token(citizen.id, role=UserRole.CITIZEN.value)
    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)


    # 2. Citizen submits problem
    sub_payload = {
        "title": "Severe Sewage Backflow During Monsoon in Ward 5",
        "description": "The open drainage gutter overflows into residential streets during heavy rainfall, blocking school access and causing health hazards.",
        "category": "Water & Sanitation",
        "location": "Ward 5 Main Market",
        "district": "Pune",
        "state": "Maharashtra",
        "impact_level": "high",
    }

    sub_res = await async_client.post(
        "/api/v1/citizen/problems",
        json=sub_payload,
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert sub_res.status_code == 201
    prob_data = sub_res.json()
    problem_id = uuid.UUID(prob_data["id"])

    # 3. AI Orchestrator executes analysis
    provider = FakeAIProvider()
    analysis = await AIOrchestrator.analyze_problem_moderation(
        db=db_session,
        problem_id=problem_id,
        provider=provider,
    )

    assert analysis.status == AIAnalysisStatus.COMPLETED
    assert analysis.category == "Water & Sanitation"
    assert analysis.summary is not None
    assert analysis.spam_probability < 0.1

    # 4. Admin opens Moderation Desk and views AI Analysis
    ai_res = await async_client.get(
        f"/api/v1/admin/problems/{problem_id}/ai-analysis",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ai_res.status_code == 200
    ai_body = ai_res.json()
    assert ai_body["success"] is True
    assert ai_body["data"]["latest"]["summary"] is not None

    # 5. Admin takes human moderation action (approves problem & grants official verification)
    mod_res = await async_client.patch(
        f"/api/v1/admin/problems/{problem_id}/moderate",
        json={"status": ProblemStatus.VERIFIED, "is_verified": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert mod_res.status_code == 200

    mod_data = mod_res.json()
    assert mod_data["status"] == "verified"
    assert mod_data["is_verified"] is True

    # 6. Verify Audit Log was recorded with AI context
    audit_stmt = select(AuditLog).where(
        AuditLog.action == "MODERATE_PROBLEM",
        AuditLog.target_id == str(problem_id),
    )
    audit = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit is not None
    assert audit.metadata_json is not None
    assert "human_decision" in audit.metadata_json

    # 7. Verify Citizen received Notification
    notif_stmt = select(Notification).where(
        Notification.recipient_id == citizen.id,
        Notification.type == NotificationType.PROBLEM_UPDATED,
    )
    notif = (await db_session.execute(notif_stmt)).scalar_one_or_none()
    assert notif is not None
    assert "Verified Challenge" in notif.message
