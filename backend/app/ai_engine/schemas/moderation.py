"""Pydantic schemas for AI Moderation Assistant structured output and API interfaces."""

from datetime import datetime
import uuid
from typing import Any
from pydantic import BaseModel, Field, field_validator

from app.models.enums import AIAnalysisStatus, AIModerationRecommendation
from app.ai_engine.schemas.common import DuplicateSignal, RiskFlag


class ProblemModerationOutput(BaseModel):
    """Raw structured output schema enforced on LLM generation."""

    category: str = Field(
        default="Other",
        description="Canonical primary category of the civic problem selected strictly from allowed taxonomy",
    )
    subcategory: str = Field(
        default="Other",
        description="Subcategory selected strictly from allowed subcategory taxonomy",
    )
    summary: str = Field(
        default="",
        description="Factual, concise summary of the core issue without hyperbole or added assumptions (max 250 chars)",
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="3 to 7 normalized search/discovery tags without PII or punctuation",
    )
    spam_probability: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Probability score that the submission is spam/advertisement/gibberish (0.0 to 1.0)",
    )
    spam_reasons: list[str] = Field(
        default_factory=list,
        description="Concrete reasons for spam flag if spam_probability > 0.3",
    )
    quality_score: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Assessment of problem clarity, actionable detail, and civic relevance (0.0 to 1.0)",
    )
    confidence: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Model confidence in categorization and moderation assessment (0.0 to 1.0)",
    )
    risk_flags: list[RiskFlag] = Field(
        default_factory=list,
        description="List of detected policy violations or sensitive content flags",
    )
    recommendation: AIModerationRecommendation = Field(
        default=AIModerationRecommendation.NORMAL_REVIEW,
        description="Action recommendation for Human Admin",
    )
    reason: str = Field(
        default="Civic moderation assessment based on problem content.",
        description="Concise human-readable explanation justifying the recommendation for the Admin",
    )

    @field_validator("risk_flags", mode="before")
    @classmethod
    def resolve_risk_flags(cls, v: Any) -> list[Any]:
        if isinstance(v, list):
            parsed = []
            for item in v:
                if isinstance(item, str):
                    s = item.strip().lower()
                    from app.ai_engine.schemas.common import RiskFlagType, RiskSeverity
                    flag_type = RiskFlagType.SPAM if ("spam" in s or "ad" in s or "link" in s or "commercial" in s) else RiskFlagType.OTHER
                    severity = RiskSeverity.HIGH if ("spam" in s or "scam" in s or "abus" in s) else RiskSeverity.MEDIUM
                    parsed.append(RiskFlag(type=flag_type, severity=severity, reason=item))
                elif isinstance(item, (dict, RiskFlag)):
                    parsed.append(item)
            return parsed
        return []

    @field_validator("category", mode="before")
    @classmethod
    def resolve_category_field(cls, v: Any, info) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip()
        return "Other"

    @field_validator("reason", mode="before")
    @classmethod
    def resolve_reason_field(cls, v: Any) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip()
        return "Standard civic problem evaluation."

    @field_validator("keywords", mode="before")
    @classmethod
    def clean_keywords(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            cleaned = []
            for item in v:
                if isinstance(item, str):
                    c = item.strip().lower()
                    if c and len(c) > 1 and c not in cleaned:
                        cleaned.append(c)
            return cleaned[:7]
        return []


class PersistedAIAnalysisResponse(BaseModel):
    """API view representation of a stored AI analysis result."""

    id: uuid.UUID
    problem_id: uuid.UUID
    analysis_version: int
    status: AIAnalysisStatus
    provider: str
    model_name: str
    prompt_version: str

    category: str | None = None
    subcategory: str | None = None
    summary: str | None = None
    keywords: list[str] = Field(default_factory=list)

    spam_probability: float | None = None
    spam_reasons: list[str] = Field(default_factory=list)
    quality_score: float | None = None
    confidence: float | None = None
    risk_flags: list[dict[str, Any]] = Field(default_factory=list)

    recommendation: AIModerationRecommendation | None = None
    reason: str | None = None
    duplicate_signal: dict[str, Any] | None = None

    error_code: str | None = None
    error_message: str | None = None
    duration_ms: int | None = None
    trigger: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReanalysisRequest(BaseModel):
    """Admin request body to trigger AI re-analysis on a problem."""

    force: bool = Field(default=False, description="Force re-analysis even if already completed")
    reason: str | None = Field(default=None, description="Optional administrative reason for re-running AI")
