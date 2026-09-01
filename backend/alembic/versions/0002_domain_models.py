"""Create domain models for problems, projects, reviews, support, notifications

Revision ID: 0002_domain_models
Revises: 0001_initial_pgvector
Create Date: 2026-09-01 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_domain_models"
down_revision: str | None = "0001_initial_pgvector"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enum types if not exists
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'problem_status_enum') THEN "
        "CREATE TYPE problem_status_enum AS ENUM ('submitted', 'under_review', 'verified', 'rejected', 'in_progress', 'solution_submitted', 'pilot', 'solved'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_level_enum') THEN "
        "CREATE TYPE impact_level_enum AS ENUM ('low', 'medium', 'high', 'critical'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_enum') THEN "
        "CREATE TYPE project_status_enum AS ENUM ('planning', 'in_progress', 'prototype', 'review', 'pilot', 'completed', 'rejected'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_decision_enum') THEN "
        "CREATE TYPE review_decision_enum AS ENUM ('pending', 'approved', 'rejected', 'changes_requested'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_type_enum') THEN "
        "CREATE TYPE support_type_enum AS ENUM ('sponsorship', 'mentorship', 'pilot_partner', 'bounty'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'industry_support_status_enum') THEN "
        "CREATE TYPE industry_support_status_enum AS ENUM ('pending', 'approved', 'rejected'); END IF; END $$;"
    )
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN "
        "CREATE TYPE notification_type_enum AS ENUM ('problem_updated', 'project_assigned', 'review_feedback', 'industry_support', 'system_alert'); END IF; END $$;"
    )

    # 1. Problems table
    op.create_table(
        "problems",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, index=True),
        sa.Column("location", sa.String(255), nullable=False),
        sa.Column("district", sa.String(100), nullable=False, index=True),
        sa.Column("state", sa.String(100), nullable=False, index=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column(
            "status",
            sa.Enum('submitted', 'under_review', 'verified', 'rejected', 'in_progress', 'solution_submitted', 'pilot', 'solved', name="problem_status_enum"),
            nullable=False,
            server_default="submitted",
            index=True,
        ),
        sa.Column(
            "impact_level",
            sa.Enum('low', 'medium', 'high', 'critical', name="impact_level_enum"),
            nullable=False,
            server_default="medium",
            index=True,
        ),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("media_urls", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("ai_insight", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 2. Problem Comments table
    op.create_table(
        "problem_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 3. Problem Endorsements table
    op.create_table(
        "problem_endorsements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("problem_id", "user_id", name="uq_problem_user_endorsement"),
    )

    # 4. Solution Projects table
    op.create_table(
        "solution_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("team_name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("repository_url", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum('planning', 'in_progress', 'prototype', 'review', 'pilot', 'completed', 'rejected', name="project_status_enum"),
            nullable=False,
            server_default="planning",
            index=True,
        ),
        sa.Column("lead_student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("faculty_mentor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("university_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("university_profiles.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 5. Project Members table
    op.create_table(
        "project_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role_in_team", sa.String(100), nullable=False, server_default="Member"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_user_member"),
    )

    # 6. Project Updates table
    op.create_table(
        "project_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("prototype_url", sa.String(255), nullable=True),
        sa.Column("media_urls", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 7. Project Reviews table
    op.create_table(
        "project_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column(
            "decision",
            sa.Enum('pending', 'approved', 'rejected', 'changes_requested', name="review_decision_enum"),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 8. Industry Supports table
    op.create_table(
        "industry_supports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("industry_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column(
            "support_type",
            sa.Enum('sponsorship', 'mentorship', 'pilot_partner', 'bounty', name="support_type_enum"),
            nullable=False,
            server_default="sponsorship",
            index=True,
        ),
        sa.Column("amount_or_terms", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum('pending', 'approved', 'rejected', name="industry_support_status_enum"),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 9. Notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "type",
            sa.Enum('problem_updated', 'project_assigned', 'review_feedback', 'industry_support', 'system_alert', name="notification_type_enum"),
            nullable=False,
            server_default="system_alert",
        ),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("industry_supports")
    op.drop_table("project_reviews")
    op.drop_table("project_updates")
    op.drop_table("project_members")
    op.drop_table("solution_projects")
    op.drop_table("problem_endorsements")
    op.drop_table("problem_comments")
    op.drop_table("problems")

    op.execute("DROP TYPE IF EXISTS notification_type_enum;")
    op.execute("DROP TYPE IF EXISTS industry_support_status_enum;")
    op.execute("DROP TYPE IF EXISTS support_type_enum;")
    op.execute("DROP TYPE IF EXISTS review_decision_enum;")
    op.execute("DROP TYPE IF EXISTS project_status_enum;")
    op.execute("DROP TYPE IF EXISTS impact_level_enum;")
    op.execute("DROP TYPE IF EXISTS problem_status_enum;")
