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
