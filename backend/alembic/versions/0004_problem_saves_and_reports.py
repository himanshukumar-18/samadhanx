"""Add persisted saved problems and problem reports.

Revision ID: 0004_problem_saves_and_reports
Revises: 0003_social_and_chat_modules
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_problem_saves_and_reports"
down_revision: str | None = "0003_social_and_chat_modules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def upgrade() -> None:
    op.create_table(
        "problem_saves",
        *_base_columns(),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("problem_id", "user_id", name="uq_problem_user_save"),
    )
    op.create_index("ix_problem_saves_problem_id", "problem_saves", ["problem_id"])
    op.create_index("ix_problem_saves_user_id", "problem_saves", ["user_id"])
    op.create_table(
        "problem_reports",
        *_base_columns(),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.UniqueConstraint("problem_id", "reporter_id", name="uq_problem_reporter"),
    )
    op.create_index("ix_problem_reports_problem_id", "problem_reports", ["problem_id"])
    op.create_index("ix_problem_reports_reporter_id", "problem_reports", ["reporter_id"])


def downgrade() -> None:
    op.drop_table("problem_reports")
    op.drop_table("problem_saves")
