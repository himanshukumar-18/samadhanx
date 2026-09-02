from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging import logger, setup_logging
from app.middlewares.correlation import CorrelationIdMiddleware
from app.middlewares.security import (
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging(
        log_level=settings.LOG_LEVEL,
        is_production=(settings.ENVIRONMENT == "production"),
    )
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT.upper()}]"
    )

    # Initialize database tables & apply additive column updates automatically
    try:
        from app.db.session import async_engine
        from app.models import Base
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS headline VARCHAR(120);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS bio TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;"))

            await conn.execute(text("ALTER TABLE university_profiles ADD COLUMN IF NOT EXISTS institution_id UUID;"))
            await conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS institution_id UUID;"))

            # Ensure avatar_url and cover_url columns are TEXT to support large base64 data URIs
            await conn.execute(text("ALTER TABLE user_profile_details ALTER COLUMN avatar_url TYPE TEXT;"))
            await conn.execute(text("ALTER TABLE user_profile_details ALTER COLUMN cover_url TYPE TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ALTER COLUMN profile_picture_url TYPE TEXT;"))
        logger.info("Database tables and schema columns verified and updated successfully.")
    except Exception as e:
        logger.warning(f"Database auto-creation check note: {e}")

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="SamadhanX Production Platform Gateway (SIH 2026 - SIH 26043)",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # 1. Register Custom Exception Handlers
    application.add_exception_handler(AppException, app_exception_handler)
    application.add_exception_handler(HTTPException, http_exception_handler)
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)

    # 2. Register Middlewares
    application.add_middleware(CorrelationIdMiddleware)
    application.add_middleware(
        RequestSizeLimitMiddleware, max_bytes=settings.MAX_REQUEST_SIZE_BYTES
    )
    application.add_middleware(SecurityHeadersMiddleware)

    # CORS configuration
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 3. Mount Health Probes at Root Level
    application.include_router(health.router)

    # 4. Mount API v1 Routers
    application.include_router(api_router, prefix=settings.API_V1_STR)

    return application


app = create_app()
