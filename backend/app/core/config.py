import json
from typing import Any, Literal
from urllib.parse import quote_plus

from pydantic import field_validator, model_validator
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

    # Database URLs & Components (Supports special characters via component encoding)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/samadhanx"
    SYNC_DATABASE_URL: str | None = None
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_HOST: str | None = None
    POSTGRES_PORT: int | None = None
    POSTGRES_DB: str | None = None

    # Redis URL & Components (Supports special characters via component encoding)
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_HOST: str | None = None
    REDIS_PORT: int | None = None
    REDIS_PASSWORD: str | None = None
    REDIS_DB: int = 0

    # Celery Configuration
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    # Logging & Limits
    LOG_LEVEL: str = "INFO"
    MAX_REQUEST_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # Media is persisted only after a successful Cloudinary upload.
    CLOUDINARY_URL: str | None = None

    # AI & LLM Service Settings
    GROQ_API_KEY: str | None = None

    # SMTP / Email Service Settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "noreply@samadhanx.in"
    EMAILS_FROM_NAME: str = "SamadhanX Community Platform"
    EMAILS_ENABLED: bool = False

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

    @model_validator(mode="after")
    def construct_database_and_redis_urls(self) -> "Settings":
        # Handle PostgreSQL credentials with special characters
        if self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_DB:
            user = quote_plus(self.POSTGRES_USER)
            pwd = quote_plus(self.POSTGRES_PASSWORD)
            host = self.POSTGRES_HOST or "postgres"
            port = self.POSTGRES_PORT or 5432
            db = self.POSTGRES_DB
            self.DATABASE_URL = f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db}"
            self.SYNC_DATABASE_URL = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"

        # Handle Redis credentials with special characters
        if self.REDIS_PASSWORD:
            pwd = quote_plus(self.REDIS_PASSWORD)
            host = self.REDIS_HOST or "redis"
            port = self.REDIS_PORT or 6379
            db = self.REDIS_DB
            self.REDIS_URL = f"redis://:{pwd}@{host}:{port}/{db}"
            if not self.CELERY_BROKER_URL:
                self.CELERY_BROKER_URL = self.REDIS_URL
            if not self.CELERY_RESULT_BACKEND:
                self.CELERY_RESULT_BACKEND = self.REDIS_URL
        return self

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
