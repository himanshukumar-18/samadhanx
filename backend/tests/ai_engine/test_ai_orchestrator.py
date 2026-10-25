"""Tests for AIOrchestrator database operations, versioning, and failure resilience."""

import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AIAnalysisStatus, ProblemStatus, UserRole
from app.models.problem import Problem
from app.models.user import User
from app.ai_engine.providers.fake import FakeAIProvider
from app.ai_engine.services.ai_orchestrator import AIOrchestrator


@pytest.mark.asyncio
async def test_orchestrator_analyze_problem_success(db_session: AsyncSession):
    # 1. Create author and problem
    author = User(
        id=uuid.uuid4(),
        email=f"citizen_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="hashed_pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add(author)
    await db_session.flush()

    problem = Problem(
        id=uuid.uuid4(),
        title="Unpaved Road Causing Accidents in Sector 4",
        description="Large potholes and unpaved mud road make vehicle transit dangerous during rain.",
        category="Smart Infrastructure & Roads",
        location="Sector 4",
        district="Noida",
        state="Uttar Pradesh",
        created_by_id=author.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    # 2. Run analysis with FakeAIProvider
    provider = FakeAIProvider()
    analysis = await AIOrchestrator.analyze_problem_moderation(
        db=db_session,
        problem_id=problem.id,
        provider=provider,
    )

    assert analysis.id is not None
    assert analysis.problem_id == problem.id
    assert analysis.analysis_version == 1
    assert analysis.status == AIAnalysisStatus.COMPLETED
    assert analysis.category is not None
    assert analysis.summary is not None
    assert analysis.confidence is not None

    # Verify problem.ai_insight was populated
    await db_session.refresh(problem)
    assert problem.ai_insight is not None
    assert "summary" in problem.ai_insight


@pytest.mark.asyncio
async def test_orchestrator_reanalyze_versioning_and_audit(db_session: AsyncSession):
    # 1. Create admin and problem
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="hashed_pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    db_session.add(admin)
    await db_session.flush()

    problem = Problem(
        id=uuid.uuid4(),
        title="Streetlight Failure in Village",
        description="No streetlights on the village approach road for 3 months.",
        category="Clean Energy & Solar",
        location="Village Road",
        district="Pune",
        state="Maharashtra",
        created_by_id=admin.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    provider = FakeAIProvider()

    # Run initial analysis (v1)
    analysis_v1 = await AIOrchestrator.analyze_problem_moderation(
        db=db_session,
        problem_id=problem.id,
        provider=provider,
    )
    assert analysis_v1.analysis_version == 1

    # Run re-analysis by admin (v2)
    analysis_v2 = await AIOrchestrator.reanalyze_problem(
        db=db_session,
        problem_id=problem.id,
        admin_user=admin,
        reason="Updated context inspection",
        provider=provider,
    )
    assert analysis_v2.analysis_version == 2
    assert analysis_v2.triggered_by_id == admin.id

    # Verify history
    history = await AIOrchestrator.list_analysis_history(db_session, problem.id)
    assert len(history) == 2
    assert history[0].analysis_version == 2
    assert history[1].analysis_version == 1


@pytest.mark.asyncio
async def test_orchestrator_failure_resilience_does_not_corrupt_problem(db_session: AsyncSession):
    author = User(
        id=uuid.uuid4(),
        email=f"citizen_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="hashed_pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add(author)
    await db_session.flush()

    problem = Problem(
        id=uuid.uuid4(),
        title="Critical Bridge Structural Crack",
        description="Visible deep crack along the secondary pillar of the canal bridge.",
        category="Smart Infrastructure & Roads",
        location="Canal Road",
        district="Kochi",
        state="Kerala",
        created_by_id=author.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    # Simulate provider outage
    failing_provider = FakeAIProvider(simulate_error="provider_down")

    analysis = await AIOrchestrator.analyze_problem_moderation(
        db=db_session,
        problem_id=problem.id,
        provider=failing_provider,
    )

    # Status must be FAILED, not unhandled crash
    assert analysis.status == AIAnalysisStatus.FAILED
    assert analysis.error_code in ("AI_PROVIDER_ERROR", "UNEXPECTED_FAILURE")

    # Original problem must be intact
    await db_session.refresh(problem)
    assert problem.id is not None
    assert problem.title == "Critical Bridge Structural Crack"
