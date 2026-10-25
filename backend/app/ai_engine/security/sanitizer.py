"""Input sanitization and normalization for untrusted citizen submissions."""

import html
import re
from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.exceptions import AIInputTooLargeError

# Regex to strip HTML/XML tags
TAG_RE = re.compile(r"<[^>]+>")
# Regex to normalize whitespace
WHITESPACE_RE = re.compile(r"[\r\n\t]+")
MULTI_SPACE_RE = re.compile(r" {2,}")
# Control characters excluding standard newlines and tabs
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


class InputSanitizer:
    """Sanitizes text inputs before LLM processing."""

    def __init__(self, max_length: int | None = None):
        self.max_length = max_length or get_ai_settings().max_input_length

    def sanitize(self, text: str | None, max_length_override: int | None = None) -> str:
        """Sanitize raw text by stripping markup, control chars, and normalizing whitespace."""
        if not text:
            return ""

        # Decode HTML entities
        cleaned = html.unescape(text)

        # Strip HTML tags
        cleaned = TAG_RE.sub(" ", cleaned)

        # Remove control characters
        cleaned = CONTROL_CHAR_RE.sub("", cleaned)

        # Normalize line endings and whitespace
        cleaned = WHITESPACE_RE.sub("\n", cleaned)
        cleaned = MULTI_SPACE_RE.sub(" ", cleaned).strip()

        # Check and enforce length limits
        limit = max_length_override or self.max_length
        if len(cleaned) > limit:
            # Truncate at word boundary
            truncated = cleaned[:limit]
            last_space = truncated.rfind(" ")
            if last_space > int(limit * 0.8):
                cleaned = truncated[:last_space] + " ...[truncated]"
            else:
                cleaned = truncated + " ...[truncated]"

        return cleaned
