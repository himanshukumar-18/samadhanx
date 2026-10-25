"""Add trigger and started_at columns to problem_ai_analyses

Revision ID: 0016_ai_trigger_started_at
Revises: 0015_problem_ai_analysis
Create Date: 2026-09-16 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0016_ai_trigger_started_at"
down_revision = "0015_problem_ai_analysis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add trigger column
    op.add_column(
        "problem_ai_analyses",
        sa.Column("trigger", sa.String(50), nullable=True, server_default="auto_submission"),
    )
    # Add started_at column
    op.add_column(
        "problem_ai_analyses",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Update hardcoded default provider values to empty string
    op.alter_column("problem_ai_analyses", "provider", server_default="")
    op.alter_column("problem_ai_analyses", "model_name", server_default="")


def downgrade() -> None:
    op.drop_column("problem_ai_analyses", "trigger")
    op.drop_column("problem_ai_analyses", "started_at")
    op.alter_column("problem_ai_analyses", "provider", server_default="openai")
    op.alter_column("problem_ai_analyses", "model_name", server_default="gpt-4o-mini")
