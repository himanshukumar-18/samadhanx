"""Pydantic schemas and state contracts for the Citizen Smart Problem Assistant.

Maintains strict structured state across multi-turn civic conversations,
decoupling frontend rendering from raw LLM text generation.
"""

from typing import Any, Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.duplicate import DuplicateCandidatePublic


class AssistantProblemState(BaseModel):
    """Structured civic problem state collected across turns."""

    category: str | None = Field(default=None, description="Standard SamadhanX category")
    title: str | None = Field(default=None, description="Brief provisional title")
    description: str | None = Field(default=None, description="Detailed problem narrative")
    location: str | None = Field(default=None, description="Specific village, street, ward, or landmark")
    district: str | None = Field(default=None, description="District or city name")
    duration: str | None = Field(default=None, description="How long the problem has persisted")
    affected_people: str | None = Field(default=None, description="Who is affected (e.g. commuters, students)")
    impact: str | None = Field(default=None, description="Civic consequence or safety hazard")
    severity: Literal["low", "medium", "high", "critical"] | None = Field(
        default=None, description="Assessed impact severity level"
    )
    evidence: list[str] = Field(default_factory=list, description="Media or landmark evidence mentions")
    latitude: float | None = Field(default=None, description="Optional GPS latitude coordinate")
    longitude: float | None = Field(default=None, description="Optional GPS longitude coordinate")
    media_urls: list[str] = Field(default_factory=list, description="Attached photo/video URLs")
    conversation_complete: bool = Field(default=False, description="Whether sufficient info exists to draft report")

    model_config = ConfigDict(extra="ignore")


class GeneratedProblemDraft(BaseModel):
    """Finalized problem draft ready for citizen review and submission."""

    title: str = Field(..., min_length=5, max_length=255, description="Clear, descriptive civic problem title")
    description: str = Field(..., min_length=20, max_length=4000, description="Comprehensive, objective problem description")
    category: str = Field(..., description="Canonical SamadhanX category")
    location: str = Field(..., description="Specific location (e.g. Barka Village, Near Middle School)")
    district: str = Field(..., description="District name (e.g. Ranchi)")
    state: str = Field(default="Jharkhand", description="State name")
    latitude: float | None = Field(default=None, description="Optional GPS latitude coordinate")
    longitude: float | None = Field(default=None, description="Optional GPS longitude coordinate")
    media_urls: list[str] = Field(default_factory=list, description="Attached photo/video URLs")
    duration: str | None = Field(default=None, description="Duration of issue")
    affected_people: str | None = Field(default=None, description="Affected community group")
    impact: str | None = Field(default=None, description="Key impact or risk")
    severity: Literal["low", "medium", "high", "critical"] = Field(
        default="medium", description="Suggested impact level"
    )
    tags: list[str] = Field(default_factory=list, description="Relevant search tags")

    model_config = ConfigDict(extra="ignore")


class AssistantExtractionOutput(BaseModel):
    """Structured extraction output from LLM analyzing a citizen turn."""

    extracted_state: AssistantProblemState = Field(
        ..., description="Newly identified or updated facts strictly mentioned by citizen"
    )
    missing_fields: list[str] = Field(
        default_factory=list,
        description="High-value missing civic fields (e.g. 'location', 'district', 'duration', 'impact')",
    )
    is_ready_for_draft: bool = Field(
        default=False,
        description="True if enough critical information (location + what's wrong) is known to generate draft",
    )


class AssistantQuestionOutput(BaseModel):
    """Structured question generation output."""

    question: str = Field(..., description="One polite, targeted question asking for missing info")
    field: str = Field(..., description="The specific field being inquired about")
    suggested_answers: list[str] = Field(
        default_factory=list, description="2-4 short quick-reply options (e.g. ['Under 1 month', '1-6 months', 'Over 1 year'])"
    )


class AssistantTurnResponse(BaseModel):
    """Standardized API response for each turn of the Smart Problem Assistant."""

    session_id: str
    message: str
    type: Literal["question", "complete", "clarification"]
    field: str | None = None
    suggested_answers: list[str] = Field(default_factory=list)
    state: AssistantProblemState
    progress: int = Field(..., ge=0, le=100, description="Completion percentage (0-100)")
    complete: bool
    turn_count: int
    max_turns: int = 5
    problem: GeneratedProblemDraft | None = None
    similar_problems: list[DuplicateCandidatePublic] = Field(
        default_factory=list, description="Similar existing problems found via duplicate detection"
    )


class StartAssistantRequest(BaseModel):
    initial_message: str | None = Field(None, max_length=1000)
    district_hint: str | None = Field(None, max_length=100)


class SendAssistantMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

