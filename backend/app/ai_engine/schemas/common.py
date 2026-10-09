"""Common data schemas, enums, and structures for the AI Engine."""

from enum import StrEnum
import uuid
from pydantic import BaseModel, Field


class RiskFlagType(StrEnum):
    SPAM = "spam"
    ABUSIVE_LANGUAGE = "abusive_language"
    HARASSMENT = "harassment"
    PII_EXPOSURE = "pii_exposure"
    PROMPT_INJECTION = "prompt_injection"
    SUSPICIOUS_LINKS = "suspicious_links"
    COMMERCIAL_ADVERTISING = "commercial_advertising"
    DUPLICATE_CONTENT = "duplicate_content"
    LOW_QUALITY = "low_quality"
    OFF_TOPIC = "off_topic"
    POLICY_VIOLATION = "policy_violation"


class RiskSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskFlag(BaseModel):
    """Detailed risk or policy violation flag."""

    type: RiskFlagType = Field(description="Categorical type of the detected risk")
    severity: RiskSeverity = Field(description="Severity impact level")
    reason: str = Field(description="Human-readable justification explaining why this flag was triggered")


class DuplicateSignal(BaseModel):
    """Similarity and duplicate detection indicators."""

    potential_duplicate: bool = Field(default=False, description="Flag indicating high likelihood of duplication")
    similar_problem_ids: list[str] = Field(default_factory=list, description="IDs of potentially duplicate problems")
    similarity_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Highest similarity score observed (0.0 to 1.0)")
    rationale: str | None = Field(default=None, description="Explanation of similarity match")


class ProblemAnalysisInput(BaseModel):
    """Sanitized input container provided to the AI Engine for analysis."""

    problem_id: uuid.UUID
    title: str
    description: str
    original_category: str | None = None
    district: str | None = None
    state: str | None = None
    author_id: uuid.UUID | None = None
