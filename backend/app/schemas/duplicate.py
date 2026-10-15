import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DuplicateLinkStatus, DuplicateVerdict


class DuplicateCheckRequest(BaseModel):
    """Citizen request schema for real-time duplicate pre-checking."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=3, max_length=150, description="Problem title")
    description: str = Field(..., min_length=10, max_length=2000, description="Problem detailed description")
    category: str | None = Field(None, max_length=100, description="Problem category")
    district: str | None = Field(None, max_length=100, description="District location")


class DuplicateCandidatePublic(BaseModel):
    """Reduced, privacy-preserving public candidate schema for citizen view."""

    id: uuid.UUID
    title: str
    category: str
    district: str
    status: str
    endorsement_count: int
    similarity_label: str  # "very_similar" | "similar"


class DuplicateCheckResponse(BaseModel):
    """Response returned to citizen during duplicate pre-checking."""

    candidates: list[DuplicateCandidatePublic]
    degraded: bool = False


class DuplicateLinkResponse(BaseModel):
    """Full detail duplicate link schema for admin moderation queue."""

    id: uuid.UUID
    problem_id: uuid.UUID
    candidate_problem_id: uuid.UUID
    candidate_title: str
    candidate_district: str
    candidate_status: str
    candidate_category: str
    similarity: float
    verdict: DuplicateVerdict
    llm_used: bool
    llm_reason: str | None = None
    status: DuplicateLinkStatus
    reviewed_by_id: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class MergeRequest(BaseModel):
    """Admin request schema to merge a duplicate problem into a canonical problem."""

    model_config = ConfigDict(extra="forbid")

    target_problem_id: uuid.UUID = Field(..., description="The canonical problem ID to merge into")


class MergeResponse(BaseModel):
    """Result of transactional problem merge."""

    success: bool
    message: str
    canonical_problem_id: uuid.UUID
    merged_problem_id: uuid.UUID
    endorsements_transferred: int


class AIHealthResponse(BaseModel):
    """AI and pgvector embedding health check diagnostics for admin."""

    embedder_available: bool
    embedding_model: str
    embedding_dimension: int
    total_problems: int
    problems_with_embeddings: int
    problems_without_embeddings: int
    duplicate_detection_enabled: bool
    features: dict[str, bool] = Field(default_factory=dict)
    llm_reachable: bool | None = None
    last_error: str | None = None
    queue_depth: int | None = None
