"""Create faculty_invitations table and invitation_status_enum

Revision ID: 0010_faculty_invitations
Revises: 0009_institution_master_extended_and_requests
Create Date: 2026-09-10 10:00:00.000000

Creates faculty_invitations table for secure, token-based faculty onboarding.
All statements use IF NOT EXISTS for idempotency.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_faculty_invitations"
down_revision: str | None = "0009_institution_master_extended_and_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create invitation_status_enum if not exists
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status_enum') THEN
            CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'revoked', 'expired');
        END IF;
    END $$;
    """)

    # 2. Create faculty_invitations table
    op.execute("""
    CREATE TABLE IF NOT EXISTS faculty_invitations (
        id UUID PRIMARY KEY,
        university_id UUID NOT NULL REFERENCES university_profiles(id) ON DELETE CASCADE,
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        email VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        department VARCHAR(150) NOT NULL,
        designation VARCHAR(100) NOT NULL,
        research_areas JSON DEFAULT '[]',
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        status invitation_status_enum NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        accepted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

    # 3. Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_faculty_invitations_univ ON faculty_invitations (university_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_faculty_invitations_email ON faculty_invitations (email);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_faculty_invitations_token_hash ON faculty_invitations (token_hash);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_faculty_invitations_status ON faculty_invitations (status);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS faculty_invitations CASCADE;")
    op.execute("DROP TYPE IF EXISTS invitation_status_enum CASCADE;")
