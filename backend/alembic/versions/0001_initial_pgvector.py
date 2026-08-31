"""Initial migration: enable pgvector extension

Revision ID: 0001_initial_pgvector
Revises:
Create Date: 2026-08-31 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_pgvector"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Safely enable the pgvector extension in PostgreSQL
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")


def downgrade() -> None:
    # Safely drop the vector extension if needed on full rollback
    op.execute("DROP EXTENSION IF EXISTS vector;")
