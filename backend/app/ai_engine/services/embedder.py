"""Embedder service for multilingual problem vector embeddings.

Generates dense vector embeddings using fastembed (ONNX runtime — no PyTorch
dependency) for Hindi, English, and Hinglish problem text.

Model: paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
fastembed downloads the ONNX model at first use (~90 MB, cached to disk).
Provides safe fallbacks and thread-safe lazy loading.
"""

import hashlib
import logging
import re
import threading
from typing import Any

from app.ai_engine.exceptions import AIProviderError
from app.core.config import settings

logger = logging.getLogger("samadhanx.ai.embedder")


class EmbedderService:
    """Thread-safe embedder service with lazy model loading and batch encoding."""

    _model: Any = None
    _lock = threading.Lock()
    _init_attempted: bool = False

    @classmethod
    def _load_model(cls) -> Any:
        if cls._model is not None:
            return cls._model

        with cls._lock:
            if cls._model is not None:
                return cls._model
            try:
                from fastembed import TextEmbedding  # type: ignore[import]

                model_name = getattr(settings, "EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
                if not model_name.startswith("sentence-transformers/") and "paraphrase-multilingual" in model_name:
                    model_name = f"sentence-transformers/{model_name}"
                logger.info(f"Loading fastembed multilingual model: {model_name}")
                cls._model = TextEmbedding(model_name=model_name)
                cls._init_attempted = True
                return cls._model
            except Exception as exc:
                cls._init_attempted = True
                logger.warning(f"Failed to load fastembed model: {exc}")
                raise AIProviderError(
                    f"Fastembed model failed to load: {exc}",
                    details={"model": getattr(settings, "EMBEDDING_MODEL", "unknown")},
                ) from exc

    @classmethod
    def is_available(cls) -> bool:
        """Check if embedding service is currently usable."""
        try:
            cls._load_model()
            return True
        except Exception:
            return False

    @staticmethod
    def normalize_text(title: str, description: str, max_len: int = 2000) -> str:
        """Normalize title and description by collapsing whitespace and capping length."""
        clean_title = re.sub(r"\s+", " ", (title or "")).strip()
        clean_desc = re.sub(r"\s+", " ", (description or "")).strip()
        combined = f"{clean_title.rstrip('.')}. {clean_desc}".strip()
        if len(combined) > max_len:
            combined = combined[:max_len].rsplit(" ", 1)[0]
        return combined

    @staticmethod
    def compute_hash(text: str) -> str:
        """Generate SHA-256 hash of normalized text for cache invalidation."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @classmethod
    def get_embedding(cls, text: str) -> list[float]:
        """Generate a normalized embedding vector for a single string."""
        if not text:
            raise AIProviderError("Cannot generate embedding for empty text")

        model = cls._load_model()
        try:
            # fastembed returns a generator of numpy arrays; take the first element
            vec = list(model.embed([text]))[0]
            return vec.tolist()
        except Exception as exc:
            logger.error(f"Error encoding embedding: {exc}")
            raise AIProviderError(f"Embedding encoding failed: {exc}") from exc

    @classmethod
    def get_embeddings_batch(cls, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        if not texts:
            return []

        model = cls._load_model()
        try:
            # fastembed.embed() is a generator — consume in one pass
            vecs = list(model.embed(texts))
            return [v.tolist() for v in vecs]
        except Exception as exc:
            logger.error(f"Batch embedding failed: {exc}")
            raise AIProviderError(f"Batch embedding encoding failed: {exc}") from exc
