"""Add privacy-safe shared AI decision and feedback records."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018_ai_foundation"
down_revision = "0017_duplicate_detection"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    # Add content_hash to problem_ai_analyses if not present
    existing_cols = [c["name"] for c in insp.get_columns("problem_ai_analyses")]
    if "content_hash" not in existing_cols:
        op.add_column("problem_ai_analyses", sa.Column("content_hash", sa.String(64), nullable=True))
        op.create_index("ix_problem_ai_analyses_content_hash", "problem_ai_analyses", ["content_hash"])

    if "ai_decision_logs" not in existing_tables:
        op.create_table(
            "ai_decision_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("feature", sa.String(64), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("entity_type", sa.String(64), nullable=False),
            sa.Column("entity_id", sa.String(128)),
            sa.Column("input_hash", sa.String(64), nullable=False),
            sa.Column("output_summary", sa.String(500)),
            sa.Column("model", sa.String(128)),
            sa.Column("latency_ms", sa.Integer()),
            sa.Column("status", sa.String(16), nullable=False, server_default="ok"),
            sa.Column("error_code", sa.String(64)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ai_decision_logs_feature", "ai_decision_logs", ["feature"])
        op.create_index("ix_ai_decision_logs_input_hash", "ai_decision_logs", ["input_hash"])

    if "ai_feedback" not in existing_tables:
        op.create_table(
            "ai_feedback",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("feature", sa.String(64), nullable=False),
            sa.Column("entity_id", sa.String(128), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("rating", sa.String(4), nullable=False),
            sa.Column("comment", sa.String(300)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("rating IN ('up', 'down')", name="ck_ai_feedback_rating"),
        )
        op.create_index("ix_ai_feedback_feature", "ai_feedback", ["feature"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    existing_cols = [c["name"] for c in insp.get_columns("problem_ai_analyses")]
    if "content_hash" in existing_cols:
        op.drop_index("ix_problem_ai_analyses_content_hash", table_name="problem_ai_analyses")
        op.drop_column("problem_ai_analyses", "content_hash")

    if "ai_feedback" in existing_tables:
        op.drop_table("ai_feedback")
    if "ai_decision_logs" in existing_tables:
        op.drop_table("ai_decision_logs")
