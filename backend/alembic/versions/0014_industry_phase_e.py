"""Industry Phase E: funded_project_comments table, new enum values

Revision ID: 0014_industry_phase_e
Revises: 0013_impact_report_and_funding_respond
Create Date: 2026-09-15 08:47:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

revision = "0014_industry_phase_e"
down_revision = "0013_impact_report_and_funding_respond"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add WITHDRAWN to RequestStatus enum (idempotent)
    conn.execute(text("ALTER TYPE industry_support_status_enum ADD VALUE IF NOT EXISTS 'withdrawn'"))
    conn.execute(text("ALTER TYPE industry_support_status_enum ADD VALUE IF NOT EXISTS 'WITHDRAWN'"))

    # 2. Add CSR_GRANT and EQUIPMENT to SupportType enum (idempotent)
    conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'csr_grant'"))
    conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'equipment'"))
    conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'CSR_GRANT'"))
    conn.execute(text("ALTER TYPE support_type_enum ADD VALUE IF NOT EXISTS 'EQUIPMENT'"))

    # 3. Add new notification type enum values (idempotent)
    conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'industry_offer_made'"))
    conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'funding_milestone_update'"))
    conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'INDUSTRY_OFFER_MADE'"))
    conn.execute(text("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FUNDING_MILESTONE_UPDATE'"))

    # 4. Create funded_project_comments table (idempotent)
    table_exists = conn.execute(
        text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='funded_project_comments')")
    ).scalar()

    if not table_exists:
        op.create_table(
            "funded_project_comments",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
            sa.Column("pod_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("industry_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("comment", sa.Text(), nullable=False),
            sa.Column("company_name", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["pod_id"], ["solution_projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["industry_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_funded_project_comments_pod_id", "funded_project_comments", ["pod_id"])
        op.create_index("ix_funded_project_comments_industry_user_id", "funded_project_comments", ["industry_user_id"])


def downgrade() -> None:
    op.drop_index("ix_funded_project_comments_industry_user_id", table_name="funded_project_comments")
    op.drop_index("ix_funded_project_comments_pod_id", table_name="funded_project_comments")
    op.drop_table("funded_project_comments")
    # Note: PostgreSQL does not support removing enum values; enum changes are irreversible in downgrade
