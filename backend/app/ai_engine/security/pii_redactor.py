"""PII (Personally Identifiable Information) minimization and redaction."""

import re
from app.ai_engine.schemas.common import RiskFlag, RiskFlagType, RiskSeverity

# Email regex pattern
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

# Phone number regex patterns (Indian mobile numbers, international formats)
PHONE_PATTERN = re.compile(r"(?:\+91[\-\s]?)?[6-9]\d{9}\b")

# Indian Aadhaar pattern (12 digits with or without spaces/dashes)
AADHAAR_PATTERN = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")

# PAN card pattern (5 letters, 4 numbers, 1 letter)
PAN_PATTERN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")


class PIIRedactor:
    """Redacts sensitive PII from text before passing it to LLM inference."""

    @staticmethod
    def redact(text: str) -> tuple[str, list[RiskFlag]]:
        """Redact phone numbers, emails, Aadhaar, PAN and flag PII exposure."""
        if not text:
            return "", []

        flags: list[RiskFlag] = []
        redacted = text
        pii_found = False

        if EMAIL_PATTERN.search(redacted):
            redacted = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", redacted)
            pii_found = True

        if PHONE_PATTERN.search(redacted):
            redacted = PHONE_PATTERN.sub("[REDACTED_PHONE]", redacted)
            pii_found = True

        if AADHAAR_PATTERN.search(redacted):
            redacted = AADHAAR_PATTERN.sub("[REDACTED_GOV_ID]", redacted)
            pii_found = True

        if PAN_PATTERN.search(redacted):
            redacted = PAN_PATTERN.sub("[REDACTED_PAN]", redacted)
            pii_found = True

        if pii_found:
            flags.append(
                RiskFlag(
                    type=RiskFlagType.PII_EXPOSURE,
                    severity=RiskSeverity.LOW,
                    reason="Submission contains contact details (phone, email, or government ID) which were sanitized.",
                )
            )

        return redacted, flags
