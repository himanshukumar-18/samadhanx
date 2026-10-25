"""AI Engine configuration adapter bridging the global application settings."""

from pydantic import BaseModel, Field
from app.core.config import settings as app_settings


class AISettings(BaseModel):
    """Encapsulated AI Engine runtime configuration loaded from environment."""

    enabled: bool = Field(default_factory=lambda: bool(app_settings.AI_ENABLED and app_settings.AI_MODERATION_ENABLED))
    provider: str = Field(default_factory=lambda: str(app_settings.AI_PROVIDER).lower().strip())
    api_key: str | None = Field(default_factory=lambda: app_settings.effective_ai_api_key)
    model: str = Field(default_factory=lambda: str(app_settings.effective_ai_model).strip())
    base_url: str = Field(default_factory=lambda: str(app_settings.AI_BASE_URL).strip())
    timeout_seconds: int = Field(default_factory=lambda: int(app_settings.AI_TIMEOUT_SECONDS))
    max_retries: int = Field(default_factory=lambda: int(app_settings.AI_MAX_RETRIES))
    max_input_length: int = Field(default_factory=lambda: int(app_settings.AI_MAX_INPUT_LENGTH))
    max_output_tokens: int = Field(default_factory=lambda: int(app_settings.AI_MAX_OUTPUT_TOKENS))
    temperature: float = Field(default_factory=lambda: float(app_settings.AI_TEMPERATURE))
    confidence_threshold: float = Field(default_factory=lambda: float(app_settings.AI_CONFIDENCE_THRESHOLD))
    spam_review_threshold: float = Field(default_factory=lambda: float(app_settings.AI_SPAM_REVIEW_THRESHOLD))
    high_risk_threshold: float = Field(default_factory=lambda: float(app_settings.AI_HIGH_RISK_THRESHOLD))
    manual_reanalysis_enabled: bool = Field(default_factory=lambda: bool(app_settings.AI_MANUAL_REANALYSIS_ENABLED))
    manual_reanalysis_cooldown: int = Field(default_factory=lambda: int(app_settings.AI_MANUAL_REANALYSIS_COOLDOWN_SECONDS))
    prompt_version: str = Field(default_factory=lambda: str(app_settings.AI_PROMPT_VERSION))
    cache_mode: str = Field(default_factory=lambda: str(getattr(app_settings, "AI_CACHE_MODE", "read_through")).lower().strip())
    debug: bool = Field(default_factory=lambda: bool(getattr(app_settings, "AI_DEBUG", True)))


def get_ai_settings() -> AISettings:
    """Retrieve current AI configuration snapshot."""
    return AISettings()
