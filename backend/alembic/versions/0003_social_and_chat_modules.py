"""Create social engagement, follow system, chat messages, settings, and profile details tables

Revision ID: 0003_social_and_chat_modules
Revises: 0002_domain_models
Create Date: 2026-09-01 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_social_and_chat_modules"
down_revision: str | None = "0002_domain_models"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. User Follows table
    op.create_table(
        "user_follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("following_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_user_follower_following"),
    )

    # 2. Problem Shares table
    op.create_table(
        "problem_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("platform", sa.String(50), nullable=False, server_default="link"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 3. Chat Messages table
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("media_url", sa.String(500), nullable=True),
        sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default="true", index=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 4. Account Settings table
    op.create_table(
        "account_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("push_notifications", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("public_profile", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_contact", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 5. User Profile Details table
    op.create_table(
        "user_profile_details",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("headline", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("cover_url", sa.String(500), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("github_url", sa.String(255), nullable=True),
        sa.Column("linkedin_url", sa.String(255), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=True),
        sa.Column("experience", sa.JSON(), nullable=True),
        sa.Column("education", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("user_profile_details")
    op.drop_table("account_settings")
    op.drop_table("chat_messages")
    op.drop_table("problem_shares")
    op.drop_table("user_follows")
