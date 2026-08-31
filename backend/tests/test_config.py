import pytest

from app.core.config import Settings


def test_default_settings() -> None:
    settings = Settings()
    assert settings.PROJECT_NAME == "SamadhanX"
    assert settings.VERSION == "0.1.0"
    assert "http://localhost:5173" in settings.ALLOWED_ORIGINS


def test_cors_origins_parsing() -> None:
    settings = Settings(ALLOWED_ORIGINS="http://example.com, https://app.example.com")
    assert "http://example.com" in settings.ALLOWED_ORIGINS
    assert "https://app.example.com" in settings.ALLOWED_ORIGINS


def test_production_secret_key_validation() -> None:
    # Weak or default secret key in production should fail
    with pytest.raises(ValueError, match="Insecure SECRET_KEY detected"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="dev-secret-weak",
        )

    # Strong key in production should succeed
    strong_key = "a" * 32
    valid_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=strong_key,
    )
    assert valid_settings.SECRET_KEY == strong_key
