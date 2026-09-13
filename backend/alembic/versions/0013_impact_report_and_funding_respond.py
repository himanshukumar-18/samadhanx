"""Add impact_reports table and new notification enum values

Revision ID: 0013_impact_report_and_funding_respond
Revises: 0012_pod_notifications_and_student_fields
Create Date: 2026-09-13 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013_impact_report_and_funding_respond"
down_revision = "0012_pod_notifications_and_student_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new notification_type_enum values
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'impact_report_submitted'")
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'funding_offer_response'")

    # 2. Create impact_reports table (idempotent)
    op.execute("""
        CREATE TABLE IF NOT EXISTS impact_reports (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            pod_id UUID NOT NULL,
            submitted_by UUID NOT NULL,
            beneficiaries_reached INTEGER,
            outcome_description TEXT NOT NULL,
            proof_image_urls JSONB DEFAULT '[]'::jsonb,
            verified_by UUID,
            is_verified BOOLEAN DEFAULT false NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_impact_report_pod UNIQUE (pod_id),
            FOREIGN KEY (pod_id) REFERENCES solution_projects (id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL,
            FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_impact_reports_pod_id ON impact_reports (pod_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_impact_reports_submitted_by ON impact_reports (submitted_by)")


def downgrade() -> None:
    op.drop_index("ix_impact_reports_submitted_by", table_name="impact_reports")
    op.drop_index("ix_impact_reports_pod_id", table_name="impact_reports")
    op.drop_table("impact_reports")
    # Note: Postgres doesn't support removing enum values; manual cleanup required
