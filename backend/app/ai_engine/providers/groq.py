"""Groq LLM provider implementation for SamadhanX AI Engine.

Connects to Groq's high-speed OpenAI-compatible API endpoint with LangChain structured output,
dynamic environment configuration, exponential backoff for 429 rate limits, and safe telemetry.
"""

import asyncio
import logging
import re
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

logger = logging.getLogger("samadhanx.ai.provider.groq")
T = TypeVar("T", bound=BaseModel)


class GroqProvider(ModelProvider):
    """Production provider connecting to Groq via LangChain's OpenAI-compatible interface."""

    def __init__(self, settings: AISettings | None = None):
        self.settings = settings or get_ai_settings()
        self._provider_name = "groq"
        self._model_name = self.settings.model

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def _get_api_key(self) -> str:
        from app.core.config import settings as app_settings
        key = app_settings.effective_ai_api_key or self.settings.api_key or ""
        k = key.strip()
        while (k.startswith('"') and k.endswith('"')) or (k.startswith("'") and k.endswith("'")):
            k = k[1:-1].strip()
        if k.lower().startswith("bearer "):
            k = k[7:].strip()
            while (k.startswith('"') and k.endswith('"')) or (k.startswith("'") and k.endswith("'")):
                k = k[1:-1].strip()
        if not k or "your_" in k.lower():
            raise AIConfigurationError(
                "Groq API key is missing. Set GROQ_API_KEY in environment or .env.",
                code="AI_CONFIG_ERROR",
            )
        return k

    async def _invoke_via_langchain(self, schema: type[T], messages: list, api_key: str) -> Any:
        """Invoke via LangChain ChatOpenAI interface with clean headers."""
        from langchain_openai import ChatOpenAI
        base_url = str(self.settings.base_url).rstrip("/")
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"

        llm = ChatOpenAI(
            model=self.settings.model,
            api_key=api_key,
            base_url=base_url,
            temperature=self.settings.temperature,
            max_tokens=self.settings.max_output_tokens,
            request_timeout=self.settings.timeout_seconds,
            max_retries=self.settings.max_retries,
        )
        try:
            runnable = llm.with_structured_output(schema)
            return await runnable.ainvoke(messages)
        except Exception:
            runnable = llm.with_structured_output(schema, method="json_mode")
            return await runnable.ainvoke(messages)

    async def _invoke_via_native_groq(self, schema: type[T], sys_content: str, prompt: str, api_key: str) -> T:
        """Fallback invocation using official native groq SDK."""
        import json
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model=self.settings.model,
            messages=[
                {"role": "system", "content": sys_content},
                {"role": "user", "content": prompt},
            ],
            temperature=self.settings.temperature,
            max_tokens=self.settings.max_output_tokens,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            raise AIMalformedOutputError("Groq returned empty completion content.")
        data = json.loads(content)
        return schema.model_validate(data)

    def _extract_retry_after(self, err_text: str) -> float | None:
        """Extract retry-after seconds from error message if available."""
        match = re.search(r"retry after ([0-9]+(?:\.[0-9]+)?)", err_text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        match_secs = re.search(r"([0-9]+)s", err_text)
        if match_secs:
            try:
                return float(match_secs.group(1))
            except ValueError:
                pass
        return None

    async def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        system_prompt: str | None = None,
    ) -> tuple[T, dict[str, Any]]:
        """Invoke Groq with structured schema, telemetry, and rate-limit backoff."""
        from langchain_core.messages import HumanMessage, SystemMessage

        start_time = time.perf_counter()
        api_key = self._get_api_key()

        sys_content = system_prompt or "You are an AI assistant. Return your response in JSON format."
        if "json" not in sys_content.lower():
            sys_content += "\nRespond strictly with a valid JSON object adhering to the schema."

        messages = [
            SystemMessage(content=sys_content),
            HumanMessage(content=prompt),
        ]

        max_attempts = max(1, self.settings.max_retries + 1)
        last_exception: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            try:
                # Primary execution: LangChain ChatOpenAI interface
                try:
                    result = await asyncio.wait_for(
                        self._invoke_via_langchain(schema, messages, api_key),
                        timeout=self.settings.timeout_seconds + 5,
                    )
                except Exception as lc_err:
                    err_str = str(lc_err).lower()
                    if "401" in err_str or "invalid" in err_str or "auth" in err_str:
                        # Attempt native Groq SDK before raising
                        logger.warning(f"LangChain invocation had auth/header issue ({lc_err}). Retrying via native Groq SDK...")
                        result = await asyncio.wait_for(
                            self._invoke_via_native_groq(schema, sys_content, prompt, api_key),
                            timeout=self.settings.timeout_seconds + 5,
                        )
                    else:
                        raise

                duration_ms = int((time.perf_counter() - start_time) * 1000)
                telemetry = {
                    "provider": self.provider_name,
                    "model": self.model_name,
                    "duration_ms": duration_ms,
                    "attempts": attempt,
                }

                if isinstance(result, schema):
                    return result, telemetry
                elif isinstance(result, dict):
                    parsed = schema.model_validate(result)
                    return parsed, telemetry
                else:
                    raise AIMalformedOutputError(f"Unexpected output type from model: {type(result)}")

            except asyncio.TimeoutError as e:
                last_exception = AITimeoutError(
                    f"Groq inference timed out after {self.settings.timeout_seconds}s (attempt {attempt}/{max_attempts})"
                )
                if attempt < max_attempts:
                    await asyncio.sleep(1.0 * attempt)
                    continue
                raise last_exception

            except Exception as e:
                err_lower = str(e).lower()
                is_rate_limit = (
                    "rate limit" in err_lower
                    or "429" in err_lower
                    or "tokens per minute" in err_lower
                    or "tpm" in err_lower
                    or "rpm" in err_lower
                )

                if is_rate_limit:
                    retry_seconds = self._extract_retry_after(str(e)) or (1.5 * (2 ** (attempt - 1)))
                    # Cap retry wait to avoid hanging tasks
                    retry_seconds = min(retry_seconds, 10.0)
                    logger.warning(
                        f"[GROQ RATE LIMIT] 429 received on attempt {attempt}/{max_attempts}. "
                        f"Backing off for {retry_seconds:.1f}s."
                    )
                    last_exception = AIRateLimitError(
                        f"Groq rate limit exceeded (429): {e}"
                    )
                    if attempt < max_attempts:
                        await asyncio.sleep(retry_seconds)
                        continue
                    raise last_exception

                elif "timeout" in err_lower or "timed out" in err_lower:
                    last_exception = AITimeoutError(f"Groq call timed out: {e}")
                    if attempt < max_attempts:
                        await asyncio.sleep(1.0 * attempt)
                        continue
                    raise last_exception

                elif "validation" in err_lower or "json" in err_lower:
                    raise AIMalformedOutputError(f"Failed to validate structured JSON from Groq: {e}")

                elif "invalid api key" in err_lower or "invalid_api_key" in err_lower or "401" in err_lower or "unauthorized" in err_lower:
                    raise AIConfigurationError(
                        "Groq API key is invalid or unauthorized (HTTP 401). Please check GROQ_API_KEY in your environment or .env file.",
                        code="INVALID_API_KEY",
                    )

                elif isinstance(e, AIConfigurationError):
                    raise

                else:
                    raise AIProviderError(f"Groq invocation failed: {e}")

        if last_exception:
            raise last_exception
        raise AIProviderError("Groq invocation completed without returning a result.")

    async def health_check(self) -> bool:
        """Verify that provider is configured with credentials."""
        try:
            key = self._get_api_key()
            return bool(key and self.settings.base_url)
        except Exception:
            return False
