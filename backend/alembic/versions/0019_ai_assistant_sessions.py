"""Add scoped citizen assistant sessions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0019_ai_assistant_sessions"
down_revision = "0018_ai_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "ai_assistant_sessions" not in existing_tables:
        op.create_table(
            "ai_assistant_sessions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("turn_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("messages", sa.JSON(), nullable=False),
            sa.Column("draft", sa.JSON()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_ai_assistant_sessions_user_id", "ai_assistant_sessions", ["user_id"])
        op.create_index("ix_ai_assistant_sessions_expires_at", "ai_assistant_sessions", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "ai_assistant_sessions" in existing_tables:
        op.drop_table("ai_assistant_sessions")
