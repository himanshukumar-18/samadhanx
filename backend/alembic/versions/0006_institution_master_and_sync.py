"""institution master and sync

Revision ID: 0006_institution_master_and_sync
Revises: 0005_citizen_profile_updates
Create Date: 2026-09-02 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0006_institution_master_and_sync'
down_revision: Union[str, None] = '0005_citizen_profile_updates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create institution_masters table
    op.create_table(
        'institution_masters',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('normalized_name', sa.String(length=255), nullable=False),
        sa.Column('aishe_code', sa.String(length=50), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('source', sa.String(length=50), server_default='ugc_dataset', nullable=False),
        sa.Column('verification_status', sa.String(length=30), server_default='verified', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_institution_masters_id', 'institution_masters', ['id'], unique=False)
    op.create_index('ix_institution_masters_normalized_name', 'institution_masters', ['normalized_name'], unique=False)
    op.create_index('ix_institution_masters_aishe_code', 'institution_masters', ['aishe_code'], unique=True)
    op.create_index('ix_institution_masters_state', 'institution_masters', ['state'], unique=False)
    op.create_index('ix_institution_masters_district', 'institution_masters', ['district'], unique=False)
    op.create_index('ix_institution_masters_verification_status', 'institution_masters', ['verification_status'], unique=False)
    op.create_index('idx_inst_name_state', 'institution_masters', ['normalized_name', 'state'], unique=False)

    # 2. Create institution_sync_logs table
    op.create_table(
        'institution_sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source_name', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='started', nullable=False),
        sa.Column('records_processed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_added', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_updated', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_failed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_institution_sync_logs_id', 'institution_sync_logs', ['id'], unique=False)
    op.create_index('ix_institution_sync_logs_status', 'institution_sync_logs', ['status'], unique=False)

    # 3. Create institution_sync_errors table
    op.create_table(
        'institution_sync_errors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sync_log_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('institution_sync_logs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('raw_data_json', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_institution_sync_errors_id', 'institution_sync_errors', ['id'], unique=False)

    # 4. Add institution_id to university_profiles & student_profiles
    op.add_column('university_profiles', sa.Column('institution_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('institution_masters.id', ondelete='SET NULL'), nullable=True))
    op.add_column('student_profiles', sa.Column('institution_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('institution_masters.id', ondelete='RESTRICT'), nullable=True))


def downgrade() -> None:
    op.drop_column('student_profiles', 'institution_id')
    op.drop_column('university_profiles', 'institution_id')
    op.drop_table('institution_sync_errors')
    op.drop_table('institution_sync_logs')
    op.drop_table('institution_masters')
