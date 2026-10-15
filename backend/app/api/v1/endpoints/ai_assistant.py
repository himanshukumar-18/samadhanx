"""Dedicated API endpoints for Smart Problem Assistant under /ai/problem-assistant."""

from typing import Annotated
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.schemas.problem_assistant import (
    AssistantTurnResponse,
    SendAssistantMessageRequest,
    StartAssistantRequest,
)
from app.ai_engine.services.problem_assistant_service import ProblemAssistantService
from app.core.deps import get_db, require_role
from app.core.rate_limit import rate_limiter
from app.models.enums import UserRole
from app.models.user import User

router = APIRouter(prefix="/ai/problem-assistant", tags=["Smart Problem Assistant"])


@router.post("/start", response_model=dict)
async def start_problem_assistant(
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: StartAssistantRequest = StartAssistantRequest(),
    _rl: None = Depends(rate_limiter(requests_per_minute=20, key_prefix="assistant_start")),
):
    """Start an AI-assisted civic problem reporting session."""
    service = ProblemAssistantService(db)
    res = await service.create_session(
        user=current_user,
        initial_message=body.initial_message,
        district_hint=body.district_hint,
    )
    return {"success": True, "data": res.model_dump(mode="json")}


@router.post("/message", response_model=dict)
async def send_problem_assistant_message(
    body: dict,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: None = Depends(rate_limiter(requests_per_minute=30, key_prefix="assistant_msg_alt")),
):
    """Send citizen message to the Smart Problem Assistant LangGraph pipeline."""
    session_id_str = body.get("session_id")
    message = body.get("message", "")
    session_id = uuid.UUID(str(session_id_str))
    service = ProblemAssistantService(db)
    res = await service.send_message(
        session_id=session_id,
        user=current_user,
        message=message,
    )
    return {"success": True, "data": res.model_dump(mode="json")}


@router.post("/finalize", response_model=dict)
async def finalize_problem_assistant(
    body: dict,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Force finalize draft and return duplicate warnings."""
    session_id = uuid.UUID(str(body.get("session_id")))
    service = ProblemAssistantService(db)
    res = await service.finalize_session(session_id=session_id, user=current_user)
    return {"success": True, "data": res.model_dump(mode="json")}


@router.get("/{session_id}", response_model=dict)
async def get_problem_assistant_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch current state of the Smart Problem Assistant session."""
    service = ProblemAssistantService(db)
    res = await service.get_session(session_id=session_id, user=current_user)
    return {"success": True, "data": res.model_dump(mode="json")}

