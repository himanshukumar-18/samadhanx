"""Add duplicate problem detection, vector embeddings, and problem_duplicate_links

Revision ID: 0017_duplicate_detection
Revises: 0016_ai_trigger_started_at
Create Date: 2026-10-13 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0017_duplicate_detection"
down_revision = "0016_ai_trigger_started_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add 'duplicate' value to problem_status_enum safely in PostgreSQL
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid 
                WHERE t.typname = 'problem_status_enum' AND e.enumlabel = 'duplicate'
            ) THEN
                ALTER TYPE problem_status_enum ADD VALUE 'duplicate';
            END IF;
        END$$;
        """
    )

    # 2. Create enums for duplicate links if they do not exist
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duplicate_verdict_enum') THEN
                CREATE TYPE duplicate_verdict_enum AS ENUM (
                    'strong_duplicate', 'possible_duplicate', 'related', 'unique'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duplicate_link_status_enum') THEN
                CREATE TYPE duplicate_link_status_enum AS ENUM (
                    'pending', 'confirmed', 'dismissed'
                );
            END IF;
        END$$;
        """
    )

    # 3. Add embedding columns and duplicate_of_id to problems table safely and idempotently
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("ALTER TABLE problems ADD COLUMN IF NOT EXISTS embedding vector(384);")
    op.execute("ALTER TABLE problems ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);")
    op.execute("ALTER TABLE problems ADD COLUMN IF NOT EXISTS embedding_hash VARCHAR(64);")
    op.execute("ALTER TABLE problems ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'problems' AND column_name = 'duplicate_of_id'
            ) THEN
                ALTER TABLE problems ADD COLUMN duplicate_of_id UUID REFERENCES problems(id) ON DELETE SET NULL;
            END IF;
        END$$;
        """
    )

    # Indexes on problems
    op.execute("CREATE INDEX IF NOT EXISTS ix_problems_embedding_hash ON problems (embedding_hash);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_problems_duplicate_of_id ON problems (duplicate_of_id);")

    # HNSW index for cosine distance vector search
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_problems_embedding_hnsw ON problems USING hnsw (embedding vector_cosine_ops);"
    )

    # 4. Create problem_duplicate_links table idempotently
    conn = op.get_bind()
    table_exists = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='problem_duplicate_links')")
    ).scalar()

    if not table_exists:
        op.create_table(
            "problem_duplicate_links",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("problem_id", UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("candidate_problem_id", UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("similarity", sa.Float(), nullable=False),
            sa.Column(
                "verdict",
                sa.Enum("strong_duplicate", "possible_duplicate", "related", "unique", name="duplicate_verdict_enum", create_type=False),
                nullable=False,
                index=True,
            ),
            sa.Column("llm_used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("llm_reason", sa.Text(), nullable=True),
            sa.Column(
                "status",
                sa.Enum("pending", "confirmed", "dismissed", name="duplicate_link_status_enum", create_type=False),
                server_default=sa.text("'pending'"),
                nullable=False,
                index=True,
            ),
            sa.Column("reviewed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.UniqueConstraint("problem_id", "candidate_problem_id", name="uq_problem_duplicate_link_pair"),
            sa.CheckConstraint("problem_id != candidate_problem_id", name="chk_not_self_duplicate"),
        )


def downgrade() -> None:
    op.drop_table("problem_duplicate_links")
    op.execute("DROP INDEX IF EXISTS idx_problems_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS ix_problems_duplicate_of_id;")
    op.execute("DROP INDEX IF EXISTS ix_problems_embedding_hash;")
    op.execute("ALTER TABLE problems DROP COLUMN IF EXISTS duplicate_of_id;")
    op.execute("ALTER TABLE problems DROP COLUMN IF EXISTS embedding_updated_at;")
    op.execute("ALTER TABLE problems DROP COLUMN IF EXISTS embedding_hash;")
    op.execute("ALTER TABLE problems DROP COLUMN IF EXISTS embedding_model;")
    op.execute("ALTER TABLE problems DROP COLUMN IF EXISTS embedding;")
    op.execute("DROP TYPE IF EXISTS duplicate_link_status_enum;")
    op.execute("DROP TYPE IF EXISTS duplicate_verdict_enum;")
