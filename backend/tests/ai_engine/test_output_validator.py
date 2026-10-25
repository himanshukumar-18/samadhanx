"""Tests for OutputValidator and operational threshold enforcement."""

from app.models.enums import AIModerationRecommendation
from app.ai_engine.schemas.common import RiskFlag, RiskFlagType, RiskSeverity
from app.ai_engine.schemas.moderation import ProblemModerationOutput
from app.ai_engine.security.output_validator import OutputValidator


def test_output_validator_clean_submission():
    validator = OutputValidator()
    raw = ProblemModerationOutput(
        category="water supply",
        subcategory="Drinking Water Supply",
        summary="Low water pressure during peak morning hours.",
        keywords=["water", "pressure"],
        spam_probability=0.03,
        quality_score=0.85,
        confidence=0.92,
        risk_flags=[],
        recommendation=AIModerationRecommendation.NORMAL_REVIEW,
        reason="Actionable civic issue.",
    )

    validated = validator.validate_and_refine(raw)
    assert validated.category == "Water & Sanitation"
    assert validated.recommendation == AIModerationRecommendation.NORMAL_REVIEW


def test_output_validator_forces_spam_review():
    validator = OutputValidator()
    raw = ProblemModerationOutput(
        category="Other",
        summary="Buy crypto casino tokens now.",
        keywords=["casino", "crypto"],
        spam_probability=0.85,
        quality_score=0.1,
        confidence=0.9,
        risk_flags=[],
        recommendation=AIModerationRecommendation.NORMAL_REVIEW,  # LLM erroneously recommended normal review
        reason="Commercial spam",
    )

    validated = validator.validate_and_refine(raw)
    # Operational threshold override must force SPAM_REVIEW
    assert validated.recommendation == AIModerationRecommendation.SPAM_REVIEW
    assert "Automated Spam Flag" in validated.reason


def test_output_validator_forces_high_risk_escalation():
    validator = OutputValidator()
    raw = ProblemModerationOutput(
        category="Public Safety",
        summary="Abusive attack submission.",
        keywords=["threat"],
        spam_probability=0.1,
        quality_score=0.5,
        confidence=0.88,
        risk_flags=[
            RiskFlag(
                type=RiskFlagType.PROMPT_INJECTION,
                severity=RiskSeverity.HIGH,
                reason="Prompt injection detected",
            )
        ],
        recommendation=AIModerationRecommendation.NORMAL_REVIEW,
        reason="Review needed",
    )

    validated = validator.validate_and_refine(raw)
    assert validated.recommendation == AIModerationRecommendation.HIGH_RISK_ESCALATION
    assert "Automated Escalation" in validated.reason


def test_output_validator_forces_human_review_on_low_confidence():
    validator = OutputValidator()
    raw = ProblemModerationOutput(
        category="Other",
        summary="Ambiguous description with minimal details.",
        keywords=["vague"],
        spam_probability=0.1,
        quality_score=0.4,
        confidence=0.45,  # Low confidence (< 0.70 threshold)
        risk_flags=[],
        recommendation=AIModerationRecommendation.NORMAL_REVIEW,
        reason="Review needed",
    )

    validated = validator.validate_and_refine(raw)
    assert validated.recommendation == AIModerationRecommendation.HUMAN_REVIEW_REQUIRED
    assert "Human Review Required" in validated.reason
