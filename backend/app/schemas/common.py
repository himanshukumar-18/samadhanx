from typing import Any

from pydantic import BaseModel


class StandardApiResponse[T](BaseModel):
    success: bool = True
    data: T | None = None
    message: str | None = None

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any | None = None

class StandardApiError(BaseModel):
    success: bool = False
    error: ErrorDetail
