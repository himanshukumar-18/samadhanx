"""Factory function to instantiate the active model provider."""

import logging
from app.ai_engine.config.settings import AISettings, get_ai_settings
from app.ai_engine.exceptions import AIConfigurationError
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.groq import GroqProvider
from app.ai_engine.providers.openai import OpenAIProvider

logger = logging.getLogger("samadhanx.ai_engine.factory")


def get_model_provider(settings: AISettings | None = None) -> ModelProvider:
    """Instantiate and return the configured ModelProvider implementation.

    Strictly routes to the configured provider (Groq or OpenAI).
    Never silently falls back to a mock or fake provider in production.
    """
    cfg = settings or get_ai_settings()
    provider_type = cfg.provider.lower().strip()

    if provider_type == "groq":
        return GroqProvider(cfg)
    elif provider_type == "openai":
        return OpenAIProvider(cfg)
    elif provider_type == "fake":
        # Only if explicitly configured via AI_PROVIDER=fake (e.g. for offline test harnesses)
        from app.ai_engine.providers.fake import FakeAIProvider
        return FakeAIProvider()
    else:
        raise AIConfigurationError(
            f"Unsupported AI provider: '{provider_type}'. Supported: 'groq', 'openai'."
        )


