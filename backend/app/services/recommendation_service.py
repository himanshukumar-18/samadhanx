import json
import logging
import math
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_engine.services.embedder import EmbedderService
from app.core.config import settings
from app.models.enums import ProblemStatus
from app.models.problem import Problem, ProblemEndorsement
from app.models.profiles import StudentProfile
from app.models.project import ProjectMember, SolutionProject
from app.models.user import User
from app.models.user_profile import UserProfileDetail
from app.schemas.recommendation import (
    ProblemRecommendationItem,
    StudentRecommendationsData,
    StudentRecommendationsResponse,
)

logger = logging.getLogger("samadhanx.recommendations")

ALLOWED_CANDIDATE_STATUSES = [
    ProblemStatus.VERIFIED,
    ProblemStatus.IN_PROGRESS,
    ProblemStatus.SOLUTION_SUBMITTED,
]


def _cosine_similarity(vec1: list[float] | None, vec2: list[float] | None) -> float:
    """Compute cosine similarity between two float vectors in pure Python."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2, strict=False))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


def _match_skills(search_text: str, student_skills: list[str]) -> list[str]:
    """Find student skills that match words or phrases in the problem text."""
    matched = []
    text_lower = search_text.lower()
    for skill in student_skills:
        s = skill.strip()
        if not s:
            continue
        s_lower = s.lower()
        if len(s_lower) <= 3:
            # Match acronyms (AI, ML, IoT, GIS, etc.) with word boundaries
            pattern = rf"\b{re.escape(s_lower)}\b"
            if re.search(pattern, text_lower):
                matched.append(s)
        else:
            if s_lower in text_lower:
                matched.append(s)
    return matched


def _generate_reason(matched_skills: list[str], similarity: float) -> str:
    """Generate explainable natural-language recommendation rationale."""
    if matched_skills:
        top_skills = matched_skills[:3]
        if len(top_skills) == 1:
            skill_text = top_skills[0]
        elif len(top_skills) == 2:
            skill_text = f"{top_skills[0]} and {top_skills[1]}"
        else:
            skill_text = f"{', '.join(top_skills[:-1])} and {top_skills[-1]}"
        return f"Recommended because this problem strongly matches your {skill_text} skills."
    if similarity >= 0.70:
        return "Recommended based on strong semantic alignment with your profile and interests."
    return "Recommended based on your academic background and interests."


async def _get_cached_recommendations(cache_key: str) -> dict[str, Any] | None:
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=1, decode_responses=True)
        async with r:
            cached = await r.get(cache_key)
            if cached:
                return json.loads(cached)
    except Exception:
        pass
    return None


async def _set_cached_recommendations(cache_key: str, data: dict[str, Any], ttl: int = 300) -> None:
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=1, decode_responses=True)
        async with r:
            await r.set(cache_key, json.dumps(data), ex=ttl)
    except Exception:
        pass


async def invalidate_student_recommendations_cache(student_id: uuid.UUID) -> None:
    """Invalidate cached recommendations when student profile or skills change."""
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=1, decode_responses=True)
        async with r:
            pattern = f"rec:student:{student_id}:*"
            cursor = 0
            while True:
                cursor, keys = await r.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await r.delete(*keys)
                if cursor == 0:
                    break
    except Exception:
        pass


class StudentRecommendationService:
    """Semantic vector + structured skill matching recommendation service for students."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_recommendations(
        self,
        student_user: User,
        limit: int = 10,
        category: str | None = None,
        district: str | None = None,
    ) -> StudentRecommendationsResponse:
        cache_key = f"rec:student:{student_user.id}:{limit}:{category or 'all'}:{district or 'all'}"
        cached = await _get_cached_recommendations(cache_key)
        if cached:
            try:
                return StudentRecommendationsResponse.model_validate(cached)
            except Exception:
                pass

        # 1. Fetch student skills and profile details
        profile_res = await self.db.execute(
            select(StudentProfile)
            .options(selectinload(StudentProfile.university))
            .where(StudentProfile.user_id == student_user.id)
        )
        student_profile = profile_res.scalar_one_or_none()

        detail_res = await self.db.execute(
            select(UserProfileDetail).where(UserProfileDetail.user_id == student_user.id)
        )
        user_detail = detail_res.scalar_one_or_none()

        skills = []
        if student_profile and student_profile.skills:
            skills.extend([str(s).strip() for s in student_profile.skills if str(s).strip()])
        if user_detail and user_detail.skills:
            for s in user_detail.skills:
                s_str = str(s).strip()
                if s_str and s_str not in skills:
                    skills.append(s_str)

        department = student_profile.department if student_profile else None
        bio = (student_profile.bio if student_profile else None) or (user_detail.bio if user_detail else None)
        headline = (student_profile.headline if student_profile else None) or (user_detail.headline if user_detail else None)

        # 2. Exclude problems already picked / led / joined by the student
        picked_query = select(SolutionProject.problem_id).outerjoin(
            ProjectMember, ProjectMember.project_id == SolutionProject.id
        ).where(
            (SolutionProject.lead_student_id == student_user.id)
            | (ProjectMember.user_id == student_user.id)
        )
        picked_res = await self.db.execute(picked_query)
        excluded_ids = {row[0] for row in picked_res.fetchall() if row[0] is not None}

        # 3. Empty profile fallback: if student has no skills
        if not skills:
            fallback_items = await self._get_fallback_popular_problems(
                limit=limit,
                category=category,
                district=district,
                excluded_ids=excluded_ids,
            )
            data = StudentRecommendationsData(
                is_fallback=True,
                hint="Complete your profile with your skills to receive personalized AI recommendations.",
                recommendations=fallback_items,
                items=fallback_items,
            )
            resp = StudentRecommendationsResponse(success=True, data=data)
            await _set_cached_recommendations(cache_key, resp.model_dump(mode="json"), ttl=120)
            return resp

        # 4. Generate semantic student representation & vector
        profile_parts = [f"Student skills: {', '.join(skills)}."]
        if department:
            profile_parts.append(f"Department: {department}.")
        if headline:
            profile_parts.append(f"Interests: {headline}.")
        elif bio:
            profile_parts.append(f"Bio: {bio[:200]}.")
        student_text = " ".join(profile_parts)

        student_vector = None
        try:
            student_vector = EmbedderService.get_embedding(student_text)
        except Exception as exc:
            logger.warning(f"Embedder failed for student {student_user.id}: {exc}")

        # 5. Query candidate problems and calculate similarity
        candidates = await self._search_candidate_problems(
            student_vector=student_vector,
            limit=limit * 3,  # Fetch pool of candidates to rank
            category=category,
            district=district,
            excluded_ids=excluded_ids,
        )

        # 6. Hybrid scoring and ranking
        ranked_items: list[ProblemRecommendationItem] = []
        now = datetime.now(UTC)

        for cand in candidates:
            prob_title = cand["title"]
            prob_desc = cand["description"]
            prob_cat = cand["category"]
            prob_tags = cand.get("tags") or []
            prob_created_at = cand.get("created_at")

            searchable = f"{prob_title} {prob_desc} {prob_cat} {' '.join(str(t) for t in prob_tags)}"
            matched_skills = _match_skills(searchable, skills)

            similarity = cand.get("similarity", 0.0)
            skill_score = min(1.0, len(matched_skills) * 0.35)

            freshness = 0.5
            if prob_created_at:
                try:
                    if prob_created_at.tzinfo is None:
                        prob_created_at = prob_created_at.replace(tzinfo=UTC)
                    age_days = (now - prob_created_at).total_seconds() / 86400.0
                    freshness = max(0.0, 1.0 - (age_days / 180.0))
                except Exception:
                    pass

            category_bonus = 0.05 if (department and department.lower() in prob_cat.lower()) else 0.0

            # 70% semantic similarity + 20% skill overlap + 10% freshness/category
            final_score = round(
                min(1.0, max(0.0, 0.70 * similarity + 0.20 * skill_score + 0.05 * freshness + category_bonus)),
                3,
            )

            if final_score >= 0.70:
                match_level = "strong"
            elif final_score >= 0.45:
                match_level = "good"
            else:
                match_level = "fair"

            reason = _generate_reason(matched_skills, similarity)

            item = ProblemRecommendationItem(
                id=cand["id"],
                problem_id=str(cand["id"]),
                title=prob_title,
                description=prob_desc,
                category=prob_cat,
                location=cand.get("location"),
                district=cand.get("district") or "",
                state=cand.get("state"),
                status=cand.get("status") if isinstance(cand.get("status"), str) else getattr(cand.get("status"), "value", str(cand.get("status"))),
                match_level=match_level,
                match_label=match_level,
                matched_skills=matched_skills[:8],
                reason=reason,
                similarity_score=round(similarity, 3) if similarity else None,
                recommendation_score=final_score,
                created_at=prob_created_at.isoformat() if prob_created_at else None,
            )
            ranked_items.append(item)

        ranked_items.sort(
            key=lambda x: (x.recommendation_score or 0.0, len(x.matched_skills)),
            reverse=True,
        )

        final_recommendations = ranked_items[:limit]

        # If vector candidates were completely empty, fallback gracefully
        if not final_recommendations:
            final_recommendations = await self._get_fallback_popular_problems(
                limit=limit,
                category=category,
                district=district,
                excluded_ids=excluded_ids,
            )
            data = StudentRecommendationsData(
                is_fallback=True,
                hint="No direct skill matches found. Showing verified community problems.",
                recommendations=final_recommendations,
                items=final_recommendations,
            )
        else:
            data = StudentRecommendationsData(
                is_fallback=False,
                hint=None,
                recommendations=final_recommendations,
                items=final_recommendations,
            )

        resp = StudentRecommendationsResponse(success=True, data=data)
        await _set_cached_recommendations(cache_key, resp.model_dump(mode="json"), ttl=300)
        return resp

    async def _search_candidate_problems(
        self,
        student_vector: list[float] | None,
        limit: int,
        category: str | None,
        district: str | None,
        excluded_ids: set[uuid.UUID],
    ) -> list[dict[str, Any]]:
        dialect_name = self.db.bind.dialect.name if self.db.bind else "postgresql"

        # Try native pgvector query when on PostgreSQL and vector is present
        if dialect_name == "postgresql" and student_vector:
            try:
                vec_str = "[" + ",".join(str(f) for f in student_vector) + "]"
                allowed_status_names = [s.value.upper() for s in ALLOWED_CANDIDATE_STATUSES]

                where_clauses = [
                    "p.embedding IS NOT NULL",
                    "UPPER(p.status::text) = ANY(:status_filter)",
                ]
                params: dict[str, Any] = {
                    "vec_str": vec_str,
                    "status_filter": allowed_status_names,
                    "limit": limit,
                }

                if excluded_ids:
                    where_clauses.append("p.id != ALL(CAST(:excluded_ids AS uuid[]))")
                    params["excluded_ids"] = [str(uid) for uid in excluded_ids]

                if category:
                    where_clauses.append("p.category ILIKE :category")
                    params["category"] = f"%{category.strip()}%"

                if district:
                    where_clauses.append("p.district ILIKE :district")
                    params["district"] = f"%{district.strip()}%"

                where_sql = " AND ".join(where_clauses)

                sql = f"""
                    SELECT p.id, p.title, p.description, p.category, p.location, p.district, p.state,
                           p.status, p.tags, p.created_at,
                           (1.0 - (p.embedding <=> CAST(:vec_str AS vector))) AS similarity,
                           COUNT(pe.id) AS endorsement_count
                    FROM problems p
                    LEFT JOIN problem_endorsements pe ON pe.problem_id = p.id
                    WHERE {where_sql}
                    GROUP BY p.id
                    ORDER BY (p.embedding <=> CAST(:vec_str AS vector)) ASC
                    LIMIT :limit;
                """
                res = await self.db.execute(text(sql), params)
                rows = res.fetchall()
                if rows:
                    candidates = []
                    for row in rows:
                        candidates.append({
                            "id": row.id,
                            "title": row.title,
                            "description": row.description,
                            "category": row.category,
                            "location": row.location,
                            "district": row.district,
                            "state": row.state,
                            "status": str(row.status),
                            "tags": row.tags or [],
                            "created_at": row.created_at,
                            "similarity": max(0.0, min(1.0, float(row.similarity))),
                        })
                    return candidates
            except Exception as exc:
                logger.warning(f"PostgreSQL pgvector query failed, falling back to python similarity: {exc}")

        # Fallback query (for SQLite during test runs or if pgvector query errored)
        query = (
            select(Problem)
            .options(selectinload(Problem.endorsements))
            .where(
                Problem.status.in_(ALLOWED_CANDIDATE_STATUSES),
                Problem.embedding.isnot(None),
            )
        )
        if excluded_ids:
            query = query.where(Problem.id.not_in(excluded_ids))
        if category:
            query = query.where(Problem.category.ilike(f"%{category.strip()}%"))
        if district:
            query = query.where(Problem.district.ilike(f"%{district.strip()}%"))

        res = await self.db.execute(query.limit(limit * 2))
        problems = res.scalars().all()

        candidates = []
        for p in problems:
            sim = _cosine_similarity(student_vector, p.embedding) if student_vector and p.embedding else 0.0
            candidates.append({
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "category": p.category,
                "location": p.location,
                "district": p.district,
                "state": p.state,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                "tags": p.tags or [],
                "created_at": p.created_at,
                "similarity": max(0.0, min(1.0, float(sim))),
            })

        candidates.sort(key=lambda c: c["similarity"], reverse=True)
        return candidates[:limit]

    async def _get_fallback_popular_problems(
        self,
        limit: int,
        category: str | None,
        district: str | None,
        excluded_ids: set[uuid.UUID],
    ) -> list[ProblemRecommendationItem]:
        """Return popular and verified community problems for students without skills."""
        query = (
            select(Problem)
            .where(Problem.status.in_(ALLOWED_CANDIDATE_STATUSES))
        )
        if excluded_ids:
            query = query.where(Problem.id.not_in(excluded_ids))
        if category:
            query = query.where(Problem.category.ilike(f"%{category.strip()}%"))
        if district:
            query = query.where(Problem.district.ilike(f"%{district.strip()}%"))

        query = query.order_by(desc(Problem.created_at)).limit(limit)
        res = await self.db.execute(query)
        problems = res.scalars().all()

        items = []
        for p in problems:
            status_val = p.status.value if hasattr(p.status, "value") else str(p.status)
            items.append(
                ProblemRecommendationItem(
                    id=p.id,
                    problem_id=str(p.id),
                    title=p.title,
                    description=p.description,
                    category=p.category,
                    location=p.location,
                    district=p.district,
                    state=p.state,
                    status=status_val,
                    match_level="general",
                    match_label="general",
                    matched_skills=[],
                    reason="Popular verified civic problem on SamadhanX",
                    similarity_score=None,
                    recommendation_score=0.5,
                    created_at=p.created_at.isoformat() if p.created_at else None,
                )
            )
        return items

