"""Fix industry_profiles schema drift — add all missing columns

Revision ID: 0007_add_registration_number_to_industry_profiles
Revises: 0006_institution_master_and_sync
Create Date: 2026-09-03 21:15:00.000000

Root cause: industry_profiles was created by Base.metadata.create_all from an
older version of the IndustryProfile model. The model has since gained multiple
columns that were never propagated to the actual DB table via a migration.

Missing columns added here:
  - registration_number  VARCHAR(100)  nullable
  - industry_type        VARCHAR(100)  NOT NULL  (backfilled with 'Unknown')
  - point_of_contact_name VARCHAR(255) NOT NULL  (backfilled with 'Unknown')
  - official_email       VARCHAR(255)  NOT NULL  (backfilled with empty string)
  - website              VARCHAR(255)  nullable
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_add_registration_number_to_industry_profiles"
down_revision: str | None = "0006_institution_master_and_sync"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Use raw SQL with ADD COLUMN IF NOT EXISTS so this migration is safe to run
    # even if some columns already exist (e.g. from the lifespan ALTER TABLE guard).
    op.execute("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);")
    op.execute("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100) NOT NULL DEFAULT 'Unknown';")
    op.execute("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS point_of_contact_name VARCHAR(255) NOT NULL DEFAULT 'Unknown';")
    op.execute("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS official_email VARCHAR(255) NOT NULL DEFAULT '';")
    op.execute("ALTER TABLE industry_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255);")


def downgrade() -> None:
    op.drop_column("industry_profiles", "website")
    op.drop_column("industry_profiles", "official_email")
    op.drop_column("industry_profiles", "point_of_contact_name")
    op.drop_column("industry_profiles", "industry_type")
    op.drop_column("industry_profiles", "registration_number")
