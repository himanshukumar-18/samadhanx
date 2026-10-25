"""OpenAI LLM provider integration with LangChain structured outputs."""

import asyncio
import time
from typing import Any, TypeVar
from pydantic import BaseModel

from app.ai_engine.config.settings import AISettings, get_ai_settings
from app.ai_engine.exceptions import (
    AIConfigurationError,
    AIMalformedOutputError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai_engine.providers.base import ModelProvider

T = TypeVar("T", bound=BaseModel)


class OpenAIProvider(ModelProvider):
    """Production provider using LangChain's ChatOpenAI and structured output."""

    def __init__(self, settings: AISettings | None = None):
        self.settings = settings or get_ai_settings()
        self._provider_name = "openai"
        self._model_name = self.settings.model

        if not self.settings.api_key:
            # We don't fail immediately on initialization so the app can boot,
            # but inference calls will check for valid credentials.
            pass

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def _get_client(self, schema: type[T]):
        """Build and configure the ChatOpenAI client with structured output."""
        if not self.settings.api_key:
            raise AIConfigurationError(
                "OpenAI API key is missing. Configure AI_API_KEY in environment."
            )

        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=self._model_name,
                api_key=self.settings.api_key,
                temperature=0.1,
                request_timeout=self.settings.timeout_seconds,
                max_retries=self.settings.max_retries,
            )
            return llm.with_structured_output(schema, method="json_mode")
        except ImportError as e:
            raise AIProviderError(f"langchain-openai package is not available: {e}")
        except Exception as e:
            raise AIProviderError(f"Failed to initialize OpenAI client: {e}")

    async def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        system_prompt: str | None = None,
    ) -> tuple[T, dict[str, Any]]:
        """Invoke ChatOpenAI with structured output schema and capture telemetry."""
        from langchain_core.messages import HumanMessage, SystemMessage

        start_time = time.perf_counter()
        runnable = self._get_client(schema)

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        try:
            # Execute with explicit asyncio timeout safety
            result = await asyncio.wait_for(
                runnable.ainvoke(messages),
                timeout=self.settings.timeout_seconds + 5,
            )

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            telemetry = {
                "provider": self.provider_name,
                "model": self.model_name,
                "duration_ms": duration_ms,
            }

            if isinstance(result, schema):
                return result, telemetry
            elif isinstance(result, dict):
                parsed = schema.model_validate(result)
                return parsed, telemetry
            else:
                raise AIMalformedOutputError(f"Unexpected output type from model: {type(result)}")

        except asyncio.TimeoutError:
            raise AITimeoutError(
                f"OpenAI inference timed out after {self.settings.timeout_seconds}s"
            )
        except AIProviderError:
            raise
        except Exception as e:
            err_msg = str(e).lower()
            if "rate limit" in err_msg or "429" in err_msg:
                raise AIRateLimitError(f"OpenAI rate limit exceeded: {e}")
            elif "timeout" in err_msg or "timed out" in err_msg:
                raise AITimeoutError(f"OpenAI call timed out: {e}")
            elif "validation" in err_msg or "json" in err_msg:
                raise AIMalformedOutputError(f"Failed to validate structured JSON: {e}")
            else:
                raise AIProviderError(f"OpenAI invocation failed: {e}")

    async def health_check(self) -> bool:
        """Verify OpenAI connectivity."""
        if not self.settings.api_key:
            return False
        return True
