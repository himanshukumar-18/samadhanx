"""Extend institution_masters table and create institution_verification_requests

Revision ID: 0009_institution_master_extended_and_requests
Revises: 0008_citizen_profile_civic_fields
Create Date: 2026-09-04 13:45:00.000000

Adds extended higher-education fields to institution_masters:
  - official_name      VARCHAR(255)
  - short_name         VARCHAR(100)
  - institution_type   VARCHAR(50) DEFAULT 'UNIVERSITY'
  - ownership_type     VARCHAR(50) DEFAULT 'GOVERNMENT'
  - ugc_code           VARCHAR(50)
  - city               VARCHAR(100)
  - pincode            VARCHAR(10)
  - address            TEXT
  - status             VARCHAR(30) DEFAULT 'ACTIVE'
  - source_identifier  VARCHAR(100)
  - source_reference   VARCHAR(255)
  - last_verified_at   TIMESTAMP WITH TIME ZONE
  - last_synced_at     TIMESTAMP WITH TIME ZONE

Creates institution_verification_requests table for fallback registration requests.
All statements use IF NOT EXISTS for idempotency.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009_institution_master_extended_and_requests"
down_revision: str | None = "0008_citizen_profile_civic_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Extended columns on institution_masters
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS official_name VARCHAR(255);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS short_name VARCHAR(100);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50) DEFAULT 'UNIVERSITY';")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(50) DEFAULT 'GOVERNMENT';")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS ugc_code VARCHAR(50);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS city VARCHAR(100);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS address TEXT;")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS source_identifier VARCHAR(100);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS source_reference VARCHAR(255);")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;")
    op.execute("ALTER TABLE institution_masters ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;")

    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_short_name ON institution_masters (short_name);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_ugc_code ON institution_masters (ugc_code);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_type_state ON institution_masters (institution_type, state);")

    # Ensure student_profiles.university_id is nullable (since students can register via institution_masters)
    op.execute("ALTER TABLE student_profiles ALTER COLUMN university_id DROP NOT NULL;")

    # 2. Table institution_verification_requests
    op.execute("""
    CREATE TABLE IF NOT EXISTS institution_verification_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        submitted_by_email VARCHAR(255) NOT NULL,
        submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        requested_name VARCHAR(255) NOT NULL,
        institution_type VARCHAR(50) NOT NULL DEFAULT 'College',
        state VARCHAR(100) NOT NULL,
        district VARCHAR(100) NOT NULL,
        city VARCHAR(100),
        official_website VARCHAR(255),
        aishe_code VARCHAR(50),
        ugc_code VARCHAR(50),
        additional_notes TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        approved_institution_id UUID REFERENCES institution_masters(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_req_email ON institution_verification_requests (submitted_by_email);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_req_status ON institution_verification_requests (status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inst_req_state ON institution_verification_requests (state);")


def downgrade() -> None:
    pass
