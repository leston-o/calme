"""live3 voice, english only

Revision ID: c41e9a7d2f15
Revises: 8d2f6c1a9b40
Create Date: 2026-11-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c41e9a7d2f15'
down_revision: Union[str, None] = '8d2f6c1a9b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # cloned voice IDs don't carry over: everyone starts on Live 3's Clara
    op.add_column(
        'agents',
        sa.Column('voice', sa.String(length=32), nullable=False, server_default='Clara'),
    )
    op.drop_column('agents', 'voice_id')
    op.drop_column('agents', 'language')


def downgrade() -> None:
    op.add_column(
        'agents',
        sa.Column('language', sa.String(length=20), nullable=False, server_default='en'),
    )
    op.add_column('agents', sa.Column('voice_id', sa.String(length=100), nullable=True))
    op.drop_column('agents', 'voice')
