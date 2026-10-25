"""Strict output validation, taxonomy compliance, and decision thresholding."""

from app.models.enums import AIModerationRecommendation
from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.schemas.categorization import normalize_category, normalize_subcategory
from app.ai_engine.schemas.common import RiskFlag, RiskSeverity
from app.ai_engine.schemas.moderation import ProblemModerationOutput


class OutputValidator:
    """Validates and enforces guardrails and operational thresholds on model output."""

    def __init__(self):
        self.settings = get_ai_settings()

    def validate_and_refine(
        self,
        output: ProblemModerationOutput,
        injected_flags: list[RiskFlag] | None = None,
    ) -> ProblemModerationOutput:
        """Enforce taxonomy, bounds, thresholds, and synthesize flags."""
        # 1. Enforce canonical category & subcategory
        clean_category = normalize_category(output.category)
        clean_subcategory = normalize_subcategory(clean_category, output.subcategory)

        # 2. Clamp probability & confidence bounds
        spam_prob = max(0.0, min(1.0, float(output.spam_probability)))
        confidence = max(0.0, min(1.0, float(output.confidence)))
        quality_score = max(0.0, min(1.0, float(output.quality_score)))

        # 3. Consolidate risk flags
        all_flags: list[RiskFlag] = list(output.risk_flags or [])
        if injected_flags:
            all_flags.extend(injected_flags)

        # 4. Enforce Operational Threshold Overrides
        recommendation = output.recommendation
        reason = output.reason

        has_critical_or_high_risk = any(
            f.severity in (RiskSeverity.CRITICAL, RiskSeverity.HIGH) for f in all_flags
        )

        if has_critical_or_high_risk:
            recommendation = AIModerationRecommendation.HIGH_RISK_ESCALATION
            reason = f"Automated Escalation: High-risk flags identified ({', '.join(f.type.value for f in all_flags if f.severity in (RiskSeverity.CRITICAL, RiskSeverity.HIGH))})."
        elif spam_prob >= self.settings.spam_review_threshold:
            recommendation = AIModerationRecommendation.SPAM_REVIEW
            reason = f"Automated Spam Flag: Spam probability of {int(spam_prob * 100)}% exceeds operational threshold ({int(self.settings.spam_review_threshold * 100)}%)."
        elif confidence < self.settings.confidence_threshold:
            recommendation = AIModerationRecommendation.HUMAN_REVIEW_REQUIRED
            reason = f"Human Review Required: Model confidence ({int(confidence * 100)}%) is below minimum decision threshold ({int(self.settings.confidence_threshold * 100)}%)."

        # 5. Clean summary length
        summary = (output.summary or "").strip()
        if len(summary) > 280:
            summary = summary[:277] + "..."

        return ProblemModerationOutput(
            category=clean_category,
            subcategory=clean_subcategory,
            summary=summary,
            keywords=output.keywords,
            spam_probability=round(spam_prob, 3),
            spam_reasons=output.spam_reasons,
            quality_score=round(quality_score, 3),
            confidence=round(confidence, 3),
            risk_flags=all_flags,
            recommendation=recommendation,
            reason=reason,
        )
