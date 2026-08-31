from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "SamadhanX API"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str
    REDIS_URL: str

    CORS_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()