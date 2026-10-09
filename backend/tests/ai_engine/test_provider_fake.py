"""Tests for FakeAIProvider and error simulation."""

import pytest
from app.models.enums import AIModerationRecommendation
from app.ai_engine.exceptions import (
    AIMalformedOutputError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai_engine.providers.fake import FakeAIProvider
from app.ai_engine.schemas.moderation import ProblemModerationOutput


@pytest.mark.asyncio
async def test_fake_provider_clean_generation():
    provider = FakeAIProvider()
    prompt = "Severe drainage block near government high school causing waterlogging."
    output, telemetry = await provider.generate_structured(prompt=prompt, schema=ProblemModerationOutput)

    assert isinstance(output, ProblemModerationOutput)
    assert output.category == "Education & Skill Development" or output.category == "Water & Sanitation"
    assert output.spam_probability < 0.1
    assert output.recommendation == AIModerationRecommendation.NORMAL_REVIEW
    assert telemetry["provider"] == "fake"


@pytest.mark.asyncio
async def test_fake_provider_spam_generation():
    provider = FakeAIProvider()
    prompt = "Claim your free online casino bonus and crypto lottery now!"
    output, telemetry = await provider.generate_structured(prompt=prompt, schema=ProblemModerationOutput)

    assert output.spam_probability > 0.8
    assert output.recommendation == AIModerationRecommendation.SPAM_REVIEW


@pytest.mark.asyncio
async def test_fake_provider_simulated_errors():
    timeout_provider = FakeAIProvider(simulate_error="timeout")
    with pytest.raises(AITimeoutError):
        await timeout_provider.generate_structured("test", ProblemModerationOutput)

    rate_limit_provider = FakeAIProvider(simulate_error="rate_limit")
    with pytest.raises(AIRateLimitError):
        await rate_limit_provider.generate_structured("test", ProblemModerationOutput)

    outage_provider = FakeAIProvider(simulate_error="provider_down")
    with pytest.raises(AIProviderError):
        await outage_provider.generate_structured("test", ProblemModerationOutput)

    malformed_provider = FakeAIProvider(simulate_error="malformed")
    with pytest.raises(AIMalformedOutputError):
        await malformed_provider.generate_structured("test", ProblemModerationOutput)
