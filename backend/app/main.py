import asyncio
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
            # 1. Idempotent Enum creation: Only create if they do not already exist in pg_type
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
                        CREATE TYPE user_role_enum AS ENUM ('citizen', 'student', 'faculty', 'industry', 'admin', 'university');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'problem_status_enum') THEN
                        CREATE TYPE problem_status_enum AS ENUM ('submitted', 'under_review', 'verified', 'rejected', 'in_progress', 'solution_submitted', 'pilot', 'solved', 'duplicate');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_level_enum') THEN
                        CREATE TYPE impact_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_enum') THEN
                        CREATE TYPE project_status_enum AS ENUM ('planning', 'in_progress', 'prototype', 'review', 'pilot', 'completed', 'rejected');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_decision_enum') THEN
                        CREATE TYPE review_decision_enum AS ENUM ('pending', 'approved', 'rejected', 'changes_requested');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_type_enum') THEN
                        CREATE TYPE support_type_enum AS ENUM ('sponsorship', 'mentorship', 'pilot_partner', 'bounty', 'csr_grant', 'equipment');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'industry_support_status_enum') THEN
                        CREATE TYPE industry_support_status_enum AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
                        CREATE TYPE notification_type_enum AS ENUM (
                            'problem_updated', 'project_assigned', 'review_feedback', 'industry_support', 'system_alert',
                            'pod_created', 'pod_member_joined', 'pod_submitted_for_review', 'pod_review_feedback',
                            'impact_report_submitted', 'funding_offer_response', 'industry_offer_made', 'funding_milestone_update'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_purpose_enum') THEN
                        CREATE TYPE otp_purpose_enum AS ENUM ('registration', 'password_reset');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status_enum') THEN
                        CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'revoked', 'expired');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_type_enum') THEN
                        CREATE TYPE org_type_enum AS ENUM ('university', 'industry');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status_enum') THEN
                        CREATE TYPE request_status_enum AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_analysis_status_enum') THEN
                        CREATE TYPE ai_analysis_status_enum AS ENUM (
                            'not_started', 'queued', 'running', 'completed', 'failed', 'retrying', 'timeout',
                            'NOT_STARTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'TIMEOUT'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_moderation_recommendation_enum') THEN
                        CREATE TYPE ai_moderation_recommendation_enum AS ENUM (
                            'normal_review', 'spam_review', 'high_risk_escalation', 'human_review_required',
                            'NORMAL_REVIEW', 'SPAM_REVIEW', 'HIGH_RISK_ESCALATION', 'HUMAN_REVIEW_REQUIRED'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duplicate_verdict_enum') THEN
                        CREATE TYPE duplicate_verdict_enum AS ENUM (
                            'strong_duplicate', 'possible_duplicate', 'related', 'unique',
                            'STRONG_DUPLICATE', 'POSSIBLE_DUPLICATE', 'RELATED', 'UNIQUE'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duplicate_link_status_enum') THEN
                        CREATE TYPE duplicate_link_status_enum AS ENUM (
                            'pending', 'confirmed', 'dismissed',
                            'PENDING', 'CONFIRMED', 'DISMISSED'
                        );
                    END IF;
                END $$;
            """))

            # 2. Synchronize SQLAlchemy model tables
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS headline VARCHAR(120);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS bio TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;"))

            await conn.execute(text("ALTER TABLE university_profiles ADD COLUMN IF NOT EXISTS institution_id UUID;"))
            await conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS institution_id UUID;"))
            await conn.execute(text("ALTER TABLE student_profiles ALTER COLUMN university_id DROP NOT NULL;"))

            # Fix industry_profiles schema drift — table was created from old model snapshot
            # and is missing several columns added later. All statements use IF NOT EXISTS
            # so they are safe to re-run on containers that already have some columns.
            await conn.execute(text("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100) NOT NULL DEFAULT 'Unknown';"))
            await conn.execute(text("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS point_of_contact_name VARCHAR(255) NOT NULL DEFAULT 'Unknown';"))
            await conn.execute(text("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS official_email VARCHAR(255) NOT NULL DEFAULT '';"))
            await conn.execute(text("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255);"))

            # Support and Industry enums
            await conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'CSR_GRANT';"))
            await conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'EQUIPMENT';"))
            await conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'csr_grant';"))
            await conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'equipment';"))
            await conn.execute(text("ALTER TYPE industry_support_status_enum ADD VALUE IF NOT EXISTS 'WITHDRAWN';"))
            await conn.execute(text("ALTER TYPE industry_support_status_enum ADD VALUE IF NOT EXISTS 'withdrawn';"))
            await conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'INDUSTRY_OFFER_MADE';"))
            await conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FUNDING_MILESTONE_UPDATE';"))
            await conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'IMPACT_REPORT_SUBMITTED';"))
            await conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FUNDING_OFFER_RESPONSE';"))

            # Citizen civic profile fields (migration 0008)
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS full_address TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS bio TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10);"))
            await conn.execute(text("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS interests JSON DEFAULT '[]';"))

            # Extended Institution Master fields & Verification Requests (migration 0009)
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS official_name VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS short_name VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50) DEFAULT 'UNIVERSITY';"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(50) DEFAULT 'GOVERNMENT';"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS ugc_code VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS city VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS address TEXT;"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS source_identifier VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS source_reference VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;"))
            await conn.execute(text("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;"))

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS institution_verification_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    submitted_by_email VARCHAR(255) NOT NULL,
                    submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    requested_name VARCHAR(255) NOT NULL,
                    institution_type VARCHAR(50) NOT NULL DEFAULT 'College',
                    state VARCHAR(100) NOT NULL,
                    district VARCHAR(100) NOT NULL,
                    city VARCHAR(100),
                    official_website VARCHAR(255),
                    aishe_code VARCHAR(50),
                    ugc_code VARCHAR(50),
                    additional_notes TEXT,
                    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    reviewed_at TIMESTAMP WITH TIME ZONE,
                    rejection_reason TEXT,
                    approved_institution_id UUID REFERENCES institution_masters(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                );
            """))

            # Ensure avatar_url and cover_url columns are TEXT to support large base64 data URIs
            await conn.execute(text("ALTER TABLE user_profile_details ALTER COLUMN avatar_url TYPE TEXT;"))
            await conn.execute(text("ALTER TABLE user_profile_details ALTER COLUMN cover_url TYPE TEXT;"))
            await conn.execute(text("ALTER TABLE citizen_profiles ALTER COLUMN profile_picture_url TYPE TEXT;"))

            # Safe additive performance indexes for fast feeds, profile lookups & notifications
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_problems_status_created_at ON problems (status, created_at DESC);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_problems_created_by_status ON problems (created_by_id, status);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_problems_category_created_at ON problems (category, created_at DESC);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_problem_saves_user_problem ON problem_saves (user_id, problem_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_problem_shares_problem_id ON problem_shares (problem_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications (recipient_id, is_read, created_at DESC);"))
        logger.info("Database initialization completed")
    except Exception as e:
        logger.warning(f"Database initialization warning: {e}")

    # Verify Redis connection
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pong = await asyncio.wait_for(r.ping(), timeout=3.0)
        await r.aclose()
        if pong:
            logger.info("Redis connection verified")
    except Exception as e:
        logger.warning(f"Redis connection warning during startup: {e}")

    # Verify Celery configuration
    try:
        from app.celery_app import celery_app
        if celery_app.conf.broker_url:
            logger.info("Celery configuration loaded")
    except Exception as e:
        logger.warning(f"Celery configuration check warning: {e}")

    logger.info("Application startup completed")

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
