"""Deterministic test-only ModelProvider implementation for unit and integration testing."""

import asyncio
from typing import Any, TypeVar
from pydantic import BaseModel

from app.models.enums import AIModerationRecommendation
from app.ai_engine.exceptions import (
    AIMalformedOutputError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.schemas.common import RiskFlag, RiskFlagType, RiskSeverity
from app.ai_engine.schemas.moderation import ProblemModerationOutput
from app.ai_engine.schemas.problem_assistant import (
    AssistantExtractionOutput,
    AssistantProblemState,
    AssistantQuestionOutput,
    GeneratedProblemDraft,
)
from app.ai_engine.schemas.faculty_review import FacultyAIReviewOutput
from app.ai_engine.schemas.impact_report import AdminImpactReportOutput



T = TypeVar("T", bound=BaseModel)


class FakeAIProvider(ModelProvider):
    """Test provider producing realistic, deterministic structured outputs."""

    def __init__(
        self,
        simulate_error: str | None = None,
        delay_seconds: float = 0.0,
        fixed_output: ProblemModerationOutput | None = None,
    ):
        self.simulate_error = simulate_error
        self.delay_seconds = delay_seconds
        self.fixed_output = fixed_output
        self._provider_name = "fake"
        self._model_name = "fake-model"

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        system_prompt: str | None = None,
    ) -> tuple[T, dict[str, Any]]:
        """Simulate LLM response based on prompt text or configured test state."""
        if self.delay_seconds > 0:
            await asyncio.sleep(self.delay_seconds)

        # 1. Error simulation
        if self.simulate_error == "timeout":
            raise AITimeoutError("Simulated provider timeout")
        elif self.simulate_error == "rate_limit":
            raise AIRateLimitError("Simulated 429 rate limit exceeded")
        elif self.simulate_error == "provider_down":
            raise AIProviderError("Simulated provider outage / 500 error")
        elif self.simulate_error == "malformed":
            raise AIMalformedOutputError("Simulated invalid JSON generation")

        telemetry = {
            "provider": self.provider_name,
            "model": self.model_name,
            "duration_ms": int(self.delay_seconds * 1000) or 15,
            "prompt_tokens": 120,
            "completion_tokens": 80,
        }

        # 2. Fixed override if provided
        if self.fixed_output is not None:
            return self.fixed_output, telemetry  # type: ignore

        # Assistant Schemas support
        if schema == AssistantExtractionOutput:
            has_location = "barka" in prompt.lower() or "namkum" in prompt.lower() or "ranchi" in prompt.lower()
            out = AssistantExtractionOutput(
                extracted_state=AssistantProblemState(
                    category="Smart Infrastructure & Roads",
                    title="Damaged road and waterlogging",
                    description="Severe road breakage with deep potholes and water stagnation.",
                    location="Barka" if has_location else None,
                    district="Ranchi" if has_location else None,
                    state="Jharkhand" if has_location else None,
                    severity="high",
                    duration="6 months" if "6 months" in prompt.lower() else None,
                ),
                missing_fields=[] if has_location else ["location"],
                is_ready_for_draft=has_location,
            )
            return out, telemetry  # type: ignore

        if schema == AssistantQuestionOutput:
            out = AssistantQuestionOutput(
                question="Which specific area or village is experiencing this road damage?",
                field="location",
                suggested_answers=["Barka Village", "Namkum Chowk", "Main Road"],
            )
            return out, telemetry  # type: ignore

        if schema == GeneratedProblemDraft:
            out = GeneratedProblemDraft(
                title="Severe Road Damage and Waterlogging in Barka Village",
                description="The connecting road in Barka Village has broken down with persistent waterlogging, causing safety risks for school children and daily commuters.",
                category="Smart Infrastructure & Roads",
                location="Barka",
                district="Ranchi",
                state="Jharkhand",
                severity="high",
                impact="Daily commute is blocked and vehicles are stranded during rain.",
                tags=["Roads", "Infrastructure", "Waterlogging", "Safety"],
            )
            return out, telemetry  # type: ignore

        if schema == FacultyAIReviewOutput:
            if "insufficient" in prompt.lower() or "empty" in prompt.lower():
                out = FacultyAIReviewOutput(
                    summary="Not enough project data is available for a reliable AI review.",
                    progress_percentage=0,
                    completed_work=[],
                    pending_work=["Submit initial architecture specification", "Post milestone update"],
                    strengths=[],
                    risks=["Insufficient project documentation and zero submitted updates prevent evaluation."],
                    suggested_feedback=["Please submit project details and updates for faculty review."],
                    next_steps=["Post first milestone update"],
                    overall_assessment="insufficient_data",
                )
                return out, telemetry  # type: ignore

            out = FacultyAIReviewOutput(
                summary="The student pod has established a strong initial architecture and submitted valid milestone updates matching the civic problem.",
                progress_percentage=65,
                completed_work=[
                    "System architecture design completed and documented.",
                    "Core algorithm and data pipeline prototype created.",
                    "Initial repository and component structure established.",
                ],
                pending_work=[
                    "Conduct extensive integration and stress testing.",
                    "Perform on-ground user validation with affected community members.",
                    "Complete deployment and monitoring documentation.",
                ],
                strengths=[
                    "Clear problem-solution alignment with grassroots requirements.",
                    "Consistent git repository commits and detailed update logs.",
                ],
                risks=[
                    "Absence of field-testing results under low-bandwidth network conditions.",
                    "Need for fallback error handling in user-facing client application.",
                ],
                suggested_feedback=[
                    "Solid progress on core implementation. Focus on validating against realistic network constraints.",
                    "Include unit test coverage metrics in the next milestone update.",
                ],
                next_steps=[
                    "Run pilot test with sample community dataset.",
                    "Submit testing logs and user feedback summary for next review.",
                ],
                overall_assessment="on_track",
            )
            return out, telemetry  # type: ignore

        if schema == AdminImpactReportOutput:
            if "baseline" in prompt.lower() or "insufficient" in prompt.lower() or "total problems reported: 0" in prompt.lower():
                out = AdminImpactReportOutput(
                    headline="SamadhanX Platform: Baseline Inception Phase",
                    executive_summary="Currently, not enough platform activity is recorded in the database to generate a full impact report.",
                    key_achievements=["Platform infrastructure and governance initialized."],
                    problem_impact="Zero problems reported in this period.",
                    community_engagement="Grassroots citizen outreach is required to drive initial civic problem reports.",
                    student_impact="Student solution pods are ready for onboarding upon civic problem intake.",
                    collaboration_impact="Institutional university and industry partnerships are in preparatory stage.",
                    key_insights=["Baseline metrics establish platform operational readiness."],
                    areas_needing_attention=["Drive citizen problem submission campaigns.", "Onboard campus innovation teams."],
                    recommended_next_steps=["Launch regional awareness drives in target districts."],
                    is_data_limited=True,
                )
                return out, telemetry  # type: ignore

            out = AdminImpactReportOutput(
                headline="SamadhanX National Governance & Civic Innovation Impact Report",
                executive_summary="SamadhanX has achieved significant civic engagement across multiple districts, linking citizens, universities, and industry partners to drive tangible community solutions.",
                key_achievements=[
                    "Citizens reported civic problems across smart infrastructure, water, and sanitation.",
                    "Student innovation pods actively developing verified technological prototypes.",
                    "Demonstrated real-world problem resolution with interdisciplinary faculty mentorship.",
                ],
                problem_impact="The platform maintains high problem intake velocity with structured moderation and rapid problem validation.",
                community_engagement="Civic engagement is expanding with active citizen reporters across urban and rural wards.",
                student_impact="Student engineering teams have gained public interest technology experience building live prototypes.",
                collaboration_impact="Cross-sector collaboration connects university faculty with corporate CSR sponsors.",
                key_insights=[
                    "Strong alignment between reported community pain points and student prototype development.",
                    "Multi-tier mentorship accelerates prototype maturity and field deployment.",
                ],
                areas_needing_attention=[
                    "Streamline review turnaround for pending problem submissions.",
                    "Expand industry pilot sponsorships for field-ready prototypes.",
                ],
                recommended_next_steps=[
                    "Launch targeted municipal innovation hackathons in high-problem wards.",
                    "Establish fast-track verification channels for urgent civic hazards.",
                ],
                is_data_limited=False,
            )
            return out, telemetry  # type: ignore


        # 3. Dynamic content inspection heuristics for test assertions
        prompt_lower = prompt.lower()

        # Spam simulation
        if "casino" in prompt_lower or "lottery" in prompt_lower or "crypto" in prompt_lower or "buy cheap" in prompt_lower:
            out = ProblemModerationOutput(
                category="Other",
                subcategory="Other",
                summary="Promotional or spam submission offering commercial products.",
                keywords=["spam", "advertisement", "commercial"],
                spam_probability=0.95,
                spam_reasons=["Promotional content", "Unrelated commercial advertisement"],
                quality_score=0.1,
                confidence=0.92,
                risk_flags=[
                    RiskFlag(
                        type=RiskFlagType.SPAM,
                        severity=RiskSeverity.HIGH,
                        reason="Unsolicited commercial advertising detected.",
                    )
                ],
                recommendation=AIModerationRecommendation.SPAM_REVIEW,
                reason="High spam probability detected (95%). Routed to spam review queue.",
            )
            return out, telemetry  # type: ignore

        # Low confidence simulation
        if "vague" in prompt_lower or "gibberish" in prompt_lower or len(prompt.strip()) < 30:
            out = ProblemModerationOutput(
                category="Other",
                subcategory="Other",
                summary="Insufficient detail provided to classify problem.",
                keywords=["unclear", "insufficient_data"],
                spam_probability=0.25,
                spam_reasons=[],
                quality_score=0.3,
                confidence=0.45,
                risk_flags=[
                    RiskFlag(
                        type=RiskFlagType.LOW_QUALITY,
                        severity=RiskSeverity.LOW,
                        reason="Low detail and ambiguous civic context.",
                    )
                ],
                recommendation=AIModerationRecommendation.HUMAN_REVIEW_REQUIRED,
                reason="Confidence score (45%) is below threshold. Human review required.",
            )
            return out, telemetry  # type: ignore

        # Default clean civic problem simulation
        cat = "Water & Sanitation"
        subcat = "Drainage & Sewage"
        if "water" in prompt_lower or "sewage" in prompt_lower or "drain" in prompt_lower or "sanitation" in prompt_lower:
            cat = "Water & Sanitation"
            subcat = "Drainage & Sewage"
        elif "solar" in prompt_lower or "energy" in prompt_lower or "electric" in prompt_lower:
            cat = "Clean Energy & Solar"
            subcat = "Solar Streetlights"
        elif "waste" in prompt_lower or "garbage" in prompt_lower:
            cat = "Waste Management"
            subcat = "Garbage Dumping"
        elif "hospital" in prompt_lower or "disease" in prompt_lower or "medical" in prompt_lower or "clinic" in prompt_lower:
            cat = "Healthcare & Medical Devices"
            subcat = "Primary Health Center Access"
        elif "road" in prompt_lower or "pothole" in prompt_lower or "traffic" in prompt_lower:
            cat = "Smart Infrastructure & Roads"
            subcat = "Potholes & Road Damage"
        elif "school" in prompt_lower or "education" in prompt_lower:
            cat = "Education & Skill Development"
            subcat = "School Infrastructure"

        out = ProblemModerationOutput(
            category=cat,
            subcategory=subcat,
            summary="Civic challenge concerning local community infrastructure requiring intervention.",
            keywords=["civic", "infrastructure", "community", "public_interest"],
            spam_probability=0.04,
            spam_reasons=[],
            quality_score=0.88,
            confidence=0.91,
            risk_flags=[],
            recommendation=AIModerationRecommendation.NORMAL_REVIEW,
            reason="High quality civic problem submission with actionable description and clear category match.",
        )
        return out, telemetry  # type: ignore

    async def health_check(self) -> bool:
        return True
