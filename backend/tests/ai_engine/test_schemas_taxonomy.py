"""Tests for canonical categorization taxonomy and structured schemas."""

from app.models.enums import AIModerationRecommendation
from app.ai_engine.schemas.categorization import (
    CANONICAL_CATEGORIES,
    normalize_category,
    normalize_subcategory,
)
from app.ai_engine.schemas.moderation import ProblemModerationOutput


def test_normalize_category_canonical_mapping():
    assert normalize_category("Water & Sanitation") == "Water & Sanitation"
    assert normalize_category("water supply") == "Water & Sanitation"
    assert normalize_category("drainage overflow") == "Water & Sanitation"
    assert normalize_category("solar panel failure") == "Clean Energy & Solar"
    assert normalize_category("garbage dumps") == "Waste Management"
    assert normalize_category("crop disease") == "Agriculture & Rural Tech"
    assert normalize_category("hospital ambulance") == "Healthcare & Medical Devices"
    assert normalize_category("potholes on highway") == "Smart Infrastructure & Roads"
    assert normalize_category("unknown random topic") == "Other"
    assert normalize_category(None) == "Other"


def test_normalize_subcategory_mapping():
    assert normalize_subcategory("Water & Sanitation", "Drinking Water Supply") == "Drinking Water Supply"
    assert normalize_subcategory("Water & Sanitation", "drainage") == "Drainage & Sewage"
    assert normalize_subcategory("Clean Energy & Solar", "Solar Streetlights") == "Solar Streetlights"
    assert normalize_subcategory("Clean Energy & Solar", "nonexistent subcategory") == "Other"


def test_problem_moderation_output_keyword_cleaning():
    output = ProblemModerationOutput(
        category="Water & Sanitation",
        subcategory="Drinking Water Supply",
        summary="Water pipeline leak in municipal ward.",
        keywords=["  WATER  ", "water", "LEAK", "pipe", "a", "1", "clean"],
        spam_probability=0.05,
        confidence=0.9,
        recommendation=AIModerationRecommendation.NORMAL_REVIEW,
        reason="Clear civic submission.",
    )

    # Keywords should be lowercase, deduplicated, and single-char tags filtered out
    assert "water" in output.keywords
    assert output.keywords.count("water") == 1
    assert "leak" in output.keywords
    assert "pipe" in output.keywords
    assert "a" not in output.keywords
