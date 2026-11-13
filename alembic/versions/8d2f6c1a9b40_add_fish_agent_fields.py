"""add fish agent fields

Revision ID: 8d2f6c1a9b40
Revises: 50c19d15e068
Create Date: 2026-11-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d2f6c1a9b40'
down_revision: Union[str, None] = '50c19d15e068'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agents', sa.Column('fish_agent_id', sa.String(length=64), nullable=True))
    op.add_column('agents', sa.Column('phone_provider', sa.String(length=20), nullable=True))
    # every number bought so far came from Twilio
    op.execute("UPDATE agents SET phone_provider = 'twilio' WHERE phone_number_sid IS NOT NULL")


def downgrade() -> None:
    op.drop_column('agents', 'phone_provider')
    op.drop_column('agents', 'fish_agent_id')
