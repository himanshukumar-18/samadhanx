import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReviewDecision


class ReviewCreate(BaseModel):
    decision: ReviewDecision
    feedback_text: str = Field(..., min_length=5, max_length=5000)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    reviewer_id: uuid.UUID
    decision: ReviewDecision
    feedback_text: str
    created_at: datetime
    reviewer_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
