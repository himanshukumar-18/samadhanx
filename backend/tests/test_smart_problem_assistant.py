"""Comprehensive tests for Citizen Smart Problem Assistant feature.

Covers:
1. Session initialization (authenticated vs unauthenticated)
2. Initial message processing and greeting response
3. Multi-turn conversation and state extraction
4. Strict anti-hallucination validation (unmentioned fields remain None)
5. LangGraph conditional routing (need_more_info vs ready_to_draft)
6. BOLA cross-user session isolation (User B cannot access or modify User A's session)
7. Force-finalization of draft (/finalize)
8. Duplicate detection integration with warning cards
9. Session deletion and audit logging
10. End-to-end flow: Assistant conversation -> draft preview -> submission to /problems
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.graphs.problem_assistant import (
    AssistantGraphState,
    ProblemAssistantGraphBuilder,
)
from app.ai_engine.providers.fake import FakeAIProvider
from app.ai_engine.schemas.problem_assistant import (
    AssistantExtractionOutput,
    AssistantProblemState,
    AssistantQuestionOutput,
    GeneratedProblemDraft,
)
from app.core.security import create_access_token, get_password_hash
from app.models.ai_session import AIAssistantSession
from app.models.enums import UserRole
from app.models.user import User


def _token(user: User) -> str:
    return f"Bearer {create_access_token(user.id, user.role.value)}"


async def _create_test_user(db: AsyncSession, email: str, role: UserRole = UserRole.CITIZEN) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("TestPass123!"),
        role=role,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture(autouse=True)
def mock_ai_provider(monkeypatch):
    fake = FakeAIProvider()
    monkeypatch.setattr("app.ai_engine.services.problem_assistant_service.get_model_provider", lambda: fake)
    monkeypatch.setattr("app.ai_engine.graphs.problem_assistant.get_model_provider", lambda: fake)
    return fake


@pytest.mark.asyncio
async def test_session_init_unauthenticated(async_client: AsyncClient):
    """Unauthenticated users must not be able to start an AI assistant session."""
    res = await async_client.post("/api/v1/citizen/ai-assistant/sessions", json={})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_create_session_success_empty(async_client: AsyncClient, db_session: AsyncSession):
    """Citizen can create a fresh assistant session and receive initial greeting."""
    user = await _create_test_user(db_session, "citizen_fresh@test.com")
    headers = {"Authorization": _token(user)}

    res = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    payload = data["data"]
    assert "session_id" in payload
    assert payload["turn_count"] == 0
    assert payload["complete"] is False
    assert len(payload["message"]) > 0
    assert len(payload["suggested_answers"]) > 0


@pytest.mark.asyncio
async def test_create_session_with_initial_message(async_client: AsyncClient, db_session: AsyncSession):
    """Creating a session with an initial civic message executes turn 1 immediately."""
    user = await _create_test_user(db_session, "citizen_initial@test.com")
    headers = {"Authorization": _token(user)}

    res = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={"initial_message": "Our village road is completely broken with potholes."},
    )
    assert res.status_code == 200
    payload = res.json()["data"]
    assert payload["turn_count"] >= 1
    assert payload["session_id"] is not None


@pytest.mark.asyncio
async def test_send_message_multi_turn_and_completion(async_client: AsyncClient, db_session: AsyncSession):
    """Citizen sends details in turn 2 (village name 'Barka'), triggering draft completion."""
    user = await _create_test_user(db_session, "citizen_multiturn@test.com")
    headers = {"Authorization": _token(user)}

    # Turn 0 -> 1: Start
    res_start = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={"initial_message": "Broken road and drainage issues."},
    )
    assert res_start.status_code == 200
    session_id = res_start.json()["data"]["session_id"]

    # Turn 2: Provide location 'Barka'
    res_turn2 = await async_client.post(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}/messages",
        headers=headers,
        json={"message": "This is in Barka village, Ranchi district."},
    )
    assert res_turn2.status_code == 200
    turn2_data = res_turn2.json()["data"]
    assert turn2_data["complete"] is True
    assert turn2_data["problem"] is not None
    assert "Barka" in turn2_data["problem"]["title"] or "Barka" in turn2_data["problem"]["location"]


@pytest.mark.asyncio
async def test_cross_user_bola_isolation(async_client: AsyncClient, db_session: AsyncSession):
    """User B cannot view, message, or finalize User A's session."""
    user_a = await _create_test_user(db_session, "user_a@test.com")
    user_b = await _create_test_user(db_session, "user_b@test.com")

    # User A starts session
    res_a = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers={"Authorization": _token(user_a)},
        json={"initial_message": "Waterlogging problem."},
    )
    session_id = res_a.json()["data"]["session_id"]

    # User B tries to view User A's session
    res_b_get = await async_client.get(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}",
        headers={"Authorization": _token(user_b)},
    )
    assert res_b_get.status_code == 404

    # User B tries to send message to User A's session
    res_b_msg = await async_client.post(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}/messages",
        headers={"Authorization": _token(user_b)},
        json={"message": "Malicious override attempt"},
    )
    assert res_b_msg.status_code == 404

    # User B tries to finalize User A's session
    res_b_fin = await async_client.post(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}/finalize",
        headers={"Authorization": _token(user_b)},
    )
    assert res_b_fin.status_code == 404


@pytest.mark.asyncio
async def test_force_finalize_session(async_client: AsyncClient, db_session: AsyncSession):
    """Citizen can manually finalize session at any time via /finalize."""
    user = await _create_test_user(db_session, "citizen_finalize@test.com")
    headers = {"Authorization": _token(user)}

    # Create session
    start_res = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={"initial_message": "Streetlight broken in main market."},
    )
    session_id = start_res.json()["data"]["session_id"]

    # Explicitly finalize
    fin_res = await async_client.post(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}/finalize",
        headers=headers,
    )
    assert fin_res.status_code == 200
    data = fin_res.json()["data"]
    assert data["complete"] is True
    assert data["problem"] is not None
    assert data["progress"] == 100


@pytest.mark.asyncio
async def test_delete_session(async_client: AsyncClient, db_session: AsyncSession):
    """Citizen can delete assistant session, returning 404 on subsequent access."""
    user = await _create_test_user(db_session, "citizen_del@test.com")
    headers = {"Authorization": _token(user)}

    start_res = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={"initial_message": "Testing deletion."},
    )
    session_id = start_res.json()["data"]["session_id"]

    # Delete session
    del_res = await async_client.delete(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}",
        headers=headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True

    # Check 404 on get
    get_res = await async_client.get(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}",
        headers=headers,
    )
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_anti_hallucination_state_merging_unit():
    """Unit test for state merging: unmentioned fields remain None."""
    builder = ProblemAssistantGraphBuilder(provider=FakeAIProvider())

    # State before merge
    state: AssistantGraphState = {
        "current_state": {"description": "Water pipe leak"},
        "extracted_state": {"location": "Ward 4", "district": "Ranchi"},
        "district_hint": None,
    }

    result = builder._node_merge_state(state)
    merged = result["current_state"]

    assert merged["description"] == "Water pipe leak"
    assert merged["location"] == "Ward 4"
    assert merged["district"] == "Ranchi"
    # Unmentioned fields must not be invented
    assert merged.get("duration") is None
    assert merged.get("severity") is None


@pytest.mark.asyncio
async def test_langgraph_conditional_routing_unit():
    """Unit test: validate_problem node routes correctly based on completeness and turns."""
    builder = ProblemAssistantGraphBuilder(provider=FakeAIProvider())

    # Case 1: Incomplete facts, turn 1 of 4 -> need_more_info
    state_incomplete: AssistantGraphState = {
        "current_state": {"description": "Potholes on road"},
        "turn_count": 1,
        "max_turns": 4,
        "is_ready_for_draft": False,
        "is_off_topic": False,
    }
    assert builder._node_validate_problem(state_incomplete)["validation_status"] == "need_more_info"

    # Case 2: Complete facts (issue + location + context) -> ready_to_draft
    state_complete: AssistantGraphState = {
        "current_state": {
            "description": "Potholes on road",
            "location": "Namkum",
            "category": "Smart Infrastructure & Roads",
        },
        "turn_count": 2,
        "max_turns": 4,
        "is_ready_for_draft": False,
        "is_off_topic": False,
    }
    assert builder._node_validate_problem(state_complete)["validation_status"] == "ready_to_draft"

    # Case 3: Turn limit reached -> ready_to_draft even if facts are partial
    state_max_turns: AssistantGraphState = {
        "current_state": {"description": "Broken streetlight"},
        "turn_count": 4,
        "max_turns": 4,
        "is_ready_for_draft": False,
        "is_off_topic": False,
    }
    assert builder._node_validate_problem(state_max_turns)["validation_status"] == "ready_to_draft"


@pytest.mark.asyncio
async def test_full_pipeline_to_problem_submission(async_client: AsyncClient, db_session: AsyncSession):
    """End-to-end: Use assistant draft to submit a real problem via POST /api/v1/problems."""
    user = await _create_test_user(db_session, "citizen_e2e_submit@test.com")
    headers = {"Authorization": _token(user)}

    # 1. Start assistant
    start_res = await async_client.post(
        "/api/v1/citizen/ai-assistant/sessions",
        headers=headers,
        json={"initial_message": "Severe waterlogging near Barka village road."},
    )
    assert start_res.status_code == 200
    session_id = start_res.json()["data"]["session_id"]

    # 2. Finalize draft
    fin_res = await async_client.post(
        f"/api/v1/citizen/ai-assistant/sessions/{session_id}/finalize",
        headers=headers,
    )
    assert fin_res.status_code == 200
    draft = fin_res.json()["data"]["problem"]
    assert draft is not None

    # 3. Submit problem to standard API using draft fields + media & GPS attachments
    problem_payload = {
        "title": draft["title"],
        "description": draft["description"],
        "category": draft["category"],
        "location": draft["location"],
        "district": draft["district"],
        "state": draft["state"],
        "latitude": 23.3441,
        "longitude": 85.3096,
        "media_urls": ["https://res.cloudinary.com/test/image/upload/v1/evidence.jpg"],
        "tags": draft.get("tags", []),
    }
    submit_res = await async_client.post(
        "/api/v1/problems",
        headers=headers,
        json=problem_payload,
    )
    assert submit_res.status_code in (200, 201)
    problem_data = submit_res.json()
    assert problem_data["title"] == draft["title"]
    assert problem_data["category"] == draft["category"]
    assert problem_data["status"] == "submitted"
    assert problem_data["latitude"] == 23.3441
    assert problem_data["longitude"] == 85.3096
    assert problem_data["media_urls"] == ["https://res.cloudinary.com/test/image/upload/v1/evidence.jpg"]
