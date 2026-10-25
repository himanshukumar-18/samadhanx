"""Service managing duplicate problem detection, vector search, and admin merge workflows.

Provides:
- Citizen duplicate pre-check with sub-second response, bounded timeouts, and graceful fallbacks
- Admin duplicate moderation with vector search, LLM verification, and link persistence
- Transactional problem merge with cycle detection, endorsement transfer, and audit logging
- Link dismissal with audit trail
- AI embedding and pgvector diagnostics
"""

import asyncio
import logging
import math
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_engine.graphs.duplicate_detection import (
    DuplicateDetectionGraphBuilder,
    DuplicateGraphState,
)
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.services.embedder import EmbedderService
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.enums import DuplicateLinkStatus, DuplicateVerdict, ProblemStatus
from app.models.problem import Problem, ProblemEndorsement
from app.models.problem_duplicate_link import ProblemDuplicateLink
from app.models.user import User
from app.schemas.duplicate import (
    AIHealthResponse,
    DuplicateCandidatePublic,
    DuplicateCheckResponse,
    DuplicateLinkResponse,
    MergeResponse,
)

logger = logging.getLogger("samadhanx.ai.duplicate_service")


def _cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two float vectors in pure Python."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2, strict=False))

    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


class DuplicateDetectionService:
    """Unified service for citizen pre-check and admin duplicate workflows."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = get_model_provider()
        self.graph_builder = DuplicateDetectionGraphBuilder(self.provider)
        try:
            self.compiled_graph = self.graph_builder.build()
        except Exception:
            self.compiled_graph = None

    async def _vector_search(
        self,
        query_vector: list[float],
        low_threshold: float,
        limit: int = 5,
        allowed_statuses: list[ProblemStatus] | None = None,
        exclude_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Search similar problems using pgvector <=> cosine operator or SQLite fallback."""
        dialect_name = self.db.bind.dialect.name if self.db.bind else "postgresql"

        if dialect_name == "postgresql":
            try:
                async with self.db.begin_nested():
                    vec_str = "[" + ",".join(str(f) for f in query_vector) + "]"
                    # DB stores statuses as UPPERCASE strings; StrEnum values are lowercase.
                    status_filter = [s.value.upper() for s in allowed_statuses] if allowed_statuses else []

                    where_clauses = ["p.embedding IS NOT NULL"]
                    params: dict[str, Any] = {
                        "vec_str": vec_str,
                        "low_threshold": low_threshold,
                        "limit": limit,
                    }

                    if exclude_id:
                        where_clauses.append("p.id != CAST(:exclude_id AS uuid)")
                        params["exclude_id"] = str(exclude_id)

                    if status_filter:
                        where_clauses.append("UPPER(p.status::text) = ANY(:status_filter)")
                        params["status_filter"] = status_filter

                    where_sql = " AND ".join(where_clauses)

                    sql = f"""
                        SELECT p.id, p.title, p.description, p.category, p.location, p.district, p.status,
                               (1.0 - (p.embedding <=> CAST(:vec_str AS vector))) as similarity,
                               COUNT(pe.id) as endorsement_count
                        FROM problems p
                        LEFT JOIN problem_endorsements pe ON pe.problem_id = p.id
                        WHERE {where_sql}
                        GROUP BY p.id
                        HAVING (1.0 - (p.embedding <=> CAST(:vec_str AS vector))) >= :low_threshold
                        ORDER BY similarity DESC
                        LIMIT :limit;
                    """
                    result = await self.db.execute(text(sql), params)
                    rows = result.fetchall()
                    candidates = []
                    for row in rows:
                        candidates.append({
                            "id": row.id,
                            "title": row.title,
                            "description": row.description,
                            "category": row.category,
                            "location": row.location,
                            "district": row.district,
                            "status": row.status,
                            "similarity": float(row.similarity),
                            "endorsement_count": int(row.endorsement_count),
                        })
                    return candidates
            except Exception as exc:
                logger.warning(f"pgvector query failed, falling back to python calculation: {exc}")

        # Python / SQLite fallback:
        query = select(Problem).options(selectinload(Problem.endorsements)).where(Problem.embedding.isnot(None))
        if exclude_id:
            query = query.where(Problem.id != exclude_id)
        if allowed_statuses:
            query = query.where(Problem.status.in_(allowed_statuses))

        result = await self.db.execute(query)
        problems = result.scalars().all()

        scored = []
        for p in problems:
            if not p.embedding:
                continue
            sim = _cosine_similarity(query_vector, p.embedding)
            if sim >= low_threshold:
                scored.append({
                    "id": p.id,
                    "title": p.title,
                    "description": p.description,
                    "category": p.category,
                    "location": p.location,
                    "district": p.district,
                    "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                    "similarity": sim,
                    "endorsement_count": len(p.endorsements or []),
                })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:limit]

    async def precheck(
        self,
        title: str,
        description: str,
        category: str | None = None,
        district: str | None = None,
    ) -> DuplicateCheckResponse:
        """Citizen pre-check with 5s timeout, fail-open, and privacy-preserving candidate cards."""
        if not (getattr(settings, "DUPLICATE_DETECTION_ENABLED", True) and getattr(settings, "AI_DUPLICATES_ENABLED", True)):
            return DuplicateCheckResponse(candidates=[], degraded=True)

        timeout = int(getattr(settings, "DUPLICATE_PRECHECK_TIMEOUT_SECONDS", 5))

        async def _run() -> DuplicateCheckResponse:
            norm_text = EmbedderService.normalize_text(title, description)
            try:
                query_vec = EmbedderService.get_embedding(norm_text)
            except Exception as exc:
                logger.warning(f"Citizen precheck embedder failure: {exc}")
                return DuplicateCheckResponse(candidates=[], degraded=True)

            low_threshold = float(getattr(settings, "DUPLICATE_LOW_THRESHOLD", 0.75))
            high_threshold = float(getattr(settings, "DUPLICATE_HIGH_THRESHOLD", 0.90))

            # Citizen pre-check ONLY searches publicly visible statuses
            allowed_statuses = [
                ProblemStatus.VERIFIED,
                ProblemStatus.IN_PROGRESS,
                ProblemStatus.SOLUTION_SUBMITTED,
                ProblemStatus.PILOT,
                ProblemStatus.SOLVED,
            ]
            raw_candidates = await self._vector_search(
                query_vector=query_vec,
                low_threshold=low_threshold,
                limit=5,
                allowed_statuses=allowed_statuses,
            )

            state: DuplicateGraphState = {
                "title": title,
                "description": description,
                "category": category,
                "district": district,
                "mode": "precheck",
                "embedding": query_vec,
                "raw_candidates": raw_candidates,
            }

            score_res = self.graph_builder._node_score_and_route(state)
            state.update(score_res)
            build_res = self.graph_builder._node_build_result(state)
            evaluated = build_res.get("evaluated_candidates", [])

            # Map to privacy-preserving public schema
            public_candidates: list[DuplicateCandidatePublic] = []
            for item in evaluated[:3]:
                sim = float(item.get("similarity", 0.0))
                label = "very_similar" if sim >= high_threshold else "similar"
                public_candidates.append(
                    DuplicateCandidatePublic(
                        id=uuid.UUID(str(item["candidate_id"])),
                        title=item["title"],
                        category=item["category"],
                        district=item["district"],
                        status=item["status"],
                        endorsement_count=item.get("endorsement_count", 0),
                        similarity_label=label,
                    )
                )

            return DuplicateCheckResponse(candidates=public_candidates, degraded=False)

        try:
            return await asyncio.wait_for(_run(), timeout=timeout)
        except TimeoutError:
            logger.warning(f"Citizen precheck timed out after {timeout}s; returning degraded")
            return DuplicateCheckResponse(candidates=[], degraded=True)
        except Exception as exc:
            logger.error(f"Unexpected error in citizen precheck: {exc}")
            return DuplicateCheckResponse(candidates=[], degraded=True)

    async def run_moderation_detection(
        self,
        problem: Problem,
        save_links: bool = True,
    ) -> tuple[list[DuplicateLinkResponse], bool]:
        """Run full duplicate detection graph for a problem in moderation mode."""
        if not (getattr(settings, "DUPLICATE_DETECTION_ENABLED", True) and getattr(settings, "AI_DUPLICATES_ENABLED", True)):
            return [], True

        norm_text = EmbedderService.normalize_text(problem.title, problem.description)
        text_hash = EmbedderService.compute_hash(norm_text)

        # Reuse or calculate embedding
        embedding = problem.embedding
        if not embedding or problem.embedding_hash != text_hash:
            try:
                embedding = EmbedderService.get_embedding(norm_text)
                problem.embedding = embedding
                problem.embedding_model = getattr(settings, "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
                problem.embedding_hash = text_hash
                problem.embedding_updated_at = datetime.now(UTC)
                await self.db.flush()
            except Exception as exc:
                logger.error(f"Failed to generate embedding for problem {problem.id}: {exc}")
                return [], True

        low_threshold = float(getattr(settings, "DUPLICATE_LOW_THRESHOLD", 0.75))
        # Moderation checks against all active/verified/under-review problems, excluding duplicates and rejected
        excluded_statuses = [ProblemStatus.REJECTED, ProblemStatus.DUPLICATE]
        allowed = [s for s in ProblemStatus if s not in excluded_statuses]

        raw_candidates = await self._vector_search(
            query_vector=embedding,
            low_threshold=low_threshold,
            limit=5,
            allowed_statuses=allowed,
            exclude_id=problem.id,
        )

        state: DuplicateGraphState = {
            "problem_id": str(problem.id),
            "title": problem.title,
            "description": problem.description,
            "category": problem.category,
            "district": problem.district,
            "mode": "moderation",
            "embedding": embedding,
            "raw_candidates": raw_candidates,
        }

        # Execute scoring & routing
        state.update(self.graph_builder._node_score_and_route(state))
        # Execute LLM verify if needed
        state.update(await self.graph_builder._node_llm_verify(state))
        # Build result
        state.update(self.graph_builder._node_build_result(state))

        evaluated = state.get("evaluated_candidates", [])
        link_responses: list[DuplicateLinkResponse] = []

        for cand in evaluated:
            cand_id = uuid.UUID(str(cand["candidate_id"]))
            verdict_str = cand.get("verdict", DuplicateVerdict.POSSIBLE_DUPLICATE.value)
            sim = float(cand.get("similarity", 0.0))
            llm_used = bool(cand.get("llm_used", False))
            llm_reason = cand.get("llm_reason")

            if save_links and verdict_str in (DuplicateVerdict.STRONG_DUPLICATE.value, DuplicateVerdict.POSSIBLE_DUPLICATE.value):
                # Check existing link
                link_res = await self.db.execute(
                    select(ProblemDuplicateLink).where(
                        ProblemDuplicateLink.problem_id == problem.id,
                        ProblemDuplicateLink.candidate_problem_id == cand_id,
                    )
                )
                link = link_res.scalar_one_or_none()
                if link and link.status == DuplicateLinkStatus.DISMISSED:
                    # A human dismissal is durable; automated reruns must not resurrect it.
                    continue
                if not link:
                    link = ProblemDuplicateLink(
                        problem_id=problem.id,
                        candidate_problem_id=cand_id,
                        similarity=sim,
                        verdict=DuplicateVerdict(verdict_str),
                        llm_used=llm_used,
                        llm_reason=llm_reason,
                        status=DuplicateLinkStatus.PENDING,
                    )
                    self.db.add(link)
                elif link.status == DuplicateLinkStatus.PENDING:
                    link.similarity = sim
                    link.verdict = DuplicateVerdict(verdict_str)
                    link.llm_used = llm_used
                    link.llm_reason = llm_reason

                await self.db.flush()
                await self.db.refresh(link)
                link_id = link.id
                status_val = link.status
                created_at = link.created_at
                reviewed_by_id = link.reviewed_by_id
                reviewed_at = link.reviewed_at
            else:
                link_id = uuid.uuid4()
                status_val = DuplicateLinkStatus.PENDING
                created_at = datetime.now(UTC)
                reviewed_by_id = None
                reviewed_at = None

            link_responses.append(
                DuplicateLinkResponse(
                    id=link_id,
                    problem_id=problem.id,
                    candidate_problem_id=cand_id,
                    candidate_title=cand["title"],
                    candidate_district=cand["district"],
                    candidate_status=cand["status"],
                    candidate_category=cand["category"],
                    similarity=sim,
                    verdict=DuplicateVerdict(verdict_str) if verdict_str in DuplicateVerdict._value2member_map_ else DuplicateVerdict.POSSIBLE_DUPLICATE,
                    llm_used=llm_used,
                    llm_reason=llm_reason,
                    status=status_val,
                    reviewed_by_id=reviewed_by_id,
                    reviewed_at=reviewed_at,
                    created_at=created_at,
                )
            )

        if save_links:
            await self.db.commit()

        return link_responses, False

    async def get_duplicates_for_problem(self, problem_id: uuid.UUID) -> list[DuplicateLinkResponse]:
        """Fetch all duplicate links recorded for a problem."""
        stmt = (
            select(ProblemDuplicateLink)
            .options(selectinload(ProblemDuplicateLink.candidate_problem))
            .where(ProblemDuplicateLink.problem_id == problem_id)
            .order_by(ProblemDuplicateLink.similarity.desc())
        )
        res = await self.db.execute(stmt)
        links = res.scalars().all()

        results: list[DuplicateLinkResponse] = []
        for link_item in links:
            cand = link_item.candidate_problem
            results.append(
                DuplicateLinkResponse(
                    id=link_item.id,
                    problem_id=link_item.problem_id,
                    candidate_problem_id=link_item.candidate_problem_id,
                    candidate_title=cand.title if cand else "",
                    candidate_district=cand.district if cand else "",
                    candidate_status=cand.status.value if cand and hasattr(cand.status, "value") else str(cand.status if cand else ""),
                    candidate_category=cand.category if cand else "",
                    similarity=link_item.similarity,
                    verdict=link_item.verdict,
                    llm_used=link_item.llm_used,
                    llm_reason=link_item.llm_reason,
                    status=link_item.status,
                    reviewed_by_id=link_item.reviewed_by_id,
                    reviewed_at=link_item.reviewed_at,
                    created_at=link_item.created_at,
                )
            )
        return results


    async def merge_problems(
        self,
        problem_id: uuid.UUID,
        target_problem_id: uuid.UUID,
        admin_user: User,
    ) -> MergeResponse:
        """Merge problem into target canonical problem transactionally."""
        if problem_id == target_problem_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_MERGE_TARGET", "message": "Cannot merge a problem into itself."},
            )

        # Load both problems
        problem = await self.db.get(Problem, problem_id)
        target = await self.db.get(Problem, target_problem_id)

        if not problem or not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROBLEM_NOT_FOUND", "message": "Problem or target not found."},
            )

        if problem.status == ProblemStatus.DUPLICATE or problem.duplicate_of_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PROBLEM_ALREADY_MERGED", "message": "Problem is already merged."},
            )

        # Cycle detection: Ensure target problem is not merged into problem or creating a loop
        curr: Problem | None = target
        visited = {problem_id, target_problem_id}
        while curr and curr.duplicate_of_id:
            if curr.duplicate_of_id == problem_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "MERGE_CYCLE_DETECTED", "message": "Merging would create a cyclical duplicate reference."},
                )
            if curr.duplicate_of_id in visited:
                break
            visited.add(curr.duplicate_of_id)
            curr = await self.db.get(Problem, curr.duplicate_of_id)

        # Set status and canonical link
        problem.duplicate_of_id = target.id
        problem.status = ProblemStatus.DUPLICATE

        # Confirm link if exists
        link_stmt = select(ProblemDuplicateLink).where(
            ProblemDuplicateLink.problem_id == problem_id,
            ProblemDuplicateLink.candidate_problem_id == target_problem_id,
        )
        link_res = await self.db.execute(link_stmt)
        link = link_res.scalar_one_or_none()
        now = datetime.now(UTC)
        if link:
            link.status = DuplicateLinkStatus.CONFIRMED
            link.reviewed_by_id = admin_user.id
            link.reviewed_at = now
        else:
            # Create confirmed link record
            link = ProblemDuplicateLink(
                problem_id=problem_id,
                candidate_problem_id=target_problem_id,
                similarity=1.0,
                verdict=DuplicateVerdict.STRONG_DUPLICATE,
                status=DuplicateLinkStatus.CONFIRMED,
                reviewed_by_id=admin_user.id,
                reviewed_at=now,
            )
            self.db.add(link)

        # Transfer endorsements safely avoiding unique constraint violations
        existing_target_endorsements = await self.db.execute(
            select(ProblemEndorsement.user_id).where(ProblemEndorsement.problem_id == target.id)
        )
        target_user_ids = set(existing_target_endorsements.scalars().all())

        problem_endorsements = await self.db.execute(
            select(ProblemEndorsement).where(ProblemEndorsement.problem_id == problem.id)
        )
        transferred_count = 0
        for pe in problem_endorsements.scalars().all():
            if pe.user_id not in target_user_ids:
                new_endorsement = ProblemEndorsement(
                    problem_id=target.id,
                    user_id=pe.user_id,
                )
                self.db.add(new_endorsement)
                target_user_ids.add(pe.user_id)
                transferred_count += 1

        # Audit log entry
        audit_entry = AuditLog(
            actor_id=admin_user.id,
            action="PROBLEM_MERGED",
            target_type="problem",
            target_id=str(problem.id),
            metadata_json={
                "canonical_problem_id": str(target.id),
                "transferred_endorsements": transferred_count,
                "reason": "Admin duplicate moderation confirmation",
            },
        )
        self.db.add(audit_entry)

        await self.db.commit()

        return MergeResponse(
            success=True,
            message="Problem successfully merged into canonical report.",
            canonical_problem_id=target.id,
            merged_problem_id=problem.id,
            endorsements_transferred=transferred_count,
        )

    async def dismiss_link(
        self,
        problem_id: uuid.UUID,
        link_id: uuid.UUID,
        admin_user: User,
    ) -> bool:
        """Mark a candidate duplicate link as dismissed (not a duplicate)."""
        link = await self.db.get(ProblemDuplicateLink, link_id)
        if not link or link.problem_id != problem_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DUPLICATE_LINK_NOT_FOUND", "message": "Duplicate link not found."},
            )

        link.status = DuplicateLinkStatus.DISMISSED
        link.reviewed_by_id = admin_user.id
        link.reviewed_at = datetime.now(UTC)

        audit_entry = AuditLog(
            actor_id=admin_user.id,
            action="DUPLICATE_LINK_DISMISSED",
            target_type="problem_duplicate_link",
            target_id=str(link.id),
            metadata_json={
                "problem_id": str(problem_id),
                "candidate_problem_id": str(link.candidate_problem_id),
            },
        )

        self.db.add(audit_entry)
        await self.db.commit()
        return True

    async def get_health(self) -> AIHealthResponse:
        """Return diagnostic health status for duplicate detection and vector search."""
        embedder_avail = EmbedderService.is_available()
        total_q = await self.db.execute(select(func.count(Problem.id)))
        total_count = total_q.scalar() or 0

        embedded_q = await self.db.execute(
            select(func.count(Problem.id)).where(Problem.embedding.isnot(None))
        )
        embedded_count = embedded_q.scalar() or 0

        return AIHealthResponse(
            embedder_available=embedder_avail,
            embedding_model=getattr(settings, "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"),
            embedding_dimension=int(getattr(settings, "EMBEDDING_DIM", 384)),
            total_problems=total_count,
            problems_with_embeddings=embedded_count,
            problems_without_embeddings=total_count - embedded_count,
            duplicate_detection_enabled=bool(getattr(settings, "DUPLICATE_DETECTION_ENABLED", True)),
            features={
                "moderation": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_MODERATION_ENABLED", True)),
                "duplicates": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_DUPLICATES_ENABLED", True)),
                "matching": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_MATCHING_ENABLED", True)),
                "impact": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_IMPACT_ENABLED", True)),
                "faculty": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_FACULTY_ENABLED", True)),
                "assistant": bool(getattr(settings, "AI_ENABLED", True) and getattr(settings, "AI_ASSISTANT_ENABLED", True)),
            },
            llm_reachable=bool(getattr(settings, "effective_ai_api_key", None) or getattr(settings, "AI_PROVIDER", "") == "fake"),
        )
