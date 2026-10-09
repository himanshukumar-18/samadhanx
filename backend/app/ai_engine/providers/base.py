"""Abstract base class for AI model providers."""

from abc import ABC, abstractmethod
from typing import Any, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ModelProvider(ABC):
    """Abstract interface defining required capabilities for any LLM provider."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider backend (e.g. 'openai', 'fake')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Configured model identifier (e.g. 'gpt-4o-mini')."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        system_prompt: str | None = None,
    ) -> tuple[T, dict[str, Any]]:
        """Generate structured output adhering strictly to the provided Pydantic schema.
        
        Returns:
            Tuple of (parsed_output_model, telemetry_metadata_dict)
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Perform a quick health and connectivity check on the provider."""
        pass
