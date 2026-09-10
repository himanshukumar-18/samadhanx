"""Create patents_ip table

Revision ID: 0011_patents_ip
Revises: 0010_faculty_invitations
Create Date: 2026-09-10 12:00:00.000000

Creates patents_ip table for tracking university and student solution pod patent filings.
All statements use IF NOT EXISTS for idempotency.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011_patents_ip"
down_revision: str | None = "0010_faculty_invitations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS patents_ip (
        id UUID PRIMARY KEY,
        project_id UUID REFERENCES solution_projects(id) ON DELETE SET NULL,
        university_id UUID REFERENCES university_profiles(id) ON DELETE CASCADE,
        inventor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        application_number VARCHAR(100) NOT NULL UNIQUE,
        filing_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PROVISIONAL_FILED',
        patent_office VARCHAR(100) NOT NULL DEFAULT 'Indian Patent Office (IPO)',
        abstract TEXT NOT NULL,
        field_of_invention VARCHAR(100) NOT NULL DEFAULT 'CleanTech',
        commercial_readiness VARCHAR(50) NOT NULL DEFAULT 'TRL-4 (Lab Validation)',
        grant_number VARCHAR(100),
        grant_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS ix_patents_ip_project_id ON patents_ip (project_id);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_university_id ON patents_ip (university_id);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_inventor_id ON patents_ip (inventor_id);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_title ON patents_ip (title);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_application_number ON patents_ip (application_number);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_status ON patents_ip (status);
    CREATE INDEX IF NOT EXISTS ix_patents_ip_field_of_invention ON patents_ip (field_of_invention);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS patents_ip CASCADE;")
