from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import correlation_id_ctx, logger


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundError(AppException):
    def __init__(
        self, message: str = "Resource not found", details: Any = None
    ) -> None:
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: Any = None) -> None:
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class DatabaseError(AppException):
    def __init__(
        self, message: str = "Database operation failed", details: Any = None
    ) -> None:
        super().__init__(
            message=message,
            code="DATABASE_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class ServiceUnavailableError(AppException):
    def __init__(
        self, message: str = "External service unavailable", details: Any = None
    ) -> None:
        super().__init__(
            message=message,
            code="SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Centralized handler for custom application exceptions."""
    req_id = correlation_id_ctx.get() or request.headers.get("X-Request-ID", "unknown")
    logger.warning(
        f"Application exception: {exc.code} - {exc.message}",
        extra={"extra_data": {"code": exc.code, "status_code": exc.status_code}},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": req_id,
                "details": exc.details,
            },
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handler for FastAPI/Pydantic request validation errors."""
    req_id = correlation_id_ctx.get() or request.headers.get("X-Request-ID", "unknown")
    details = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        details.append({"field": loc, "issue": err.get("msg", "Invalid value")})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request payload or parameters",
                "request_id": req_id,
                "details": details,
            },
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for uncaught exceptions, preventing stack trace leaks."""
    req_id = correlation_id_ctx.get() or request.headers.get("X-Request-ID", "unknown")
    logger.exception(f"Unhandled server error occurred: {exc!s}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please contact support.",
                "request_id": req_id,
                "details": None,
            },
        },
    )
