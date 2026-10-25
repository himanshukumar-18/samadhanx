"""Service orchestrating Citizen Smart Problem Assistant sessions, LangGraph execution,
and integration with Duplicate Problem Detection.
"""

from datetime import UTC, datetime, timedelta
import logging
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.graphs.problem_assistant import (
    AssistantGraphState,
    ProblemAssistantGraphBuilder,
)
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.problem_assistant import (
    AssistantProblemState,
    AssistantTurnResponse,
    GeneratedProblemDraft,
)
from app.ai_engine.services.duplicate_service import DuplicateDetectionService
from app.core.config import settings
from app.models.ai_session import AIAssistantSession
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.duplicate import DuplicateCandidatePublic

logger = logging.getLogger("samadhanx.ai.problem_assistant_service")


class ProblemAssistantService:
    """Production service managing citizen AI assistant sessions and workflows."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = get_model_provider()
        self.graph_builder = ProblemAssistantGraphBuilder(self.provider)

    async def _get_owned_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> AIAssistantSession:
        """Fetch session ensuring strict ownership and expiry checks."""
        stmt = select(AIAssistantSession).where(
            AIAssistantSession.id == session_id,
            AIAssistantSession.user_id == user_id,
        )
        res = await self.db.execute(stmt)
        session = res.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Assistant session not found or access denied."},
            )

        # Check expiration
        now = datetime.now(UTC)
        exp = session.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)

        if exp < now:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"code": "SESSION_EXPIRED", "message": "Assistant session has expired. Please start a new session."},
            )

        return session

    async def create_session(
        self,
        user: User,
        initial_message: str | None = None,
        district_hint: str | None = None,
    ) -> AssistantTurnResponse:
        """Initialize a new Smart Problem Assistant session."""
        if not getattr(settings, "AI_ASSISTANT_ENABLED", True):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "AI_SERVICE_UNAVAILABLE",
                    "message": "Smart Assistant is temporarily unavailable. You can continue using the standard problem submission form.",
                },
            )

        expires_at = datetime.now(UTC) + timedelta(minutes=45)
        initial_draft_meta = {
            "state": {},
            "district_hint": district_hint,
            "similar_problems": [],
        }

        session = AIAssistantSession(
            id=uuid.uuid4(),
            user_id=user.id,
            expires_at=expires_at,
            turn_count=0,
            messages=[],
            draft=initial_draft_meta,
        )
        self.db.add(session)
        await self.db.flush()

        # If citizen provided an initial description right away, execute turn 1
        if initial_message and initial_message.strip():
            return await self.send_message(
                session_id=session.id,
                user=user,
                message=initial_message.strip(),
            )

        # Default opening greeting
        greeting = (
            "Hello! I am your SamadhanX Smart Problem Assistant. "
            "Please describe the problem you are facing in your community in your own words."
        )
        session.messages = [{"role": "assistant", "content": greeting}]
        await self.db.commit()

        return AssistantTurnResponse(
            session_id=str(session.id),
            message=greeting,
            type="question",
            field="description",
            suggested_answers=[
                "Broken road with potholes",
                "Dirty drinking water supply",
                "Uncollected garbage dump",
                "Damaged streetlights not working",
            ],
            state=AssistantProblemState(),
            progress=15,
            complete=False,
            turn_count=0,
            max_turns=4,
            problem=None,
            similar_problems=[],
        )

    async def send_message(
        self,
        session_id: uuid.UUID,
        user: User,
        message: str,
    ) -> AssistantTurnResponse:
        """Process incoming citizen message through LangGraph and update session state."""
        session = await self._get_owned_session(session_id, user.id)

        draft_meta = dict(session.draft or {})
        current_state_dict = dict(draft_meta.get("state") or {})
        district_hint = draft_meta.get("district_hint")
        turn_count = session.turn_count + 1

        # Append citizen message
        updated_messages = list(session.messages or [])
        updated_messages.append({"role": "user", "content": message})

        # Assemble graph execution state
        graph_input: AssistantGraphState = {
            "session_id": str(session.id),
            "user_id": str(user.id),
            "latest_message": message,
            "history": updated_messages,
            "current_state": current_state_dict,
            "turn_count": turn_count,
            "max_turns": 4,
            "district_hint": district_hint,
        }

        try:
            graph_output = await self.graph_builder.execute_turn(graph_input)
        except Exception as exc:
            logger.error(f"Error executing Smart Assistant LangGraph: {exc}")
            # Non-blocking degradation
            return AssistantTurnResponse(
                session_id=str(session.id),
                message="I encountered an issue processing your response. Please try again or switch to standard submission.",
                type="clarification",
                field=None,
                suggested_answers=[],
                state=AssistantProblemState.model_validate(current_state_dict),
                progress=draft_meta.get("progress", 20),
                complete=False,
                turn_count=turn_count,
                max_turns=4,
                problem=None,
                similar_problems=[],
            )

        reply_message = graph_output.get("final_message") or graph_output.get("next_question") or "Could you clarify?"
        is_complete = bool(graph_output.get("complete", False))
        final_state = graph_output.get("current_state", {})
        problem_draft = graph_output.get("problem_draft")
        progress = graph_output.get("progress", 100 if is_complete else 50)

        # Append assistant reply
        updated_messages.append({"role": "assistant", "content": reply_message})

        # Duplicate detection integration: When problem is drafted, check existing problems
        similar_candidates: list[DuplicateCandidatePublic] = []
        if is_complete and problem_draft:
            try:
                async with self.db.begin_nested():
                    dup_service = DuplicateDetectionService(self.db)
                    dup_res = await dup_service.precheck(
                        title=problem_draft.get("title", ""),
                        description=problem_draft.get("description", ""),
                        category=problem_draft.get("category"),
                        district=problem_draft.get("district"),
                    )
                    similar_candidates = dup_res.candidates or []
            except Exception as dup_err:
                logger.warning(f"Duplicate precheck integration failed silently: {dup_err}")

        # Persist session
        session.turn_count = turn_count
        session.messages = updated_messages
        draft_meta["state"] = final_state
        draft_meta["problem"] = problem_draft
        draft_meta["progress"] = progress
        draft_meta["similar_problems"] = [c.model_dump(mode="json") for c in similar_candidates]
        session.draft = draft_meta

        await self.db.commit()
        await self.db.refresh(session)

        parsed_draft = GeneratedProblemDraft.model_validate(problem_draft) if problem_draft else None

        return AssistantTurnResponse(
            session_id=str(session.id),
            message=reply_message,
            type="complete" if is_complete else "question",
            field=graph_output.get("next_field"),
            suggested_answers=graph_output.get("suggested_answers") or [],
            state=AssistantProblemState.model_validate(final_state),
            progress=progress,
            complete=is_complete,
            turn_count=turn_count,
            max_turns=4,
            problem=parsed_draft,
            similar_problems=similar_candidates,
        )

    async def finalize_session(
        self, session_id: uuid.UUID, user: User
    ) -> AssistantTurnResponse:
        """Force finalize problem draft immediately based on whatever facts have been collected."""
        session = await self._get_owned_session(session_id, user.id)
        draft_meta = dict(session.draft or {})
        current_state_dict = dict(draft_meta.get("state") or {})

        graph_input: AssistantGraphState = {
            "session_id": str(session.id),
            "user_id": str(user.id),
            "latest_message": "Finalize draft now",
            "history": session.messages or [],
            "current_state": current_state_dict,
            "turn_count": session.turn_count,
            "max_turns": 4,
            "is_ready_for_draft": True,
        }

        # Run draft generation
        draft_res = await self.graph_builder._node_generate_draft(graph_input)
        final_draft = draft_res.get("problem_draft")

        # Run duplicate detection
        similar_candidates: list[DuplicateCandidatePublic] = []
        if final_draft:
            try:
                async with self.db.begin_nested():
                    dup_service = DuplicateDetectionService(self.db)
                    dup_res = await dup_service.precheck(
                        title=final_draft.get("title", ""),
                        description=final_draft.get("description", ""),
                        category=final_draft.get("category"),
                        district=final_draft.get("district"),
                    )
                    similar_candidates = dup_res.candidates or []
            except Exception as dup_err:
                logger.warning(f"Duplicate detection failed in finalize: {dup_err}")

        # Update session
        draft_meta["problem"] = final_draft
        draft_meta["progress"] = 100
        draft_meta["similar_problems"] = [c.model_dump(mode="json") for c in similar_candidates]
        session.draft = draft_meta

        final_msg = "I have prepared your problem report based on our discussion. Please review the details below before submitting."
        session.messages = [*(session.messages or []), {"role": "assistant", "content": final_msg}]

        await self.db.commit()

        parsed_draft = GeneratedProblemDraft.model_validate(final_draft) if final_draft else None

        return AssistantTurnResponse(
            session_id=str(session.id),
            message=final_msg,
            type="complete",
            field=None,
            suggested_answers=[],
            state=AssistantProblemState.model_validate(current_state_dict),
            progress=100,
            complete=True,
            turn_count=session.turn_count,
            max_turns=4,
            problem=parsed_draft,
            similar_problems=similar_candidates,
        )

    async def get_session(
        self, session_id: uuid.UUID, user: User
    ) -> AssistantTurnResponse:
        """Fetch current session state."""
        session = await self._get_owned_session(session_id, user.id)
        draft_meta = dict(session.draft or {})
        current_state_dict = dict(draft_meta.get("state") or {})
        problem_draft = draft_meta.get("problem")
        similar = draft_meta.get("similar_problems") or []

        last_assistant_msg = next(
            (m["content"] for m in reversed(session.messages or []) if m.get("role") == "assistant"),
            "How can I help you report your civic problem?",
        )

        parsed_similar = [
            DuplicateCandidatePublic.model_validate(s) for s in similar
        ]
        parsed_draft = GeneratedProblemDraft.model_validate(problem_draft) if problem_draft else None

        return AssistantTurnResponse(
            session_id=str(session.id),
            message=last_assistant_msg,
            type="complete" if parsed_draft else "question",
            field=None,
            suggested_answers=[],
            state=AssistantProblemState.model_validate(current_state_dict),
            progress=draft_meta.get("progress", 100 if parsed_draft else 25),
            complete=bool(parsed_draft),
            turn_count=session.turn_count,
            max_turns=4,
            problem=parsed_draft,
            similar_problems=parsed_similar,
        )

    async def delete_session(self, session_id: uuid.UUID, user: User) -> bool:
        """Delete session and log audit."""
        session = await self._get_owned_session(session_id, user.id)
        self.db.add(
            AuditLog(
                actor_id=user.id,
                action="AI_ASSISTANT_SESSION_DELETED",
                target_type="ai_assistant_session",
                target_id=str(session.id),
                metadata_json={},
            )
        )
        await self.db.delete(session)
        await self.db.commit()
        return True

