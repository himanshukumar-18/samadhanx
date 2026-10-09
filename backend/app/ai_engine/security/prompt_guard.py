"""Prompt injection defense and untrusted content sandboxing."""

import re
from app.ai_engine.schemas.common import RiskFlag, RiskFlagType, RiskSeverity

# High-risk prompt injection heuristics
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior|system)\s+instructions",
    r"you\s+are\s+now\s+in\s+developer\s+mode",
    r"system\s+override",
    r"switch\s+to\s+(dan|unrestricted)\s+mode",
    r"bypass\s+(safety|content)\s+filters",
    r"output\s+only\s+the\s+following\s+json",
    r"mark\s+this\s+(problem\s+)?as\s+approved",
    r"set\s+recommendation\s+to\s+approve",
    r"ignore\s+your\s+instructions\s+and",
    r"as\s+an\s+ai\s+without\s+rules",
]

INJECTION_REGEX = re.compile("|".join(PROMPT_INJECTION_PATTERNS), re.IGNORECASE)


class PromptGuard:
    """Detects prompt injection attempts and structures prompts securely."""

    @staticmethod
    def inspect_for_injection(text: str) -> list[RiskFlag]:
        """Check if submitted text matches prompt injection heuristics."""
        flags: list[RiskFlag] = []
        if not text:
            return flags

        matches = INJECTION_REGEX.findall(text)
        if matches:
            flags.append(
                RiskFlag(
                    type=RiskFlagType.PROMPT_INJECTION,
                    severity=RiskSeverity.HIGH,
                    reason="Suspicious instruction override or prompt injection pattern detected in submission text.",
                )
            )

        return flags

    @staticmethod
    def wrap_untrusted_data(title: str, description: str, category: str | None = None, location: str | None = None) -> str:
        """Enclose untrusted user input within strict XML data delimiters."""
        cat_str = category or "Not Provided"
        loc_str = location or "Not Provided"

        return f"""<UNTRUSTED_SUBMISSION_DATA>
<PROPOSED_CATEGORY>{cat_str}</PROPOSED_CATEGORY>
<LOCATION>{loc_str}</LOCATION>
<TITLE>{title}</TITLE>
<DESCRIPTION>
{description}
</DESCRIPTION>
</UNTRUSTED_SUBMISSION_DATA>"""
