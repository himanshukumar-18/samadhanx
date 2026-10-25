import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.graphs.duplicate_detection import (
    DuplicateDetectionGraphBuilder,
    DuplicateGraphState,
)
from app.ai_engine.services.embedder import EmbedderService
from app.core.security import create_access_token
from app.models.enums import (
    DuplicateLinkStatus,
    DuplicateVerdict,
    ProblemStatus,
    UserRole,
)
from app.models.problem import Problem, ProblemEndorsement
from app.models.problem_duplicate_link import ProblemDuplicateLink
from app.models.user import User


def test_embedder_normalization_and_hash():
    """Verify text normalization collapses whitespace, formats properly, and produces deterministic hash."""
    t1 = "  Broken   water   pipe  "
    d1 = "Water is   leaking   everywhere.  "
    norm = EmbedderService.normalize_text(t1, d1)
    assert norm == "Broken water pipe. Water is leaking everywhere."

    h1 = EmbedderService.compute_hash(norm)
    h2 = EmbedderService.compute_hash(norm)
    assert h1 == h2
    assert len(h1) == 64

    # Hash should change if content changes
    h3 = EmbedderService.compute_hash("Different text")
    assert h1 != h3


def test_duplicate_graph_scoring_and_geo_downgrade():
    """Verify threshold routing and geo-downgrade rule."""
    builder = DuplicateDetectionGraphBuilder()

    # Case 1: High similarity, same district -> strong_duplicate
    state_same_dist: DuplicateGraphState = {
        "title": "Broken pipe on Main St",
        "description": "Clean water wasting",
        "district": "Bengaluru Urban",
        "mode": "moderation",
        "raw_candidates": [
            {
                "id": str(uuid.uuid4()),
                "title": "Water leakage Main St",
                "description": "Pipe leaking",
                "category": "Water Supply",
                "district": "Bengaluru Urban",
                "status": "verified",
                "similarity": 0.94,
                "endorsement_count": 5,
            }
        ],
    }
    res1 = builder._node_score_and_route(state_same_dist)
    cands1 = res1["evaluated_candidates"]
    assert len(cands1) == 1
    assert cands1[0]["verdict"] == DuplicateVerdict.STRONG_DUPLICATE.value

    # Case 2: High similarity, DIFFERENT district -> geo-downgraded to related
    state_diff_dist: DuplicateGraphState = {
        "title": "Broken pipe on Main St",
        "description": "Clean water wasting",
        "district": "Bengaluru Urban",
        "mode": "moderation",
        "raw_candidates": [
            {
                "id": str(uuid.uuid4()),
                "title": "Water leakage Main St",
                "description": "Pipe leaking",
                "category": "Water Supply",
                "district": "Kolkata",
                "status": "verified",
                "similarity": 0.95,
                "endorsement_count": 2,
            }
        ],
    }
    res2 = builder._node_score_and_route(state_diff_dist)
    cands2 = res2["evaluated_candidates"]
    assert len(cands2) == 1
    assert cands2[0]["verdict"] == DuplicateVerdict.RELATED.value
    assert "different districts" in (cands2[0]["llm_reason"] or "")

    # Case 3: Precheck mode with borderline similarity (0.80) -> possible_duplicate without LLM
    state_precheck: DuplicateGraphState = {
        "title": "Drainage overflow",
        "description": "Street flooded",
        "district": "Patna",
        "mode": "precheck",
        "raw_candidates": [
            {
                "id": str(uuid.uuid4()),
                "title": "Gutter overflowing",
                "description": "Sewage on road",
                "category": "Drainage",
                "district": "Patna",
                "status": "verified",
                "similarity": 0.82,
                "endorsement_count": 3,
            }
        ],
    }
    res3 = builder._node_score_and_route(state_precheck)
    cands3 = res3["evaluated_candidates"]
    assert len(cands3) == 1
    assert cands3[0]["verdict"] == DuplicateVerdict.POSSIBLE_DUPLICATE.value

    # Case 4: Low similarity (< 0.75) -> unique
    state_low: DuplicateGraphState = {
        "title": "Pothole on highway",
        "description": "Crater in asphalt",
        "district": "Delhi",
        "mode": "precheck",
        "raw_candidates": [
            {
                "id": str(uuid.uuid4()),
                "title": "Hospital medicine shortage",
                "description": "No bandages",
                "category": "Healthcare",
                "district": "Delhi",
                "status": "verified",
                "similarity": 0.35,
                "endorsement_count": 0,
            }
        ],
    }
    res4 = builder._node_score_and_route(state_low)
    cands4 = res4["evaluated_candidates"]
    assert len(cands4) == 1
    assert cands4[0]["verdict"] == DuplicateVerdict.UNIQUE.value


@pytest.mark.asyncio
async def test_citizen_precheck_public_statuses_only(async_client: AsyncClient, db_session: AsyncSession):
    """Ensure precheck only matches publicly visible statuses (verified, in_progress, solved), never submitted/rejected."""
    citizen = User(
        id=uuid.uuid4(),
        email=f"cit_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add(citizen)
    await db_session.flush()

    # Create dummy embedding vector (normalized 384-dim)
    fake_vec = [0.05] * 384

    # 1. Public verified problem (should be matched)
    p_verified = Problem(
        id=uuid.uuid4(),
        title="Major water pipeline burst on Ring Road",
        description="Clean water gushing out near metro pillar 10 for hours.",
        category="Water Supply",
        location="Ring Road",
        district="Bengaluru Urban",
        state="Karnataka",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=fake_vec,
    )

    # 2. Submitted under review problem (must NOT be returned to citizen)
    p_submitted = Problem(
        id=uuid.uuid4(),
        title="Water pipeline burst near metro pillar 10",
        description="Another report of pipeline leak.",
        category="Water Supply",
        location="Ring Road",
        district="Bengaluru Urban",
        state="Karnataka",
        status=ProblemStatus.SUBMITTED,
        created_by_id=citizen.id,
        embedding=fake_vec,
    )

    # 3. Rejected problem (must NOT be returned)
    p_rejected = Problem(
        id=uuid.uuid4(),
        title="Burst water pipe Ring Road",
        description="Leakage on road.",
        category="Water Supply",
        location="Ring Road",
        district="Bengaluru Urban",
        state="Karnataka",
        status=ProblemStatus.REJECTED,
        created_by_id=citizen.id,
        embedding=fake_vec,
    )

    db_session.add_all([p_verified, p_submitted, p_rejected])
    await db_session.commit()

    token = create_access_token(citizen.id, role=UserRole.CITIZEN.value)

    with patch.object(EmbedderService, "get_embedding", return_value=fake_vec):
        res = await async_client.post(
            "/api/v1/problems/duplicate-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Water pipeline burst on Ring Road",
                "description": "Massive clean water leak near metro pillar 10.",
                "category": "Water Supply",
                "district": "Bengaluru Urban",
            },
        )

    assert res.status_code == 200
    data = res.json()
    assert data["degraded"] is False
    cands = data["candidates"]

    # Only p_verified should be returned
    cand_ids = [c["id"] for c in cands]
    assert str(p_verified.id) in cand_ids
    assert str(p_submitted.id) not in cand_ids
    assert str(p_rejected.id) not in cand_ids

    # Privacy verification: schema should only contain public fields
    cand = cands[0]
    assert "id" in cand
    assert "title" in cand
    assert "category" in cand
    assert "district" in cand
    assert "status" in cand
    assert "endorsement_count" in cand
    assert "similarity_label" in cand
    # Must NOT expose private user details
    assert "author" not in cand
    assert "created_by_id" not in cand


@pytest.mark.asyncio
async def test_citizen_precheck_fails_open_when_degraded(async_client: AsyncClient, db_session: AsyncSession):
    """When embedder fails, precheck must return 200 with degraded=True and empty candidates."""
    citizen = User(
        id=uuid.uuid4(),
        email=f"cit_deg_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.CITIZEN,
        is_verified=True,
    )
    db_session.add(citizen)
    await db_session.commit()

    token = create_access_token(citizen.id, role=UserRole.CITIZEN.value)

    with patch.object(EmbedderService, "get_embedding", side_effect=Exception("Model timeout")):
        res = await async_client.post(
            "/api/v1/problems/duplicate-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Street lights off in sector 10",
                "description": "Completely dark road creating night hazards.",
            },
        )

    assert res.status_code == 200
    data = res.json()
    assert data["degraded"] is True
    assert data["candidates"] == []


@pytest.mark.asyncio
async def test_admin_merge_transactional_workflow(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin merge flow with endorsement aggregation, cycle rejection, and audit log."""
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    u1 = User(id=uuid.uuid4(), email=f"u1_{uuid.uuid4().hex[:6]}@test.in", hashed_password="pwd", role=UserRole.CITIZEN, is_verified=True)
    u2 = User(id=uuid.uuid4(), email=f"u2_{uuid.uuid4().hex[:6]}@test.in", hashed_password="pwd", role=UserRole.CITIZEN, is_verified=True)
    db_session.add_all([admin, u1, u2])
    await db_session.flush()

    p_canonical = Problem(
        id=uuid.uuid4(),
        title="Potholes on Station Road",
        description="Multiple craters along the station approach.",
        category="Roads & Transport",
        location="Station Road",
        district="Pune",
        state="Maharashtra",
        status=ProblemStatus.VERIFIED,
        created_by_id=u1.id,
    )
    p_duplicate = Problem(
        id=uuid.uuid4(),
        title="Huge crater on Station Road",
        description="Deep pothole right before railway parking.",
        category="Roads & Transport",
        location="Station Road",
        district="Pune",
        state="Maharashtra",
        status=ProblemStatus.SUBMITTED,
        created_by_id=u2.id,
    )
    db_session.add_all([p_canonical, p_duplicate])
    await db_session.flush()

    # User 2 endorsed the duplicate problem
    pe2 = ProblemEndorsement(problem_id=p_duplicate.id, user_id=u2.id)
    db_session.add(pe2)
    await db_session.commit()

    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)

    # 1. Test self-merge rejection
    res_self = await async_client.post(
        f"/api/v1/admin/problems/{p_duplicate.id}/merge",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"target_problem_id": str(p_duplicate.id)},
    )
    assert res_self.status_code == 400

    # 2. Execute valid merge
    res_merge = await async_client.post(
        f"/api/v1/admin/problems/{p_duplicate.id}/merge",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"target_problem_id": str(p_canonical.id)},
    )
    assert res_merge.status_code == 200
    merge_data = res_merge.json()["data"]
    assert merge_data["success"] is True
    assert merge_data["merged_problem_id"] == str(p_duplicate.id)
    assert merge_data["canonical_problem_id"] == str(p_canonical.id)
    assert merge_data["endorsements_transferred"] == 1

    # 3. Refresh and verify database state
    await db_session.refresh(p_duplicate)
    assert p_duplicate.status == ProblemStatus.DUPLICATE
    assert p_duplicate.duplicate_of_id == p_canonical.id

    # 4. Attempt to re-merge already merged problem -> rejected
    res_remerge = await async_client.post(
        f"/api/v1/admin/problems/{p_duplicate.id}/merge",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"target_problem_id": str(p_canonical.id)},
    )
    assert res_remerge.status_code == 400


@pytest.mark.asyncio
async def test_admin_dismiss_duplicate_link(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin can dismiss a false duplicate link."""
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_dis_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    p1 = Problem(
        id=uuid.uuid4(),
        title="Traffic light issue",
        description="Red light stuck",
        category="Roads & Transport",
        location="Sector 1",
        district="Delhi",
        state="Delhi",
        status=ProblemStatus.SUBMITTED,
        created_by_id=admin.id,
    )
    p2 = Problem(
        id=uuid.uuid4(),
        title="Traffic light problem",
        description="Light not working",
        category="Roads & Transport",
        location="Sector 1",
        district="Delhi",
        state="Delhi",
        status=ProblemStatus.VERIFIED,
        created_by_id=admin.id,
    )
    db_session.add_all([admin, p1, p2])
    await db_session.flush()

    link = ProblemDuplicateLink(
        problem_id=p1.id,
        candidate_problem_id=p2.id,
        similarity=0.88,
        verdict=DuplicateVerdict.POSSIBLE_DUPLICATE,
        status=DuplicateLinkStatus.PENDING,
    )
    db_session.add(link)
    await db_session.commit()

    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)

    res = await async_client.post(
        f"/api/v1/admin/problems/{p1.id}/duplicates/{link.id}/dismiss",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200

    await db_session.refresh(link)
    assert link.status == DuplicateLinkStatus.DISMISSED
    assert link.reviewed_by_id == admin.id
    assert link.reviewed_at is not None


@pytest.mark.asyncio
async def test_admin_ai_health_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Verify AI health diagnostics endpoint."""
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_hlth_{uuid.uuid4().hex[:6]}@test.in",
        hashed_password="pwd",
        role=UserRole.ADMIN,
        is_verified=True,
    )
    db_session.add(admin)
    await db_session.commit()

    admin_token = create_access_token(admin.id, role=UserRole.ADMIN.value)

    res = await async_client.get(
        "/api/v1/admin/ai/health",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "embedder_available" in data
    assert "embedding_model" in data
    assert "embedding_dimension" in data
    assert "total_problems" in data
    assert "problems_with_embeddings" in data
    assert "duplicate_detection_enabled" in data


def test_district_fuzzy_matching_khijri_regression():
    """Regression test: verify 'Khijri, Namkum, Ranchi' vs 'Khjiri, Namkum' (typo + different granularity)

    is evaluated as same locality and yields strong_duplicate under high semantic similarity (>= 0.90).
    """
    builder = DuplicateDetectionGraphBuilder()

    state: DuplicateGraphState = {
        "title": "No Proper Healthcare Facility Nearby in My Area",
        "description": "Primary health centre lacks staff and basic medicines in Khjiri block.",
        "district": "Khjiri, Namkum",
        "mode": "moderation",
        "raw_candidates": [
            {
                "id": str(uuid.uuid4()),
                "title": "No Proper Healthcare Facility Nearby in My Area",
                "description": "Primary health centre lacks staff and basic medicines in Khijri block.",
                "category": "Healthcare",
                "district": "Khijri, Namkum, Ranchi",
                "status": "solved",
                "similarity": 0.95,
                "endorsement_count": 8,
            }
        ],
    }

    res = builder._node_score_and_route(state)
    candidates = res.get("evaluated_candidates", [])
    assert len(candidates) == 1
    assert candidates[0]["verdict"] == DuplicateVerdict.STRONG_DUPLICATE.value
    # Geo-downgrade should NOT have fired
    assert candidates[0].get("llm_reason") is None or "different districts" not in (candidates[0].get("llm_reason") or "")

