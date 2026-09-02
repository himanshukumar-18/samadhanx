"""citizen profile updates

Revision ID: 0005_citizen_profile_updates
Revises: 0004_problem_saves_and_reports
Create Date: 2026-09-02 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_citizen_profile_updates'
down_revision: Union[str, None] = '0004_problem_saves_and_reports'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('citizen_profiles', sa.Column('headline', sa.String(length=120), nullable=True))
    op.add_column('citizen_profiles', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('citizen_profiles', sa.Column('website_url', sa.String(length=255), nullable=True))
    op.add_column('citizen_profiles', sa.Column('github_url', sa.String(length=255), nullable=True))
    op.add_column('citizen_profiles', sa.Column('linkedin_url', sa.String(length=255), nullable=True))
    op.add_column('citizen_profiles', sa.Column('profile_picture_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('citizen_profiles', 'profile_picture_url')
    op.drop_column('citizen_profiles', 'linkedin_url')
    op.drop_column('citizen_profiles', 'github_url')
    op.drop_column('citizen_profiles', 'website_url')
    op.drop_column('citizen_profiles', 'bio')
    op.drop_column('citizen_profiles', 'headline')
