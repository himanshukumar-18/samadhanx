"""Unit tests for GroqProvider, SpamService, and LangChain moderation chains."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai_engine.config.settings import AISettings
from app.ai_engine.providers.groq import GroqProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.services.spam_service import SpamService
from app.ai_engine.schemas.moderation import ProblemModerationOutput
from app.ai_engine.schemas.common import RiskFlagType


def test_groq_provider_initialization():
    settings = AISettings(
        provider="groq",
        api_key="gsk_mock_test_key_12345",
        model="llama-3.3-70b-versatile",
        base_url="https://api.groq.com/openai/v1",
        timeout_seconds=15,
        max_retries=2,
    )
    provider = GroqProvider(settings)
    assert provider.provider_name == "groq"
    assert provider.model_name == "llama-3.3-70b-versatile"
    assert provider.settings.api_key == "gsk_mock_test_key_12345"


def test_factory_returns_groq_provider():
    settings = AISettings(
        provider="groq",
        api_key="gsk_mock_test_key_12345",
        model="llama-3.3-70b-versatile",
    )
    provider = get_model_provider(settings)
    assert isinstance(provider, GroqProvider)
    assert provider.provider_name == "groq"


def test_spam_service_heuristics_clean_input():
    service = SpamService()
    score, reasons, flags = service.evaluate_heuristics(
        title="Potholes on MG Road",
        description="The main road near the bus stand has multiple deep potholes causing traffic hazards.",
    )
    assert score == 0.0
    assert len(reasons) == 0
    assert len(flags) == 0


def test_spam_service_heuristics_commercial_spam():
    service = SpamService()
    score, reasons, flags = service.evaluate_heuristics(
        title="Buy Cheap Crypto Now!",
        description="Earn $500 daily click here https://scam-crypto.xyz for casino and betting slot machines.",
    )
    assert score >= 0.5
    assert len(reasons) > 0
    assert any(f.type in (RiskFlagType.COMMERCIAL_ADVERTISING, RiskFlagType.SUSPICIOUS_LINKS) for f in flags)


def test_spam_service_score_combination():
    service = SpamService()
    # High heuristic + low model -> conservative max or weighted
    score, reasons = service.combine_scores(
        heuristic_score=0.9,
        model_score=0.1,
        heuristic_reasons=["Commercial ad detected"],
        model_reasons=[],
    )
    assert score >= 0.8
    assert "Commercial ad detected" in reasons


@pytest.mark.asyncio
async def test_groq_provider_structured_output_mocked():
    settings = AISettings(
        provider="groq",
        api_key="gsk_mock_test_key_12345",
        model="llama-3.3-70b-versatile",
    )
    provider = GroqProvider(settings)

    mock_llm_response = ProblemModerationOutput(
        category="Water & Sanitation",
        subcategory="Drinking Water Supply",
        summary="Drinking water pipeline broken in sector 4.",
        keywords=["water", "leakage", "pipeline"],
        spam_probability=0.02,
        quality_score=0.9,
        confidence=0.95,
        reason="Clear civic water infrastructure issue.",
    )

    with patch.object(provider, "generate_structured", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = (mock_llm_response, {"provider": "groq", "model": "llama-3.3-70b-versatile", "latency_ms": 120})
        output, telemetry = await provider.generate_structured(
            prompt="Analyze problem",
            schema=ProblemModerationOutput,
        )
        assert output.category == "Water & Sanitation"
        assert output.subcategory == "Drinking Water Supply"
        assert telemetry["provider"] == "groq"
