import secrets
from typing import Final

# Token generation helpers for foundation
DEFAULT_KEY_LENGTH: Final[int] = 32


def generate_secure_token(length: int = DEFAULT_KEY_LENGTH) -> str:
    """Generate a cryptographically strong random token."""
    return secrets.token_urlsafe(length)
