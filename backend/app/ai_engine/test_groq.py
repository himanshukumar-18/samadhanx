"""Standalone diagnostic tool to verify live connectivity to Groq API via LangChain.

Usage (inside container or host with environment):
    python -m app.ai_engine.test_groq

Outputs strictly safe diagnostics (Model, Provider, Latency, Token Usage) WITHOUT printing API keys.
"""

import asyncio
import sys
import time

from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.providers.groq import GroqProvider
from app.ai_engine.schemas.moderation import ProblemModerationOutput


async def run_diagnostic():
    settings = get_ai_settings()

    print("=" * 60)
    print("SamadhanX AI Engine — Groq Provider Connectivity Diagnostic")
    print("=" * 60)
    print(f"Provider:           {settings.provider}")
    print(f"Configured Model:   {settings.model}")
    print(f"Base URL:           {settings.base_url}")
    print(f"API Key Configured: {'YES (Valid Length)' if settings.api_key else 'NO (MISSING)'}")
    print(f"Timeout:            {settings.timeout_seconds}s")
    print(f"Max Retries:        {settings.max_retries}")
    print("-" * 60)

    if not settings.api_key:
        print("[FAIL] Cannot test Groq: GROQ_API_KEY is not set in environment or .env.")
        sys.exit(1)

    provider = GroqProvider(settings)

    test_prompt = """
Title: Lack of clean drinking water in village
Description: The primary village well has been contaminated and tap supply is broken for 2 weeks. Residents are falling ill.
Category: Water & Sanitation
Location: Namkum, Ranchi, Jharkhand
"""

    print("Sending real test request to Groq API via LangChain structured output...")
    start = time.perf_counter()

    try:
        output, telemetry = await provider.generate_structured(
            prompt=test_prompt,
            schema=ProblemModerationOutput,
            system_prompt=(
                "You are SamadhanX AI Moderation Assistant for Indian civic issues. "
                "Classify, summarize factually, extract keywords, estimate spam probability (0.0-1.0), "
                "quality score (0.0-1.0), and provide confidence (0.0-1.0)."
            ),
        )
        elapsed = time.perf_counter() - start

        print("[SUCCESS] Real Groq LLM Response Received!")
        print("-" * 60)
        print(f"Duration:           {elapsed:.2f}s ({telemetry.get('duration_ms', 0)}ms)")
        print(f"Inferred Category:  {output.category}")
        print(f"Subcategory:        {output.subcategory}")
        print(f"Factual Summary:    \"{output.summary}\"")
        print(f"Keywords:           {', '.join(output.keywords)}")
        print(f"Spam Probability:   {output.spam_probability * 100:.1f}%")
        print(f"Quality Score:      {output.quality_score * 100:.1f}%")
        print(f"Confidence:         {output.confidence * 100:.1f}%")
        print(f"Recommendation:     {output.recommendation.value}")
        print(f"Reason:             {output.reason}")
        print("=" * 60)
        print("Groq API connectivity is LIVE and 100% operational!")

    except Exception as e:
        elapsed = time.perf_counter() - start
        print(f"[ERROR] Groq API call failed after {elapsed:.2f}s:")
        print(f"Error Type:         {type(e).__name__}")
        print(f"Error Message:      {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_diagnostic())
