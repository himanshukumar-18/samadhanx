"""Test verifying that AI Moderation produces dynamic, distinct, non-mock results for different civic problems."""

import pytest
from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.providers.groq import GroqProvider
from app.ai_engine.schemas.moderation import ProblemModerationOutput
from app.ai_engine.prompts.moderation import SYSTEM_MODERATION_PROMPT, USER_MODERATION_PROMPT_TEMPLATE


@pytest.mark.asyncio
async def test_distinct_problems_produce_distinct_ai_analyses():
    """Verify that different problem descriptions produce completely distinct summaries and categories."""
    settings = get_ai_settings()
    if not settings.api_key:
        pytest.skip("GROQ_API_KEY not configured; skipping live Groq test.")

    provider = GroqProvider(settings)

    problems = [
        {
            "title": "Severe Water Logging in Lower Bazar Road",
            "description": "After 1 hour of rain, the entire lower bazar road gets submerged under 2 feet of dirty drain water.",
            "category": "Water & Sanitation",
            "location": "Lower Bazar, Ranchi",
        },
        {
            "title": "Frequent Power Outages in Industrial Area Phase 2",
            "description": "Daily 6 to 8 hours unscheduled load shedding is ruining small machinery workshops and manufacturing units.",
            "category": "Clean Energy & Solar",
            "location": "Tatisilwai Industrial Area, Ranchi",
        },
    ]

    results = []
    for p in problems:
        wrapped = f"""<UNTRUSTED_SUBMISSION_DATA>
<PROPOSED_CATEGORY>{p['category']}</PROPOSED_CATEGORY>
<LOCATION>{p['location']}</LOCATION>
<TITLE>{p['title']}</TITLE>
<DESCRIPTION>{p['description']}</DESCRIPTION>
</UNTRUSTED_SUBMISSION_DATA>"""

        out, telemetry = await provider.generate_structured(
            prompt=USER_MODERATION_PROMPT_TEMPLATE.format(wrapped_data=wrapped),
            schema=ProblemModerationOutput,
            system_prompt=SYSTEM_MODERATION_PROMPT,
        )
        results.append(out)

    assert results[0].summary != results[1].summary, "AI summaries for different problems must not be identical!"
    assert results[0].category != results[1].category, "AI categories for different problems must be properly assigned!"
    assert results[0].summary != "", "Summary must not be empty"
    assert results[1].summary != "", "Summary must not be empty"
    assert "fake" not in results[0].summary.lower()
