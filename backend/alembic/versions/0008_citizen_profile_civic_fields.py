"""Add civic profile fields to citizen_profiles

Revision ID: 0008_citizen_profile_civic_fields
Revises: 0007_add_registration_number_to_industry_profiles
Create Date: 2026-09-04 12:15:00.000000

Adds new civic identity fields to the citizen_profiles table:
  - date_of_birth  DATE           nullable
  - gender         VARCHAR(20)    nullable
  - city           VARCHAR(100)   nullable  (city / village / town)
  - pincode        VARCHAR(10)    nullable
  - full_address   TEXT           nullable  (private, never public)
  - bio            TEXT           nullable  (short civic intro)
  - preferred_language VARCHAR(10) nullable
  - interests      JSON           default '[]'

All additions use IF NOT EXISTS so this migration is idempotent.
No columns are dropped — existing citizen data is fully preserved.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_citizen_profile_civic_fields"
down_revision: str | None = "0007_add_registration_number_to_industry_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS full_address TEXT;")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS bio TEXT;")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10);")
    op.execute("ALTER TABLE citizen_profiles ADD COLUMN IF NOT EXISTS interests JSON DEFAULT '[]';")


def downgrade() -> None:
    # Safe to drop these new columns — they did not exist before this migration
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS interests;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS preferred_language;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS bio;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS full_address;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS pincode;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS city;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS gender;")
    op.execute("ALTER TABLE citizen_profiles DROP COLUMN IF EXISTS date_of_birth;")
