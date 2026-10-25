"""Tests for Admin AI Moderation API endpoints, permissions, and audit trails."""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import AIAnalysisStatus, ProblemStatus, UserRole
from app.models.problem import Problem
from app.models.problem_ai_analysis import ProblemAIAnalysis
from app.models.user import User


@pytest.mark.asyncio
async def test_admin_get_problem_ai_analysis(async_client: AsyncClient, db_session: AsyncSession):

    # 1. Create admin user and citizen user
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    citizen = User(
        id=uuid.uuid4(),
        email=f"citizen_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add_all([admin, citizen])
    await db_session.flush()

    # 2. Create problem with AI analysis
    problem = Problem(
        id=uuid.uuid4(),
        title="Contaminated Well Water in Ward 12",
        description="High chemical smell and turbidity in the community well.",
        category="Water & Sanitation",
        location="Ward 12",
        district="Madurai",
        state="Tamil Nadu",
        created_by_id=citizen.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.flush()

    ai_analysis = ProblemAIAnalysis(
        id=uuid.uuid4(),
        problem_id=problem.id,
        analysis_version=1,
        status=AIAnalysisStatus.COMPLETED,
        provider="fake",
        model_name="fake-model",
        prompt_version="v1",
        category="Water & Sanitation",
        subcategory="Drinking Water Supply",
        summary="Chemical contamination reported in community well water.",
        keywords=["water", "contamination", "well"],
        spam_probability=0.02,
        quality_score=0.91,
        confidence=0.94,
    )
    db_session.add(ai_analysis)
    await db_session.commit()

    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)
    citizen_token = create_access_token(citizen.id, role=UserRole.CITIZEN.value)


    # 3. Citizen accessing Admin AI API should get 403 Forbidden
    res_citizen = await async_client.get(
        f"/api/v1/admin/problems/{problem.id}/ai-analysis",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_citizen.status_code == 403

    # 4. Admin accessing Admin AI API should get 200 OK with analysis payload
    res_admin = await async_client.get(
        f"/api/v1/admin/problems/{problem.id}/ai-analysis",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200

    body = res_admin.json()
    assert body["success"] is True
    assert body["data"]["latest"]["category"] == "Water & Sanitation"
    assert body["data"]["latest"]["spam_probability"] == 0.02
    assert len(body["data"]["history"]) == 1


@pytest.mark.asyncio
async def test_admin_post_generate_problem_ai_analysis_cached_and_fresh(
    async_client: AsyncClient, db_session: AsyncSession
):
    # 1. Create admin and citizen
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    citizen = User(
        id=uuid.uuid4(),
        email=f"citizen_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add_all([admin, citizen])
    await db_session.flush()

    # 2. Create problem with NO initial AI analysis
    problem = Problem(
        id=uuid.uuid4(),
        title="Overflowing Sewage Drain in Market",
        description="Drainage sewage overflowing onto market road creating health risk.",
        category="Water & Sanitation",
        location="Central Market",
        district="Madurai",
        state="Tamil Nadu",
        created_by_id=citizen.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)

    from unittest.mock import patch
    from app.ai_engine.providers.fake import FakeAIProvider
    from app.ai_engine.config.settings import AISettings

    fake_ai_settings = AISettings(provider="fake")

    with (
        patch("app.ai_engine.services.ai_orchestrator.get_ai_settings", return_value=fake_ai_settings),
        patch("app.ai_engine.services.ai_orchestrator.get_model_provider", return_value=FakeAIProvider()),
        patch("app.ai_engine.services.moderation_service.get_model_provider", return_value=FakeAIProvider()),
        patch("app.ai_engine.services.duplicate_service.get_model_provider", return_value=FakeAIProvider()),
        patch("app.ai_engine.graphs.duplicate_detection.get_model_provider", return_value=FakeAIProvider()),
        patch("app.ai_engine.providers.factory.get_model_provider", return_value=FakeAIProvider()),
    ):
        # 3. Trigger on-demand generation (POST)
        res_post = await async_client.post(
            f"/api/v1/admin/problems/{problem.id}/ai-analysis",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"force": False},
        )
        assert res_post.status_code == 200
        post_body = res_post.json()
        assert post_body["success"] is True
        assert post_body["data"]["status"] == "completed"
        assert post_body["data"]["category"] == "Water & Sanitation"

        # 4. Trigger again immediately -> should return cached result
        res_cached = await async_client.post(
            f"/api/v1/admin/problems/{problem.id}/ai-analysis",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"force": False},
        )
        assert res_cached.status_code == 200
        cached_body = res_cached.json()
        assert cached_body["success"] is True
        assert "cached" in cached_body["message"].lower()

