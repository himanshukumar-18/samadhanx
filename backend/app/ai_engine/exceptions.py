"""AI Engine specific exceptions taxonomy."""


class AIError(Exception):
    """Base exception for all AI Engine errors."""

    def __init__(self, message: str, code: str = "AI_ERROR", details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class AIConfigurationError(AIError):
    """Raised when AI Engine configuration or credentials are missing or invalid."""

    def __init__(self, message: str, code: str = "AI_CONFIG_ERROR", details: dict | None = None):
        super().__init__(message, code=code, details=details)


class AIProviderError(AIError):
    """Raised when the underlying LLM provider encounters an unrecoverable failure."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, code="AI_PROVIDER_ERROR", details=details)


class AITimeoutError(AIProviderError):
    """Raised when LLM invocation exceeds the configured timeout threshold."""

    def __init__(self, message: str = "AI inference request timed out", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_TIMEOUT"


class AITimeout(AITimeoutError):
    pass


class AIRateLimitError(AIProviderError):
    """Raised when the LLM provider returns a rate limit (HTTP 429)."""

    def __init__(self, message: str = "AI provider rate limit reached", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_RATE_LIMIT"


class AIValidationError(AIError):
    """Raised when input fails sanitization or output fails strict validation."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, code="AI_VALIDATION_ERROR", details=details)


class AIMalformedOutputError(AIValidationError):
    """Raised when the model generates output that cannot be parsed into the expected schema."""

    def __init__(self, message: str = "Model returned malformed or unparseable output", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_MALFORMED_OUTPUT"


class AIInvalidOutput(AIMalformedOutputError):
    def __init__(self, message: str = "AI returned invalid structured output", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_INVALID_OUTPUT"


class AIFailed(AIProviderError):
    def __init__(self, message: str = "AI service failed", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_FAILED"


class AIInputTooLargeError(AIValidationError):
    """Raised when the input text exceeds maximum allowed characters."""

    def __init__(self, message: str = "Input text exceeds maximum allowed length", details: dict | None = None):
        super().__init__(message, details=details)
        self.code = "AI_INPUT_TOO_LARGE"


class AIModerationError(AIError):
    """Raised when moderation graph pipeline execution fails."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, code="AI_MODERATION_ERROR", details=details)
