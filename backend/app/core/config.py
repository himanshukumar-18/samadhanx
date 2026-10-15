import json
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings validated with Pydantic."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Project metadata
    PROJECT_NAME: str = "SamadhanX"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # Security
    SECRET_KEY: str = "samadhanx-dev-secret-key-do-not-use-in-production-min-32-chars"
    ALLOWED_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Database URLs
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/samadhanx"
    SYNC_DATABASE_URL: str | None = None

    # Redis URL
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery Configuration
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    # Logging & Limits
    LOG_LEVEL: str = "INFO"
    MAX_REQUEST_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # Media is persisted only after a successful Cloudinary upload.
    CLOUDINARY_URL: str | None = None

    # SMTP / Email Service Settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "noreply@samadhanx.in"
    EMAILS_FROM_NAME: str = "SamadhanX Community Platform"
    EMAILS_ENABLED: bool = False

    # AI Engine & Automation Layer Settings (Configurable entirely via environment)
    GROQ_API_KEY: str | None = None
    AI_ENABLED: bool = True
    AI_MODERATION_ENABLED: bool = True
    AI_DUPLICATES_ENABLED: bool = True
    AI_MATCHING_ENABLED: bool = True
    AI_IMPACT_ENABLED: bool = True
    AI_FACULTY_ENABLED: bool = True
    AI_ASSISTANT_ENABLED: bool = True
    AI_PROVIDER: str = "groq"  # options: "groq", "openai"
    AI_MODEL: str = "llama-3.3-70b-versatile"
    AI_BASE_URL: str = "https://api.groq.com/openai/v1"
    AI_API_KEY: str | None = None
    AI_TIMEOUT_SECONDS: int = 30
    AI_MAX_RETRIES: int = 2
    AI_MAX_INPUT_LENGTH: int = 6000
    AI_MAX_OUTPUT_TOKENS: int = 1200
    AI_TEMPERATURE: float = 0.0
    AI_CONFIDENCE_THRESHOLD: float = 0.70
    AI_SPAM_REVIEW_THRESHOLD: float = 0.80
    AI_HIGH_RISK_THRESHOLD: float = 0.70
    AI_MANUAL_REANALYSIS_ENABLED: bool = True
    AI_MANUAL_REANALYSIS_COOLDOWN_SECONDS: int = 60
    AI_PROMPT_VERSION: str = "v1"
    AI_CACHE_MODE: str = "read_through"  # options: "disabled", "read_through", "refresh"
    AI_DEBUG: bool = True

    # Duplicate Problem Detection Settings
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIM: int = 384
    DUPLICATE_HIGH_THRESHOLD: float = 0.90
    DUPLICATE_LOW_THRESHOLD: float = 0.75
    DUPLICATE_DETECTION_ENABLED: bool = True
    DUPLICATE_PRECHECK_TIMEOUT_SECONDS: int = 5
    AI_EMBEDDING_BATCH_SIZE: int = 32
    AI_DAILY_BUDGET_PER_USER: int = 100
    AI_DAILY_BUDGET_PER_FEATURE: int = 10000


    @property
    def effective_ai_api_key(self) -> str | None:
        """Resolve API key for active provider safely without exposing secrets.
        
        Handles:
        - Dynamic disk reload from .env if updated at runtime
        - Removal of accidental double/single quotes, whitespace, or 'Bearer ' prefix
        - Multi-path resolution (/app/.env, .env, backend/.env, ../.env)
        """
        import os

        def clean_key(raw: str | None) -> str | None:
            if not raw:
                return None
            k = raw.strip()
            # Strip outer matching quotes
            while (k.startswith('"') and k.endswith('"')) or (k.startswith("'") and k.endswith("'")):
                k = k[1:-1].strip()
            # Strip Bearer prefix if present
            if k.lower().startswith("bearer "):
                k = k[7:].strip()
                while (k.startswith('"') and k.endswith('"')) or (k.startswith("'") and k.endswith("'")):
                    k = k[1:-1].strip()
            return k if k else None

        # 1. Check disk .env files first to catch runtime updates without requiring full restart
        disk_key: str | None = None
        for env_path in ("/app/.env", ".env", "backend/.env", "../.env"):
            if os.path.exists(env_path):
                try:
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if (line.startswith("GROQ_API_KEY=") or line.startswith("AI_API_KEY=")) and "=" in line:
                                val = line.split("=", 1)[1].strip()
                                cleaned = clean_key(val)
                                if cleaned and not cleaned.lower().startswith("your_"):
                                    disk_key = cleaned
                                    break
                except Exception:
                    pass
            if disk_key:
                break

        if disk_key:
            return disk_key

        # 2. Check process environment variables
        env_key = os.getenv("GROQ_API_KEY") or os.getenv("AI_API_KEY")
        cleaned_env = clean_key(env_key)
        if cleaned_env and not cleaned_env.lower().startswith("your_"):
            return cleaned_env

        # 3. Fallback to model fields
        if self.AI_PROVIDER.lower() == "groq":
            key = self.GROQ_API_KEY or self.AI_API_KEY
        else:
            key = self.AI_API_KEY or self.GROQ_API_KEY

        return clean_key(key)

    @property
    def effective_ai_model(self) -> str:
        """Resolve model name dynamically from disk .env if updated."""
        import os
        model = self.AI_MODEL
        for env_path in ("/app/.env", ".env", "backend/.env"):
            if os.path.exists(env_path):
                try:
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("AI_MODEL=") and "=" in line:
                                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                                if val:
                                    return val
                except Exception:
                    pass
        return model

    @property
    def is_ai_available(self) -> bool:
        """Check if AI service is enabled and configured with required credentials."""
        if not (self.AI_ENABLED and self.AI_MODERATION_ENABLED):
            return False
        return bool(self.effective_ai_api_key)



    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            if v.strip().startswith("[") and v.strip().endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i) for i in v]
        return ["http://localhost:5173"]

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        if self.SYNC_DATABASE_URL:
            return self.SYNC_DATABASE_URL
        url = self.DATABASE_URL
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info: Any) -> str:
        # Strict validation in production mode
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production":
            if "dev-secret" in v.lower() or "insecure" in v.lower() or len(v) < 32:
                raise ValueError(
                    "Insecure SECRET_KEY detected for production environment! "
                    "Production requires a strong random key with at least 32 characters."
                )
        return v


settings = Settings()
