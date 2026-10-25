"""Model metadata, token limits, and provider capabilities."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelSpecs:
    name: str
    max_tokens: int
    supports_structured_output: bool
    cost_per_1k_input_tokens: float
    cost_per_1k_output_tokens: float


SUPPORTED_MODELS: dict[str, ModelSpecs] = {
    "openai/gpt-oss-20b": ModelSpecs(
        name="openai/gpt-oss-20b",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0001,
        cost_per_1k_output_tokens=0.0002,
    ),
    "openai/gpt-oss-120b": ModelSpecs(
        name="openai/gpt-oss-120b",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0005,
        cost_per_1k_output_tokens=0.0008,
    ),
    "qwen/qwen3.8-27b": ModelSpecs(
        name="qwen/qwen3.8-27b",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0002,
        cost_per_1k_output_tokens=0.0003,
    ),
    "llama-3.3-70b-versatile": ModelSpecs(
        name="llama-3.3-70b-versatile",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.00059,
        cost_per_1k_output_tokens=0.00079,
    ),
    "llama-3.1-8b-instant": ModelSpecs(
        name="llama-3.1-8b-instant",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.00005,
        cost_per_1k_output_tokens=0.00008,
    ),
    "llama3-70b-8192": ModelSpecs(
        name="llama3-70b-8192",
        max_tokens=8192,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.00059,
        cost_per_1k_output_tokens=0.00079,
    ),
    "gpt-4o-mini": ModelSpecs(
        name="gpt-4o-mini",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.00015,
        cost_per_1k_output_tokens=0.0006,
    ),
    "gpt-4o": ModelSpecs(
        name="gpt-4o",
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0025,
        cost_per_1k_output_tokens=0.010,
    ),
    "fake-model": ModelSpecs(
        name="fake-model",
        max_tokens=4096,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0,
        cost_per_1k_output_tokens=0.0,
    ),
}


def get_model_specs(model_name: str) -> ModelSpecs:
    """Retrieve specs for model, providing dynamic defaults for custom or new models."""
    cleaned = model_name.strip()
    if cleaned in SUPPORTED_MODELS:
        return SUPPORTED_MODELS[cleaned]
    # Dynamic fallback to allow arbitrary configured models
    return ModelSpecs(
        name=cleaned,
        max_tokens=128000,
        supports_structured_output=True,
        cost_per_1k_input_tokens=0.0,
        cost_per_1k_output_tokens=0.0,
    )
