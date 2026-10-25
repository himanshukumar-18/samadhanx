"""LangChain moderation runnable integrating prompt templates and provider structured output."""

from typing import Any
from app.ai_engine.prompts.moderation import (
    SYSTEM_MODERATION_PROMPT,
    USER_MODERATION_PROMPT_TEMPLATE,
)
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.schemas.moderation import ProblemModerationOutput


class ModerationChain:
    """Executes structured moderation analysis against a configured model provider."""

    def __init__(self, provider: ModelProvider):
        self.provider = provider

    async def ainvoke(self, wrapped_untrusted_data: str) -> tuple[ProblemModerationOutput, dict[str, Any]]:
        """Format the prompt, invoke the provider with structured schema, and return parsed output with telemetry."""
        user_prompt = USER_MODERATION_PROMPT_TEMPLATE.format(wrapped_data=wrapped_untrusted_data)

        output, telemetry = await self.provider.generate_structured(
            prompt=user_prompt,
            schema=ProblemModerationOutput,
            system_prompt=SYSTEM_MODERATION_PROMPT,
        )

        return output, telemetry
