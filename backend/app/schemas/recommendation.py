import uuid
from pydantic import BaseModel, ConfigDict, Field


class ProblemRecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    problem_id: str
    title: str
    description: str
    category: str
    location: str | None = None
    district: str
    state: str | None = None
    status: str
    match_level: str = "good"  # "strong", "good", "fair", "general"
    match_label: str = "good"  # backward compatibility alias for match_level
    matched_skills: list[str] = Field(default_factory=list)
    reason: str
    similarity_score: float | None = None
    recommendation_score: float | None = None
    created_at: str | None = None


class StudentRecommendationsData(BaseModel):
    is_fallback: bool = False
    hint: str | None = None
    recommendations: list[ProblemRecommendationItem] = Field(default_factory=list)
    items: list[ProblemRecommendationItem] = Field(default_factory=list)


class StudentRecommendationsResponse(BaseModel):
    success: bool = True
    data: StudentRecommendationsData

