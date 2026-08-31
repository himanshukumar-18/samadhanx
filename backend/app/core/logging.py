import contextvars
import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

# Context variable for correlating logs with requests
correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default=""
)

# Fields that must never be exposed in logs
SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "authorization",
    "cookie",
}


def sanitize_data(data: Any) -> Any:
    """Recursively scrub sensitive keys from log dictionaries."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS:
                sanitized[k] = "******"
            else:
                sanitized[k] = sanitize_data(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_data(i) for i in data]
    return data


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records into clean, structured JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": correlation_id_ctx.get()
            or getattr(record, "request_id", None),
        }

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_obj["extra"] = sanitize_data(record.extra_data)

        return json.dumps(log_obj)


class ConsoleFormatter(logging.Formatter):
    """Clean console formatter for local development."""

    def format(self, record: logging.LogRecord) -> str:
        req_id = correlation_id_ctx.get() or getattr(record, "request_id", "")
        req_str = f" [{req_id[:8]}]" if req_id else ""
        time_str = datetime.now(UTC).strftime("%H:%M:%S")
        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return f"{time_str} | {record.levelname:<7} | {record.name}{req_str} - {msg}"


def setup_logging(log_level: str = "INFO", is_production: bool = False) -> None:
    """Initialize centralized logging."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if is_production:
        handler.setFormatter(StructuredJsonFormatter())
    else:
        handler.setFormatter(ConsoleFormatter())

    root_logger.addHandler(handler)

    # Silence noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


logger = logging.getLogger("samadhanx")
