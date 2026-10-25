"""Spam assessment service combining deterministic heuristic rules and LLM scoring."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.schemas.common import RiskFlag, RiskFlagType, RiskSeverity

logger = logging.getLogger("samadhanx.ai.services.spam")

# Common commercial / spam heuristic keywords
COMMERCIAL_PATTERNS = [
    r"\b(buy now|discount|crypto|forex|casino|slot machine|betting|viagra|cialis)\b",
    r"\b(click here|free money|earn \$\d+|work from home guarantee|whatsapp group link)\b",
    r"\b(seo services|digital marketing services|guest post|backlinks)\b",
    r"(http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+)",
    r"\b(call now:?\s*\+?\d{10,})\b",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in COMMERCIAL_PATTERNS]


class SpamService:
    """Service to evaluate spam and commercial abuse in problem submissions."""

    def __init__(self):
        self.settings = get_ai_settings()

    def evaluate_heuristics(self, title: str, description: str) -> tuple[float, list[str], list[RiskFlag]]:
        """Run fast regex and deterministic checks before/alongside LLM.

        Returns:
            Tuple of (heuristic_spam_score, reasons, risk_flags)
        """
        combined = f"{title}\n{description}"
        reasons: list[str] = []
        risk_flags: list[RiskFlag] = []
        score = 0.0

        # Check for repetitive characters (e.g., aaaaaaaa, !!!!!!!!)
        if re.search(r"(.)\1{9,}", combined):
            score += 0.4
            reasons.append("Excessive repetitive characters detected.")
            risk_flags.append(
                RiskFlag(
                    type=RiskFlagType.LOW_QUALITY,
                    severity=RiskSeverity.LOW,
                    reason="Excessive character repetition",
                )
            )

        # Check commercial patterns & URLs
        url_matches = re.findall(r"https?://\S+", combined)
        if url_matches:
            score += 0.35
            reasons.append(f"External links detected ({len(url_matches)} link(s)).")
            risk_flags.append(
                RiskFlag(
                    type=RiskFlagType.SUSPICIOUS_LINKS,
                    severity=RiskSeverity.MEDIUM,
                    reason="Submission contains external web URLs.",
                )
            )

        # Commercial keyword hits
        keyword_hits = 0
        for pattern in COMPILED_PATTERNS[:3]:
            if pattern.search(combined):
                keyword_hits += 1

        if keyword_hits > 0:
            score += 0.3 * keyword_hits
            reasons.append("Commercial/promotional keyword patterns detected.")
            risk_flags.append(
                RiskFlag(
                    type=RiskFlagType.COMMERCIAL_ADVERTISING,
                    severity=RiskSeverity.HIGH,
                    reason="Commercial advertisement terminology found.",
                )
            )

        final_score = min(1.0, score)
        return final_score, reasons, risk_flags

    def combine_scores(
        self,
        heuristic_score: float,
        model_score: float,
        heuristic_reasons: list[str],
        model_reasons: list[str],
    ) -> tuple[float, list[str]]:
        """Combine heuristic score with LLM output score."""
        # Weighted ensemble: heuristic carries 40% weight, LLM carries 60%
        # If either strongly flags (> 0.8), take the max to be conservative
        if heuristic_score > 0.8 or model_score > 0.8:
            combined_score = max(heuristic_score, model_score)
        else:
            combined_score = (heuristic_score * 0.4) + (model_score * 0.6)

        combined_reasons = list(dict.fromkeys(heuristic_reasons + model_reasons))
        return round(min(1.0, max(0.0, combined_score)), 3), combined_reasons
