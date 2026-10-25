"""Problem AI Analysis module and enums

Revision ID: 0015_problem_ai_analysis
Revises: 0014_industry_phase_e
Create Date: 2026-09-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

revision = "0015_problem_ai_analysis"
down_revision = "0014_industry_phase_e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create AIAnalysisStatus enum idempotently
    status_values = [
        "not_started", "queued", "running", "completed", "failed", "retrying", "timeout",
        "NOT_STARTED", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "TIMEOUT"
    ]
    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_analysis_status_enum') THEN
                CREATE TYPE ai_analysis_status_enum AS ENUM (
                    'not_started', 'queued', 'running', 'completed', 'failed', 'retrying', 'timeout',
                    'NOT_STARTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'TIMEOUT'
                );
            END IF;
        END$$;
    """))

    # 2. Create AIModerationRecommendation enum idempotently
    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_moderation_recommendation_enum') THEN
                CREATE TYPE ai_moderation_recommendation_enum AS ENUM (
                    'normal_review', 'spam_review', 'high_risk_escalation', 'human_review_required',
                    'NORMAL_REVIEW', 'SPAM_REVIEW', 'HIGH_RISK_ESCALATION', 'HUMAN_REVIEW_REQUIRED'
                );
            END IF;
        END$$;
    """))

    # 3. Create problem_ai_analyses table
    table_exists = conn.execute(
        text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='problem_ai_analyses')")
    ).scalar()

    if not table_exists:
        op.create_table(
            "problem_ai_analyses",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("analysis_version", sa.Integer(), nullable=False, default=1, index=True),
            sa.Column("status", sa.Enum("not_started", "queued", "running", "completed", "failed", "retrying", "timeout", name="ai_analysis_status_enum", create_type=False), nullable=False, default="not_started", index=True),
            sa.Column("provider", sa.String(50), nullable=False, default="openai"),
            sa.Column("model_name", sa.String(100), nullable=False, default="gpt-4o-mini"),
            sa.Column("prompt_version", sa.String(50), nullable=False, default="v1"),
            sa.Column("category", sa.String(100), nullable=True, index=True),
            sa.Column("subcategory", sa.String(100), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("keywords", sa.JSON(), nullable=True),
            sa.Column("spam_probability", sa.Float(), nullable=True),
            sa.Column("spam_reasons", sa.JSON(), nullable=True),
            sa.Column("quality_score", sa.Float(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("risk_flags", sa.JSON(), nullable=True),
            sa.Column("recommendation", sa.Enum("normal_review", "spam_review", "high_risk_escalation", "human_review_required", name="ai_moderation_recommendation_enum", create_type=False), nullable=True, index=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("duplicate_signal", sa.JSON(), nullable=True),
            sa.Column("error_code", sa.String(50), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("raw_sanitized_input", sa.Text(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("token_usage", sa.JSON(), nullable=True),
            sa.Column("triggered_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("problem_ai_analyses")
