"""Add pod lifecycle notification enum values and student profile fields

Revision ID: 0012_pod_notifications_and_student_fields
Revises: 0011_patents_ip
Create Date: 2026-09-11 10:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012_pod_notifications_and_student_fields'
down_revision = '0011_patents_ip'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Extend notification_type_enum with pod lifecycle events
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'POD_CREATED'")
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'POD_MEMBER_JOINED'")
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'POD_SUBMITTED_FOR_REVIEW'")
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'POD_REVIEW_FEEDBACK'")

    # 2. Add social & portfolio columns to student_profiles if not exists
    op.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS bio TEXT")
    op.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR(255)")
    op.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255)")
    op.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255)")
    op.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS headline VARCHAR(150)")


def downgrade() -> None:
    op.execute("ALTER TABLE student_profiles DROP COLUMN IF EXISTS headline")
    op.execute("ALTER TABLE student_profiles DROP COLUMN IF EXISTS portfolio_url")
    op.execute("ALTER TABLE student_profiles DROP COLUMN IF EXISTS linkedin_url")
    op.execute("ALTER TABLE student_profiles DROP COLUMN IF EXISTS github_url")
    op.execute("ALTER TABLE student_profiles DROP COLUMN IF EXISTS bio")
